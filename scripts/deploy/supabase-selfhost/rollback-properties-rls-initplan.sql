-- Rollback for supabase/migrations/20261112100000_properties_rls_initplan_indexes.sql
-- Restores the policy definitions exactly as pg_policies reported them on the
-- VPS on 2026-11-12 (before the migration) and drops the two indexes.
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/rollback-properties-rls-initplan.sql

begin;

alter policy "Users can read own properties or admin can read all" on public.properties
  using ((auth.uid() = user_id) or public.is_current_user_admin());

alter policy "Users can insert own properties" on public.properties
  with check ((auth.uid() = user_id) or public.is_current_user_admin());

alter policy "Users can update own properties or admin can update all" on public.properties
  using ((auth.uid() = user_id) or public.is_current_user_admin())
  with check ((auth.uid() = user_id) or public.is_current_user_admin());

alter policy "Users can delete own properties or admin can delete all" on public.properties
  using ((auth.uid() = user_id) or public.is_current_user_admin());

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
        and (p.user_id = (select auth.uid()) or public.is_current_user_admin())
    )
  );

alter policy "Users can manage images for own properties" on public.property_images
  using (
    exists (
      select 1
      from public.properties p
      where p.id = property_images.property_id
        and (p.user_id = (select auth.uid()) or public.is_current_user_admin())
    )
  )
  with check (
    exists (
      select 1
      from public.properties p
      where p.id = property_images.property_id
        and (p.user_id = (select auth.uid()) or public.is_current_user_admin())
    )
  );

drop index if exists public.idx_properties_live_status_recent;
drop index if exists public.idx_properties_live_recent;

commit;
