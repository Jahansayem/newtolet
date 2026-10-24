-- Admin suite, Stage 3 follow-up: privileged writes go through the admin_* RPCs only.
--
-- Prerequisite: the Stage 3 client (AdminPropertiesSection, RPC-backed users /
-- payments / orders / inquiries / feedback sections) must be LIVE before this is
-- applied, because it removes the row-level policies the old admin UI used for
-- direct UPDATE / DELETE statements. SECURITY DEFINER RPCs run as the table
-- owner (postgres), so `current_user <> 'authenticated'` inside them and the
-- triggers below let them through; the browser's `authenticated` role is what
-- gets fenced in.
--
-- Apply (user runs with `!`):
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < supabase/migrations/20261101090000_lock_admin_direct_writes.sql
-- Dry run with the assertion suite first:
--   bash scripts/deploy/supabase-selfhost/run-rls-tests.sh HOST --dry-run-lockdown
-- Revert: scripts/deploy/supabase-selfhost/rollback-lock-admin-direct-writes.sql

begin;

-- ---------------------------------------------------------------------------
-- 1. users: no admin UPDATE policy. Own-row edits (allow_update_own) stay and
--    trg_users_prevent_privileged_changes still guards is_admin / is_employee /
--    is_active / credits / role on them.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can update all users" on public.users;

-- ---------------------------------------------------------------------------
-- 2. properties: owners and admins keep the row-level UPDATE policy for ordinary
--    edits, but moderation columns only change in owner context (RPCs). The one
--    exception an owner needs: editing a listing sends it back to 'pending'.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_direct_property_moderation_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.status is distinct from old.status
     and not (auth.uid() = old.user_id and new.status = 'pending') then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_PERMISSION_DENIED: Listing status changes only through the moderation queue.';
  end if;
  if new.is_featured is distinct from old.is_featured then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_PERMISSION_DENIED: The featured flag changes only through the moderation queue.';
  end if;
  if new.reviewed_by is distinct from old.reviewed_by
     or new.moderation_reason is distinct from old.moderation_reason
     or new.internal_note is distinct from old.internal_note
     or new.deleted_at is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_PERMISSION_DENIED: Moderation fields change only through the moderation queue.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_properties_prevent_direct_moderation on public.properties;
create trigger trg_properties_prevent_direct_moderation
  before update on public.properties
  for each row execute function public.prevent_direct_property_moderation_changes();

-- Listings are soft-deleted by admins (admin_soft_delete_property); only the
-- owner may still hard-delete their own listing from the user panel.
drop policy if exists "Users can delete own properties or admin can delete all" on public.properties;
drop policy if exists properties_owner_delete on public.properties;
create policy properties_owner_delete on public.properties for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. payment_transactions: approve / reject / refund only via RPC
--    (admin_approve_payment, admin_review_payment, admin_refund_payment) or the
--    service-role Edge Function. Owners keep payment_transactions_owner_cancel_pending.
-- ---------------------------------------------------------------------------
drop policy if exists payment_transactions_admin_update on public.payment_transactions;

-- ---------------------------------------------------------------------------
-- 4. user_blacklist: admin_blacklist_user / admin_unblacklist_user only.
--    user_blacklist_admin_read stays for the Users section.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can manage blacklist" on public.user_blacklist;

-- ---------------------------------------------------------------------------
-- 5. feedback / orders / property_inquiries: review, status, assignment and
--    archive run through admin_review_feedback, admin_archive_feedback,
--    admin_set_order_status, admin_set_order_job_feed, admin_set_order_assignee,
--    admin_archive_order, admin_set_inquiry, admin_archive_inquiry. Rows are
--    archived, never deleted, so the DELETE policies go too.
-- ---------------------------------------------------------------------------
drop policy if exists feedback_admin_update on public.feedback;
drop policy if exists feedback_admin_delete on public.feedback;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Admins can delete orders" on public.orders;
drop policy if exists property_inquiries_admin_update on public.property_inquiries;
drop policy if exists property_inquiries_admin_delete on public.property_inquiries;

-- ---------------------------------------------------------------------------
-- 6. Assertions: none of the removed policies may still exist, and no
--    non-SELECT policy on these tables may grant `authenticated` a write just
--    for being an admin.
-- ---------------------------------------------------------------------------
do $$
declare
  v text;
begin
  select string_agg(tablename || '.' || policyname, ', ')
    into v
  from pg_policies
  where schemaname = 'public'
    and (tablename, policyname) in (
      ('users', 'Admins can update all users'),
      ('properties', 'Users can delete own properties or admin can delete all'),
      ('payment_transactions', 'payment_transactions_admin_update'),
      ('user_blacklist', 'Admins can manage blacklist'),
      ('feedback', 'feedback_admin_update'),
      ('feedback', 'feedback_admin_delete'),
      ('orders', 'Admins can update orders'),
      ('orders', 'Admins can delete orders'),
      ('property_inquiries', 'property_inquiries_admin_update'),
      ('property_inquiries', 'property_inquiries_admin_delete'));
  if v is not null then
    raise exception 'lock_admin_direct_writes: policies still present: %', v;
  end if;

  select string_agg(tablename || '.' || policyname || ' (' || cmd || ')', ', ')
    into v
  from pg_policies
  where schemaname = 'public'
    and tablename in ('users', 'payment_transactions', 'user_blacklist', 'feedback', 'orders', 'property_inquiries')
    and cmd in ('UPDATE', 'DELETE', 'ALL')
    and (coalesce(qual, '') ~ 'admin_has_permission|is_current_user_admin'
         or coalesce(with_check, '') ~ 'admin_has_permission|is_current_user_admin');
  if v is not null then
    raise exception 'lock_admin_direct_writes: admin write policies remain: %', v;
  end if;

  if to_regproc('public.prevent_direct_property_moderation_changes') is null then
    raise exception 'lock_admin_direct_writes: properties trigger function missing';
  end if;
end $$;

select 'LOCK_ADMIN_DIRECT_WRITES_DONE';

commit;
