-- Payment links: an admin creates a link for any amount, sends it to a customer
-- and the customer pays through EPS on https://www.newtolet.com/pay/?c=<code>.
--
-- EPS has no payment-link API (only GetToken, InitializeEPS and
-- CheckMerchantTransactionStatus), so the link lives here and every tap on
-- "Pay" starts an ordinary EPS transaction through the payment-links Edge
-- Function. A link is single-use and never expires; an admin can cancel it.
--
--   1. payment_links                      the link itself
--   2. payment_transactions.payment_link_id   one row per payment attempt
--   3. payment_transactions_guard_client_writes(): a browser can never attach
--      a payment row to a link
--   4. payment_links_admin                the list the admin tab reads
--   5. admin_create_payment_link / admin_cancel_payment_link / admin_payment_link_counts
--   6. mark_payment_link_paid_from_gateway()  payment -> credited, link -> PAID,
--                                         attached Customer Order -> verified claim
--   7. approve_credit_payment_transaction() routes link payments to (6) so an
--      admin approving a held one never runs the credit path
--
-- Requires 20261025090000_admin_roles_audit_rpcs.sql,
-- 20261116090000_customer_orders.sql and 20261118100000_order_eps_payment.sql.
-- Idempotent. Rollback: scripts/deploy/supabase-selfhost/rollback-payment-links.sql
-- NOTE: re-running 20261025's EXECUTE sweep would revoke the grants made here;
-- re-apply this file afterwards if that ever happens.

begin;

