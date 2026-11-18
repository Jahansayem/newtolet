-- Revert of supabase/migrations/20261119090000_payment_links.sql.
-- Drops the payment link functions, the admin view, the table and the
-- payment_transactions.payment_link_id column.
--
-- WARNING: this deletes every payment link. The payment_transactions rows of
-- link payments stay, but lose their link. Take a dump first if any link exists:
--   ssh root@HOST "docker exec supabase-db pg_dump -U postgres -d postgres -t public.payment_links -Fc" > payment-links.dump
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/rollback-payment-links.sql
--
-- REQUIRED afterwards: re-apply supabase/migrations/20261118100000_order_eps_payment.sql
-- (idempotent). It restores payment_transactions_guard_client_writes() and
-- approve_credit_payment_transaction() without the payment link parts. Until
-- then approving a payment fails (that function still names the dropped
-- column); the guard below keeps working because it is restored here.

begin;

-- The 20261118100000 version: no payment_link_id.
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

  v_status := new.status;
  new := old;
  new.status := v_status;
  new.updated_at := now();
  return new;
end;
$$;

drop function if exists public.admin_create_payment_link(int, text, text, text, text, text, uuid);
drop function if exists public.admin_cancel_payment_link(uuid, text);
drop function if exists public.admin_payment_link_counts();
drop function if exists public.mark_payment_link_paid_from_gateway(uuid, uuid);
drop function if exists public.payment_link_admin_row(uuid);
drop function if exists public.payment_link_new_code();

drop view if exists public.payment_links_admin;

drop index if exists public.idx_payment_transactions_payment_link;
alter table public.payment_transactions drop column if exists payment_link_id;

drop table if exists public.payment_links;

commit;
