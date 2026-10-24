-- Revert of supabase/migrations/20261101090000_lock_admin_direct_writes.sql.
-- Restores the Stage 1 (20261025090000) admin write policies verbatim and
-- removes the properties moderation trigger. Use only if the Stage 3 client
-- has to be rolled back to a release that still writes these tables directly.
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/rollback-lock-admin-direct-writes.sql

begin;

drop trigger if exists trg_properties_prevent_direct_moderation on public.properties;
drop function if exists public.prevent_direct_property_moderation_changes();

drop policy if exists properties_owner_delete on public.properties;
drop policy if exists "Users can delete own properties or admin can delete all" on public.properties;
create policy "Users can delete own properties or admin can delete all" on public.properties for delete to authenticated
  using ((auth.uid() = user_id) or public.is_current_user_admin());

drop policy if exists "Admins can update all users" on public.users;
create policy "Admins can update all users" on public.users for update to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());

drop policy if exists payment_transactions_admin_update on public.payment_transactions;
create policy payment_transactions_admin_update on public.payment_transactions for update to authenticated
  using (public.admin_has_permission('payments.review')) with check (public.admin_has_permission('payments.review'));

drop policy if exists "Admins can manage blacklist" on public.user_blacklist;
create policy "Admins can manage blacklist" on public.user_blacklist for all to authenticated
  using (public.admin_has_permission('users.moderate')) with check (public.admin_has_permission('users.moderate'));

drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback for update to authenticated
  using (public.admin_has_permission('feedback.review')) with check (public.admin_has_permission('feedback.review'));
drop policy if exists feedback_admin_delete on public.feedback;
create policy feedback_admin_delete on public.feedback for delete to authenticated
  using (public.admin_has_permission('feedback.review'));

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders for update to authenticated
  using (public.admin_has_permission('orders.manage')) with check (public.admin_has_permission('orders.manage'));
drop policy if exists "Admins can delete orders" on public.orders;
create policy "Admins can delete orders" on public.orders for delete to authenticated
  using (public.admin_has_permission('orders.manage'));

drop policy if exists property_inquiries_admin_update on public.property_inquiries;
create policy property_inquiries_admin_update on public.property_inquiries for update to authenticated
  using (public.admin_has_permission('inquiries.manage')) with check (public.admin_has_permission('inquiries.manage'));
drop policy if exists property_inquiries_admin_delete on public.property_inquiries;
create policy property_inquiries_admin_delete on public.property_inquiries for delete to authenticated
  using (public.admin_has_permission('inquiries.manage'));

select 'LOCK_ADMIN_DIRECT_WRITES_ROLLED_BACK';

commit;
