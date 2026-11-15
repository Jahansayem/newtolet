-- Revert of supabase/migrations/20261116090000_customer_orders.sql.
-- Drops the mirror trigger on public.orders, every co_* / admin_customer_order_*
-- function, the enriched view and all customer_order* tables. The old
-- public.orders table and its rows are not touched.
--
-- WARNING: this deletes every customer order, payment claim, match, note and
-- timeline row. Take a dump first if any real order exists:
--   ssh root@HOST "docker exec supabase-db pg_dump -U postgres -d postgres -t 'public.customer_order*' -Fc" > customer-orders.dump
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/rollback-customer-orders.sql

begin;

drop trigger if exists trg_customer_orders_mirror on public.orders;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'co\_%' or p.proname like 'admin\_customer\_order\_%')
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

drop view if exists public.customer_orders_enriched;

drop table if exists public.customer_order_api_requests;
drop table if exists public.customer_order_transitions;
drop table if exists public.customer_order_activity;
drop table if exists public.customer_order_notes;
drop table if exists public.customer_order_status_history;
drop table if exists public.customer_order_matches;
drop table if exists public.customer_order_payment_claims;
drop table if exists public.customer_orders;
drop table if exists public.customer_order_counters;

drop function if exists public.customer_orders_on_legacy_order();
drop function if exists public.customer_orders_assign_order_no();
drop function if exists public.customer_orders_no_hard_delete();
drop function if exists public.customer_order_log_immutable();

select 'CUSTOMER_ORDERS_ROLLED_BACK';

commit;
