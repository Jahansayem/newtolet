-- Undo only the backfill of 20261025090000_admin_roles_audit_rpcs.sql.
-- Legacy users.is_admin flags are untouched (the migration never writes them
-- during backfill), so is_current_user_admin() / admin_has_permission() fall
-- back to the legacy branch and every is_admin user keeps full access.
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/rollback-admin-memberships.sql

begin;
delete from public.admin_memberships where source = 'backfill';
select 'remaining memberships: ' || count(*) from public.admin_memberships;
commit;
