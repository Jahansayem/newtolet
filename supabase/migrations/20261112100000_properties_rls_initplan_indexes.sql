-- Admin listing queries: evaluate the RLS helpers once per statement and give
-- the admin list an index that matches its sort order.
--
-- Why (EXPLAIN ANALYZE on the VPS, 2026-11-12, admin role, RLS on):
--   * public.is_current_user_admin() is SECURITY DEFINER, so Postgres cannot
--     inline it and called it once per row: 4,512 times for the approved list
--     and another 11,832 times inside the property_images policy (1.88 s).
--   * The list orders by created_at DESC NULLS LAST, id. The existing
--     (status, created_at DESC) index is NULLS FIRST, so every matching row was
--     read, joined to its images and sorted before LIMIT 20.
--
-- What changes: the same predicates, for the same roles and commands, with
-- auth.uid() and is_current_user_admin() wrapped in a scalar sub-select. A
-- sub-select that does not reference the row is planned as an InitPlan and
-- computed once. No rule is added, removed or widened.
--
-- Apply:
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < supabase/migrations/20261112100000_properties_rls_initplan_indexes.sql
-- Rollback: scripts/deploy/supabase-selfhost/rollback-properties-rls-initplan.sql

begin;

-- properties -----------------------------------------------------------------

alter policy "Users can read own properties or admin can read all" on public.properties
  using (((select auth.uid()) = user_id) or (select public.is_current_user_admin()));

alter policy "Users can insert own properties" on public.properties
  with check (((select auth.uid()) = user_id) or (select public.is_current_user_admin()));

alter policy "Users can update own properties or admin can update all" on public.properties
  using (((select auth.uid()) = user_id) or (select public.is_current_user_admin()))
  with check (((select auth.uid()) = user_id) or (select public.is_current_user_admin()));

alter policy "Users can delete own properties or admin can delete all" on public.properties
  using (((select auth.uid()) = user_id) or (select public.is_current_user_admin()));

-- property_images ------------------------------------------------------------

alter policy "Public can read approved property images" on public.property_images
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_images.property_id
        and p.status = 'approved'
        and p.is_active is not false
    )
    or exists (
      select 1
      from public.properties p
      where p.id = property_images.property_id
        and (p.user_id = (select auth.uid()) or (select public.is_current_user_admin()))
    )
  );

alter policy "Users can manage images for own properties" on public.property_images
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_images.property_id
        and (p.user_id = (select auth.uid()) or (select public.is_current_user_admin()))
    )
  )
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = property_images.property_id
        and (p.user_id = (select auth.uid()) or (select public.is_current_user_admin()))
    )
  );

-- indexes --------------------------------------------------------------------
-- Live (not soft-deleted) listings in the admin list order. The status-leading
-- index serves the Pending / Approved / Rejected tabs and their counts; the
-- second serves the All tab.

create index if not exists idx_properties_live_status_recent
  on public.properties (status, created_at desc nulls last, id)
  where deleted_at is null;

create index if not exists idx_properties_live_recent
  on public.properties (created_at desc nulls last, id)
  where deleted_at is null;

analyze public.properties;

commit;
