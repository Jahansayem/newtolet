-- Removes the TEST orders created by seed-customer-orders.sql (created_by_label
-- = 'seed') and nothing else. Customer orders are normally never hard-deleted
-- and their logs are append-only, so the guard triggers are switched off for
-- the length of this transaction only.
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/unseed-customer-orders.sql

begin;

alter table public.customer_orders disable trigger trg_customer_orders_no_hard_delete;
alter table public.customer_order_status_history disable trigger trg_customer_order_status_history_immutable;
alter table public.customer_order_notes disable trigger trg_customer_order_notes_immutable;
alter table public.customer_order_activity disable trigger trg_customer_order_activity_immutable;

create temp table t_seed_orders on commit drop as
  select id from public.customer_orders where created_by_label = 'seed';

delete from public.customer_order_activity where order_id in (select id from t_seed_orders);
delete from public.customer_order_notes where order_id in (select id from t_seed_orders);
delete from public.customer_order_status_history where order_id in (select id from t_seed_orders);
delete from public.customer_order_matches where order_id in (select id from t_seed_orders);
delete from public.customer_order_payment_claims where order_id in (select id from t_seed_orders);
delete from public.customer_orders where id in (select id from t_seed_orders);

alter table public.customer_orders enable trigger trg_customer_orders_no_hard_delete;
alter table public.customer_order_status_history enable trigger trg_customer_order_status_history_immutable;
alter table public.customer_order_notes enable trigger trg_customer_order_notes_immutable;
alter table public.customer_order_activity enable trigger trg_customer_order_activity_immutable;

select 'CUSTOMER_ORDER_SEEDS_REMOVED', (select count(*) from public.customer_orders where created_by_label = 'seed') as remaining;

commit;
