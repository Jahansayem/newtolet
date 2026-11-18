-- EPS payment for website "Order Home" orders (public.orders).
--
-- Until now the website form only pretended to take a payment. This migration
-- gives the paymently-* Edge Functions what they need to charge an order through
-- EPS and mark it paid without a manual step:
--   1. order_home_pricing()            the one server-side source of the price
--   2. orders_enforce_price trigger    a browser insert can never choose its cost
--   3. one-time reprice of unpaid website orders to the current offer
--   4. mark_order_paid_from_gateway()  payment -> credited, order -> pending,
--                                      Customer Orders mirror -> PAYMENT_VERIFIED
--   5. approve_credit_payment_transaction() routes order payments to (4) so an
--      admin approving a held order payment never runs the credit path
--
-- Requires 20261025090000_admin_roles_audit_rpcs.sql and
-- 20261116090000_customer_orders.sql. Idempotent.

begin;

-- ---------------------------------------------------------------------------
-- 1. Price. Regular 1000 BDT, 50% off for now. Change the offer here and in
--    src/lib/orderPricing.js (display only; this function is what is charged).
-- ---------------------------------------------------------------------------
create or replace function public.order_home_pricing()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'regular_bdt', 1000,
    'discount_percent', 50,
    'payable_bdt', 500
  );
$$;

grant execute on function public.order_home_pricing() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Website inserts arrive as the `authenticated` role straight from the
--    browser. Force the cost and the starting status there, so a tampered
--    request cannot create a 1 BDT order or one that is already "paid".
--    Not SECURITY DEFINER on purpose: current_user must stay the caller's role.
-- ---------------------------------------------------------------------------
create or replace function public.orders_enforce_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.cost := (public.order_home_pricing() ->> 'payable_bdt')::int;
    new.status := 'pending_payment';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_enforce_price on public.orders;
create trigger trg_orders_enforce_price
  before insert on public.orders
  for each row execute function public.orders_enforce_price();

-- ---------------------------------------------------------------------------
-- 3. Unpaid website orders were created at the old 1000 BDT. Reprice them to
--    the current offer so "Pay now" charges what the site shows. Mirrored
--    Customer Orders rows follow only when nobody has recorded a payment claim.
-- ---------------------------------------------------------------------------
do $$
declare
  v_regular int := (public.order_home_pricing() ->> 'regular_bdt')::int;
  v_payable int := (public.order_home_pricing() ->> 'payable_bdt')::int;
begin
  update public.customer_orders co
  set service_charge_bdt = v_payable
  from public.orders o
  where co.legacy_order_id = o.id
    and o.status = 'pending_payment'
    and o.cost = v_regular
    and co.service_charge_bdt = v_regular
    and not exists (select 1 from public.customer_order_payment_claims c where c.order_id = co.id);

  update public.orders o
  set cost = v_payable, updated_at = now()
  where o.status = 'pending_payment'
    and o.cost = v_regular
    and not exists (
      select 1 from public.customer_orders co
      where co.legacy_order_id = o.id and co.service_charge_bdt <> v_payable
    );
end $$;

create index if not exists idx_payment_transactions_order
  on public.payment_transactions (order_id) where order_id is not null;

-- ---------------------------------------------------------------------------
-- 4. A gateway-verified payment for an order. Called by the Edge Functions
--    (service role) once EPS reports success for the stored amount, and by
--    approve_credit_payment_transaction() when an admin releases a held one.
--    Safe to call twice: a credited payment returns without doing anything.
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_paid_from_gateway(
  p_payment_transaction_id uuid,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
  v_co public.customer_orders%rowtype;
  v_label text := 'eps-gateway';
  v_amount int;
  v_trx text;
  v_claim_id uuid;
  v_verified int;
  v_mirror text := 'skipped';
begin
  select * into v_pay from public.payment_transactions where id = p_payment_transaction_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Payment transaction not found.';
  end if;
  if v_pay.order_id is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: This payment is not for an order.';
  end if;

  if v_pay.status = 'credited' then
    return jsonb_build_object('payment_id', v_pay.id, 'order_id', v_pay.order_id, 'status', 'credited', 'already_paid', true);
  end if;
  if v_pay.status <> 'awaiting_admin_approval' then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: Only a gateway-verified payment can mark an order paid (current: %s).', v_pay.status),
      hint = format('entity=payment;from=%s;to=credited', v_pay.status);
  end if;

  select * into v_order from public.orders where id = v_pay.order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Order was not found.';
  end if;

  update public.orders set status = 'pending', updated_at = now()
  where id = v_order.id and status = 'pending_payment';

  update public.payment_transactions
  set status = 'credited', approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, p_actor_id),
      credited_at = now(), credited_by = p_actor_id, updated_at = now()
  where id = v_pay.id;

  -- Customer Orders mirror. A problem here must never undo a real payment, so
  -- it runs in its own block; a failure leaves the claim for a human to record.
  begin
    v_amount := round(v_pay.amount)::int;
    v_trx := left(upper(regexp_replace(coalesce(v_pay.reference, v_pay.invoice_id, v_pay.transaction_id, ''), '[^A-Za-z0-9]', '', 'g')), 30);

    perform public.co_mirror_legacy_order(v_order.id);
    select * into v_co from public.customer_orders where legacy_order_id = v_order.id and deleted_at is null for update;

    if found and v_amount > 0 and length(v_trx) >= 6 then
      v_claim_id := (public.co_record_payment_claim('system', null, v_label, v_co.id, v_amount, v_trx, null) ->> 'claim_id')::uuid;

      update public.customer_order_payment_claims
      set status = 'VERIFIED', reviewed_by = p_actor_id, reviewed_by_label = v_label, reviewed_at = now(),
          review_note = 'Verified automatically: paid through the EPS gateway'
      where id = v_claim_id;

      select coalesce(sum(amount_bdt), 0)::int into v_verified
      from public.customer_order_payment_claims where order_id = v_co.id and status = 'VERIFIED';

      select * into v_co from public.customer_orders where id = v_co.id;
      if v_verified >= v_co.service_charge_bdt then
        update public.customer_orders set payment_verified_at = coalesce(payment_verified_at, now()) where id = v_co.id;
        if v_co.status in ('PAYMENT_CLAIMED', 'PAYMENT_ISSUE', 'PAYMENT_INTERESTED', 'PAYMENT_FAILED') then
          update public.customer_orders set status = 'PAYMENT_VERIFIED' where id = v_co.id;
          insert into public.customer_order_status_history (order_id, from_status, to_status, reason, actor_type, actor_id, actor_label)
          values (v_co.id, v_co.status, 'PAYMENT_VERIFIED', 'Payment verified in full (EPS gateway)', 'system', p_actor_id, v_label);
        end if;
      end if;

      perform public.co_log_activity(v_co.id, 'system', p_actor_id, v_label, 'payment.verify',
        jsonb_build_object('claim_id', v_claim_id, 'status', 'CLAIMED'),
        jsonb_build_object('claim_id', v_claim_id, 'status', 'VERIFIED', 'amount_bdt', v_amount,
                           'payment_transaction_id', v_pay.id));
      v_mirror := 'verified';
    end if;
  exception when others then
    v_mirror := 'failed';
    raise warning 'customer order mirror failed for payment %: %', v_pay.id, sqlerrm;
  end;

  return jsonb_build_object('payment_id', v_pay.id, 'order_id', v_order.id, 'status', 'credited',
    'order_status', (select status from public.orders where id = v_order.id), 'already_paid', false, 'mirror', v_mirror);
