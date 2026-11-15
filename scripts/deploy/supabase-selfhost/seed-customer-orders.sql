-- Three TEST customer orders for manual testing of the dashboard and the API.
-- Built through the same co_* functions the API uses, so every row has a real
-- timeline. Safe to run twice (it does nothing when the seeds already exist).
-- Remove with unseed-customer-orders.sql.
--
--   1. TEST Rahim   - paid 500 (verified), 2 listings, status SEARCHING_BY_HUMAN
--   2. TEST Karim   - PAYMENT_INTERESTED, nothing paid, 0 listings
--   3. TEST Salma   - PARTIAL_PAID (200 of 500 claimed, unverified), PAYMENT_CLAIMED
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/seed-customer-orders.sql

begin;

do $$
declare
  o1 uuid;
  o2 uuid;
  o3 uuid;
  c uuid;
begin
  if exists (select 1 from public.customer_orders where created_by_label = 'seed') then
    raise notice 'seed orders already present; nothing to do';
    return;
  end if;

  -- 1. paid + verified, human search
  o1 := (public.co_create_order('api_admin', null, 'seed', jsonb_build_object(
    'customer_name', 'TEST Rahim Uddin', 'customer_phone', '01700000001', 'facebook_name', 'TEST Rahim Uddin',
    'facebook_thread_url', 'https://www.facebook.com/messages/t/test-rahim', 'source', 'messenger',
    'area', 'Mirpur 10, Kazipara', 'rooms', 2, 'budget_min', 10000, 'budget_max', 15000,
    'move_in_date', to_char(current_date + 20, 'YYYY-MM-DD'), 'tenant_type', 'family', 'gas', 'line',
    'bathrooms', 1, 'balconies', 1, 'facilities', 'lift preferred', 'requirement_notes', 'Near metro station if possible'),
    'seed-1', true) -> 'order' ->> 'id')::uuid;
  perform public.co_set_status('api_agent', null, 'seed', o1, 'SEARCHING_BY_AI', 'AI search started');
  perform public.co_add_match('api_agent', null, 'seed', o1, jsonb_build_object(
    'reference_id', 'TEST-REF-101', 'general_location', 'Mirpur 10', 'rent', 14000, 'verification_status', 'verified',
    'owner_contact_phone', '01800000001', 'exact_address', 'TEST House 5, Road 2, Mirpur 10', 'owner_permission', true));
  perform public.co_add_match('api_agent', null, 'seed', o1, jsonb_build_object(
    'reference_id', 'TEST-REF-102', 'general_location', 'Kazipara', 'rent', 13000, 'verification_status', 'unverified'));
  perform public.co_set_status('api_agent', null, 'seed', o1, 'PREVIEWS_SENT', 'Two previews sent');
  perform public.co_set_status('api_agent', null, 'seed', o1, 'PAYMENT_INTERESTED', 'Customer agreed to pay');
  c := (public.co_record_payment_claim('api_agent', null, 'seed', o1, 500, 'TESTTRX001') ->> 'claim_id')::uuid;
  perform public.co_review_payment_claim('api_admin', null, 'seed', c, 'verify', 'Seed data');
  perform public.co_set_status('api_admin', null, 'seed', o1, 'SEARCHING_BY_HUMAN', 'Customer asked for more options', 'TEST Staff');
  perform public.co_add_note('api_admin', null, 'seed', o1, 'TEST note: customer prefers evening calls.');

  -- 2. interested in paying, nothing paid
  o2 := (public.co_create_order('api_agent', null, 'seed', jsonb_build_object(
    'customer_name', 'TEST Karim Hossain', 'customer_phone', '01700000002', 'source', 'messenger',
    'area', 'Uttara Sector 7', 'rooms', 3, 'budget_max', 25000, 'tenant_type', 'family'),
    'seed-2', true) -> 'order' ->> 'id')::uuid;
  perform public.co_set_status('api_agent', null, 'seed', o2, 'REQUIREMENTS_COLLECTED', 'Requirements complete');
  perform public.co_set_status('api_agent', null, 'seed', o2, 'PAYMENT_INTERESTED', 'Customer said: bKash number din');

  -- 3. partial payment, unverified
  o3 := (public.co_create_order('api_agent', null, 'seed', jsonb_build_object(
    'customer_name', 'TEST Salma Akter', 'facebook_thread_url', 'https://www.facebook.com/messages/t/test-salma',
    'source', 'lead_generation', 'area', 'Dhanmondi', 'rooms', 1, 'budget_max', 12000, 'tenant_type', 'bachelor'),
    'seed-3', true) -> 'order' ->> 'id')::uuid;
  perform public.co_set_status('api_agent', null, 'seed', o3, 'SEARCHING_BY_AI', 'AI search started');
  perform public.co_record_payment_claim('api_agent', null, 'seed', o3, 200, null, '3456');
end $$;

select order_no, customer_name, status, payment_status, amount_paid, amount_due, payment_verification, listings_found_count
from public.customer_orders_enriched
where created_by_label = 'seed'
order by order_no;

commit;