-- ---------------------------------------------------------------------------
-- 1. The link
-- ---------------------------------------------------------------------------
create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{10}$'),
  amount_bdt int not null check (amount_bdt between 10 and 500000),
  purpose text not null check (char_length(btrim(purpose)) between 3 and 120),
  customer_name text check (customer_name is null or char_length(customer_name) <= 80),
  customer_phone text check (customer_phone is null or customer_phone ~ '^01[3-9][0-9]{8}$'),
  customer_email text check (customer_email is null or char_length(customer_email) <= 160),
  note text check (note is null or char_length(note) <= 500),
  customer_order_id uuid references public.customer_orders(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAID', 'CANCELLED')),
  paid_at timestamptz,
  paid_payment_id uuid references public.payment_transactions(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_by_label text not null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.users(id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_links_status_created on public.payment_links (status, created_at desc);
create index if not exists idx_payment_links_created on public.payment_links (created_at desc);
create index if not exists idx_payment_links_order on public.payment_links (customer_order_id) where customer_order_id is not null;

drop trigger if exists trg_payment_links_set_updated_at on public.payment_links;
create trigger trg_payment_links_set_updated_at
  before update on public.payment_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Payment attempts. A link payment is a payment_transactions row with no
--    user (the customer is not signed in), no credits and this column set.
-- ---------------------------------------------------------------------------
alter table public.payment_transactions
  add column if not exists payment_link_id uuid references public.payment_links(id) on delete set null;

create index if not exists idx_payment_transactions_payment_link
  on public.payment_transactions (payment_link_id, created_at desc) where payment_link_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Same function as 20261118100000 with one more forced column: a browser
--    insert can never point a payment row at a link.
--    Not SECURITY DEFINER on purpose: current_user must stay the caller's role.
-- ---------------------------------------------------------------------------
create or replace function public.payment_transactions_guard_client_writes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.order_id := null;
    new.package_id := null;
    new.payment_link_id := null;
    new.credits_to_add := 0;
    new.reference := null;
    new.invoice_id := null;
    new.gateway_payload := '{}'::jsonb;
    new.approved_at := null;
    new.approved_by := null;
    new.credited_at := null;
    new.credited_by := null;
    return new;
  end if;

  -- UPDATE: the only change a customer may make is the status (RLS limits it
  -- to cancelling a pending row). Every other column keeps its stored value.
  v_status := new.status;
  new := old;
  new.status := v_status;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Access: admins holding payments.view may read; every write goes through
--    the functions below. The customer never reads this table: the
--    payment-links Edge Function (service role) returns the few public fields.
-- ---------------------------------------------------------------------------
alter table public.payment_links enable row level security;
revoke all on public.payment_links from public, anon, authenticated;
grant all on public.payment_links to service_role;
grant select on public.payment_links to authenticated;

drop policy if exists payment_links_admin_read on public.payment_links;
create policy payment_links_admin_read on public.payment_links
  for select to authenticated
  using ((select public.admin_has_permission('payments.view')));

drop view if exists public.payment_links_admin;
create view public.payment_links_admin with (security_invoker = true) as
select
  l.*,
  o.order_no as customer_order_no,
  coalesce(a.attempts, 0)::int as attempts,
  a.last_attempt_at,
  a.last_attempt_status,
  p.reference as paid_reference,
  p.gateway_payload ->> 'epsTransactionId' as paid_eps_transaction_id,
  p.gateway_payload ->> 'financialEntity' as paid_method
from public.payment_links l
left join public.customer_orders o on o.id = l.customer_order_id
left join public.payment_transactions p on p.id = l.paid_payment_id
left join lateral (
  select
    count(*) as attempts,
    max(t.created_at) as last_attempt_at,
    (array_agg(t.status order by t.created_at desc))[1] as last_attempt_status
  from public.payment_transactions t
  where t.payment_link_id = l.id
) a on true;

revoke all on public.payment_links_admin from public, anon, authenticated;
grant select on public.payment_links_admin to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Admin functions
-- ---------------------------------------------------------------------------
-- 10 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
create or replace function public.payment_link_new_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  i int;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..9 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.payment_links where code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.payment_link_admin_row(p_link_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(v) from public.payment_links_admin v where v.id = p_link_id;
$$;

create or replace function public.admin_create_payment_link(
  p_amount_bdt int,
  p_purpose text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_note text default null,
  p_customer_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('payments.review');
  v_purpose text := nullif(btrim(coalesce(p_purpose, '')), '');
  v_name text := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_customer_email, ''))), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_order public.customer_orders%rowtype;
  v_id uuid;
  v_code text;
  v_audit_id bigint;
begin
  if p_amount_bdt is null or p_amount_bdt < 10 or p_amount_bdt > 500000 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Amount must be a whole number between 10 and 500,000 BDT.';
  end if;
  if v_purpose is null or char_length(v_purpose) < 3 or char_length(v_purpose) > 120 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Say what the payment is for (3 to 120 characters).';
  end if;
  if v_name is not null and char_length(v_name) > 80 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Customer name is too long (80 characters at most).';
  end if;
  if v_phone is not null then
    v_phone := public.co_normalize_phone(v_phone);
  end if;
  if v_email is not null and (char_length(v_email) > 160 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Customer email does not look right.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: The note is too long (500 characters at most).';
  end if;

  if p_customer_order_id is not null then
    select * into v_order from public.customer_orders where id = p_customer_order_id and deleted_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Customer order was not found.';
    end if;
    if v_order.status in ('COMPLETED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE', 'REFUND_REQUESTED') then
      raise exception using errcode = 'P0001',
        message = format('ADMIN_VALIDATION: A payment link cannot be attached to a %s order.', v_order.status);
    end if;
    v_name := coalesce(v_name, nullif(btrim(v_order.customer_name), ''));
    v_phone := coalesce(v_phone, v_order.customer_phone);
  end if;

  v_code := public.payment_link_new_code();
  insert into public.payment_links (code, amount_bdt, purpose, customer_name, customer_phone, customer_email, note,
                                    customer_order_id, created_by, created_by_label)
  values (v_code, p_amount_bdt, v_purpose, v_name, v_phone, v_email, v_note,
          p_customer_order_id, v_actor, public.co_admin_label(v_actor))
  returning id into v_id;

  v_audit_id := public.log_admin_action('payment_link.create', 'payment_link', v_id::text, null, null,
    jsonb_build_object('code', v_code, 'amount_bdt', p_amount_bdt, 'customer_order_id', p_customer_order_id));
  return jsonb_build_object('row', public.payment_link_admin_row(v_id), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_cancel_payment_link(p_link_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('payments.review');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_link public.payment_links%rowtype;
  v_audit_id bigint;
begin
  if v_reason is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required to cancel a payment link.';
  end if;
  select * into v_link from public.payment_links where id = p_link_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Payment link was not found.';
  end if;
  if v_link.status <> 'ACTIVE' then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: Only an active payment link can be cancelled (current: %s).', v_link.status),
      hint = format('entity=payment_link;from=%s;to=CANCELLED', v_link.status);
  end if;
  -- A customer may have paid seconds ago and not been verified yet.
  if exists (
    select 1 from public.payment_transactions t
    where t.payment_link_id = p_link_id and t.status in ('awaiting_admin_approval', 'crediting', 'credited')
  ) then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_CONFLICT: This link has a payment waiting for review. Check the Payments tab before cancelling.';
  end if;

  update public.payment_links
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_actor, cancel_reason = v_reason
  where id = p_link_id;

  v_audit_id := public.log_admin_action('payment_link.cancel', 'payment_link', p_link_id::text, v_reason,
    jsonb_build_object('status', 'ACTIVE'), jsonb_build_object('status', 'CANCELLED'));
  return jsonb_build_object('row', public.payment_link_admin_row(p_link_id), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_payment_link_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission('payments.view');
  return (
    select jsonb_build_object(
      'active', count(*) filter (where status = 'ACTIVE'),
      'paid', count(*) filter (where status = 'PAID'),
      'cancelled', count(*) filter (where status = 'CANCELLED'),
      'active_bdt', coalesce(sum(amount_bdt) filter (where status = 'ACTIVE'), 0),
      'collected_bdt', coalesce(sum(amount_bdt) filter (where status = 'PAID'), 0))
    from public.payment_links);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. A gateway-verified payment for a link. Called by the Edge Functions
--    (service role) once EPS reports success, and by
--    approve_credit_payment_transaction() when an admin releases a held one.
--    Safe to call twice: a credited payment returns without doing anything.
--    A second payment on a link that is no longer active is not accepted
--    automatically: it stays in awaiting_admin_approval with a note, so
--    finance sees it in the Payments tab.
-- ---------------------------------------------------------------------------
create or replace function public.mark_payment_link_paid_from_gateway(
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
  v_link public.payment_links%rowtype;
  v_co public.customer_orders%rowtype;
  v_label text := 'eps-payment-link';
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
  if v_pay.payment_link_id is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: This payment is not for a payment link.';
  end if;

  if v_pay.status = 'credited' then
    return jsonb_build_object('payment_id', v_pay.id, 'payment_link_id', v_pay.payment_link_id, 'status', 'credited', 'already_paid', true);
  end if;
  if v_pay.status <> 'awaiting_admin_approval' then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: Only a gateway-verified payment can mark a payment link paid (current: %s).', v_pay.status),
      hint = format('entity=payment;from=%s;to=credited', v_pay.status);
  end if;

  select * into v_link from public.payment_links where id = v_pay.payment_link_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Payment link was not found.';
  end if;

  -- Without a human approver the payment must be a plain link payment that
  -- covers the link's amount. Anything else waits for payments.review.
  if p_actor_id is null and (
       v_pay.package_id is not null
       or v_pay.order_id is not null
       or coalesce(v_pay.credits_to_add, 0) <> 0
       or v_pay.reference is null
       or v_pay.amount < v_link.amount_bdt
     ) then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_VALIDATION: This payment does not cover the payment link and needs a manual review.';
  end if;

  if v_link.status = 'PAID' then
    if p_actor_id is not null then
      raise exception using errcode = 'P0001',
        message = 'ADMIN_CONFLICT: This payment link is already paid by another payment. Refund this one from the EPS merchant panel and reject it here.';
    end if;
    update public.payment_transactions
    set review_note = 'Second payment on a payment link that is already paid', updated_at = now()
    where id = v_pay.id;
    return jsonb_build_object('payment_id', v_pay.id, 'payment_link_id', v_link.id, 'status', 'awaiting_admin_approval',
      'already_paid', false, 'held', 'link_already_paid');
  end if;

  if v_link.status = 'CANCELLED' and p_actor_id is null then
    update public.payment_transactions
    set review_note = 'Paid after the payment link was cancelled', updated_at = now()
    where id = v_pay.id;
    return jsonb_build_object('payment_id', v_pay.id, 'payment_link_id', v_link.id, 'status', 'awaiting_admin_approval',
      'already_paid', false, 'held', 'link_cancelled');
  end if;

  update public.payment_transactions
  set status = 'credited', approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, p_actor_id),
      credited_at = now(), credited_by = p_actor_id, updated_at = now()
  where id = v_pay.id;

  update public.payment_links
  set status = 'PAID', paid_at = now(), paid_payment_id = v_pay.id
  where id = v_link.id;

  -- Attached Customer Order. A problem here must never undo a real payment, so
  -- it runs in its own block; a failure leaves the claim for a human to record.
  if v_link.customer_order_id is not null then
    begin
      v_amount := round(v_pay.amount)::int;
      v_trx := left(upper(regexp_replace(coalesce(v_pay.reference, v_pay.invoice_id, v_pay.transaction_id, ''), '[^A-Za-z0-9]', '', 'g')), 30);

      select * into v_co from public.customer_orders where id = v_link.customer_order_id and deleted_at is null for update;

      if found and v_amount > 0 and length(v_trx) >= 6 then
        v_claim_id := (public.co_record_payment_claim('system', null, v_label, v_co.id, v_amount, v_trx, null) ->> 'claim_id')::uuid;

        update public.customer_order_payment_claims
        set status = 'VERIFIED', reviewed_by = p_actor_id, reviewed_by_label = v_label, reviewed_at = now(),
            review_note = format('Verified automatically: paid through payment link %s (EPS)', v_link.code)
        where id = v_claim_id;

        select coalesce(sum(amount_bdt), 0)::int into v_verified
        from public.customer_order_payment_claims where order_id = v_co.id and status = 'VERIFIED';

        select * into v_co from public.customer_orders where id = v_co.id;
        if v_verified >= v_co.service_charge_bdt then
          update public.customer_orders set payment_verified_at = coalesce(payment_verified_at, now()) where id = v_co.id;
          if v_co.status in ('PAYMENT_CLAIMED', 'PAYMENT_ISSUE', 'PAYMENT_INTERESTED', 'PAYMENT_FAILED') then
            update public.customer_orders set status = 'PAYMENT_VERIFIED' where id = v_co.id;
            insert into public.customer_order_status_history (order_id, from_status, to_status, reason, actor_type, actor_id, actor_label)
            values (v_co.id, v_co.status, 'PAYMENT_VERIFIED', 'Payment verified in full (EPS payment link)', 'system', p_actor_id, v_label);
          end if;
        end if;

        perform public.co_log_activity(v_co.id, 'system', p_actor_id, v_label, 'payment.verify',
          jsonb_build_object('claim_id', v_claim_id, 'status', 'CLAIMED'),
          jsonb_build_object('claim_id', v_claim_id, 'status', 'VERIFIED', 'amount_bdt', v_amount,
                             'payment_transaction_id', v_pay.id, 'payment_link_code', v_link.code));
        v_mirror := 'verified';
      end if;
    exception when others then
      v_mirror := 'failed';
      raise warning 'customer order mirror failed for payment link payment %: %', v_pay.id, sqlerrm;
    end;
  end if;

  return jsonb_build_object('payment_id', v_pay.id, 'payment_link_id', v_link.id, 'status', 'credited',
    'link_status', 'PAID', 'already_paid', false, 'mirror', v_mirror);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Same function as 20261118100000 with one addition: a payment that belongs
--    to a payment link is handed to mark_payment_link_paid_from_gateway()
--    instead of the credit path (it has no user and no credits).
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

  -- Payment link: no user and no credits are involved.
  if payment_record.payment_link_id is not null then
    perform public.mark_payment_link_paid_from_gateway(payment_record.id, p_admin_id);
    perform public.log_admin_action('payment.approve', 'payment', payment_record.id::text, null,
      jsonb_build_object('status', payment_record.status),
      jsonb_build_object('status', 'credited', 'payment_link_id', payment_record.payment_link_id, 'credits_added', 0),
      jsonb_build_object('via', case when auth.uid() is null then current_user else 'rpc' end, 'admin_id', p_admin_id));
    return query
    select payment_record.id, payment_record.transaction_id, payment_record.user_id, 0, 0, 'credited'::text;
    return;
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

-- ---------------------------------------------------------------------------
-- 8. Grants. Admin functions check their own permission; the rest is server-only.
-- ---------------------------------------------------------------------------
revoke all on function public.payment_link_new_code() from public, anon, authenticated;
revoke all on function public.payment_link_admin_row(uuid) from public, anon, authenticated;
revoke all on function public.mark_payment_link_paid_from_gateway(uuid, uuid) from public, anon, authenticated;
grant execute on function public.payment_link_new_code() to service_role;
grant execute on function public.payment_link_admin_row(uuid) to service_role;
grant execute on function public.mark_payment_link_paid_from_gateway(uuid, uuid) to service_role;

revoke all on function public.admin_create_payment_link(int, text, text, text, text, text, uuid) from public, anon;
revoke all on function public.admin_cancel_payment_link(uuid, text) from public, anon;
revoke all on function public.admin_payment_link_counts() from public, anon;
grant execute on function public.admin_create_payment_link(int, text, text, text, text, text, uuid) to authenticated, service_role;
grant execute on function public.admin_cancel_payment_link(uuid, text) to authenticated, service_role;
grant execute on function public.admin_payment_link_counts() to authenticated, service_role;

commit;
