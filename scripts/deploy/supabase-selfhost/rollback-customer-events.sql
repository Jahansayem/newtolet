-- Revert of supabase/migrations/20261102090000_customer_events.sql.
-- Drops the triggers, functions and the customer_events table (its rows are
-- analytics only; nothing else references them).
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/rollback-customer-events.sql

begin;

drop trigger if exists trg_customer_events_contact_view on public.contact_views;
drop trigger if exists trg_customer_events_inquiry on public.property_inquiries;
drop trigger if exists trg_customer_events_order on public.orders;

drop function if exists public.customer_events_on_contact_view();
drop function if exists public.customer_events_on_inquiry();
drop function if exists public.customer_events_on_order();
drop function if exists public.track_customer_event(text, uuid, uuid, uuid, text, text, jsonb);
drop function if exists public.admin_customer_daily_stats(timestamptz, timestamptz, text);
drop function if exists public.admin_customer_range_totals(timestamptz, timestamptz);
drop function if exists public.admin_customer_list(text, timestamptz, timestamptz, boolean, text, text, integer, integer);
drop function if exists public.admin_customer_timeline(uuid, uuid, integer, integer);
drop function if exists public.admin_top_viewed_listings(timestamptz, timestamptz, integer);

drop table if exists public.customer_events;

select 'CUSTOMER_EVENTS_ROLLED_BACK';

commit;