end;
$$;

revoke all on function public.mark_order_paid_from_gateway(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_order_paid_from_gateway(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Same function as 20261025090000 with one addition: a payment that belongs
--    to an order is handed to mark_order_paid_from_gateway() instead of the
--    credit path. Both admin entry points (admin_approve_payment and the
--    paymently-approve Edge Function) end up here.
-- ---------------------------------------------------------------------------
create or replace function public.approve_credit_payment_transaction(p_payment_transaction_id uuid, p_admin_id uuid)
returns table(payment_id uuid, transaction_id text, user_id uuid, credits_added integer, balance_after integer, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.payment_transactions%rowtype;
  next_balance integer;
begin
  if auth.uid() is not null then
    perform public.assert_admin_permission('payments.review');
    if p_admin_id is distinct from auth.uid() then
      raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: The admin id must match the signed-in user.';
    end if;
  elsif current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Authentication required.';
  end if;

  select * into payment_record from public.payment_transactions where id = p_payment_transaction_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Payment transaction not found.';
  end if;

  if payment_record.status = 'credited' then
    return query
    select payment_record.id, payment_record.transaction_id, payment_record.user_id,
           coalesce(payment_record.credits_to_add, 0),
           coalesce((select credits from public.users where id = payment_record.user_id), 0),
           payment_record.status;
    return;
  end if;

  if payment_record.status <> 'awaiting_admin_approval' then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: Only payments awaiting approval can be approved (current: %s).', payment_record.status),
      hint = format('entity=payment;from=%s;to=credited', payment_record.status);
  end if;

  -- Order payment: no credits are involved.
  if payment_record.order_id is not null then
    perform public.mark_order_paid_from_gateway(payment_record.id, p_admin_id);
    perform public.log_admin_action('payment.approve', 'payment', payment_record.id::text, null,
      jsonb_build_object('status', payment_record.status),
      jsonb_build_object('status', 'credited', 'order_id', payment_record.order_id, 'credits_added', 0),
      jsonb_build_object('via', case when auth.uid() is null then current_user else 'rpc' end, 'admin_id', p_admin_id));
    return query
    select payment_record.id, payment_record.transaction_id, payment_record.user_id, 0,
           coalesce((select credits from public.users where id = payment_record.user_id), 0), 'credited'::text;
    return;
  end if;

  update public.users
  set credits = coalesce(credits, 0) + coalesce(payment_record.credits_to_add, 0), updated_at = now()
  where id = payment_record.user_id
  returning credits into next_balance;

  insert into public.credit_transactions (user_id, credits_deducted, transaction_type, credits_amount, balance_after, reference_type, reference_id, provider, metadata, payment_transaction_id)
  values (payment_record.user_id, -coalesce(payment_record.credits_to_add, 0), 'credit_purchase', coalesce(payment_record.credits_to_add, 0), next_balance,
          'payment_transaction', payment_record.id, coalesce(payment_record.provider, 'eps'),
          jsonb_build_object('invoice_id', coalesce(payment_record.invoice_id, payment_record.reference), 'approved_by', p_admin_id),
          payment_record.transaction_id);

  update public.payment_transactions
  set status = 'credited', approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, p_admin_id),
      credited_at = now(), credited_by = p_admin_id, updated_at = now()
  where id = payment_record.id;

  perform public.log_admin_action('payment.approve', 'payment', payment_record.id::text, null,
    jsonb_build_object('status', payment_record.status),
    jsonb_build_object('status', 'credited', 'credits_added', coalesce(payment_record.credits_to_add, 0), 'balance_after', next_balance),
    jsonb_build_object('via', case when auth.uid() is null then current_user else 'rpc' end, 'admin_id', p_admin_id));

  return query
  select payment_record.id, payment_record.transaction_id, payment_record.user_id, coalesce(payment_record.credits_to_add, 0), next_balance, 'credited'::text;
end;
$$;

commit;
