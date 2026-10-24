-- Admin suite release 1 / stage 1: role memberships, permission matrix,
-- append-only audit log, actor-safe admin RPCs, and RLS hardening.
--
-- Written against the deployed schema snapshot in claudedocs/db/*-20261024.*
-- (self-hosted Supabase, PostgreSQL 17, tables owned by `postgres`).
-- Apply with scripts/deploy/supabase-selfhost/apply-admin-migration.sh, which
-- runs this file as `postgres` inside one transaction with ON_ERROR_STOP=1.
-- Idempotent: every statement is IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS.
--
-- Facts this file relies on (see data-facts-20261024.txt):
--   * users: no is_employee column; role text not null default 'tenant'
--   * feedback: no is_resolved / email columns; status free text
--   * properties: status free text, is_active + deactivated_at soft delete,
--     triggers award_listing_points_on_approval / on_property_status_change
--   * every public table grants ALL to anon + authenticated (RLS is the guard)
--   * credit_transactions, photo_views, user_orders, storage_config_note,
--     storage_policies_config have RLS OFF
--   * every SECURITY DEFINER function has the default PUBLIC execute grant
--   * contact_unlock_refund_requests is created by the earlier
--     20260411193000_unlock_refund_parity.sql (apply it first if missing)

begin;

-- ---------------------------------------------------------------------------
-- 0. Columns the application already expects but the deployed schema lacks
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists is_employee boolean not null default false;

alter table public.feedback add column if not exists is_resolved boolean not null default false;
alter table public.feedback add column if not exists is_public boolean not null default true;
alter table public.feedback add column if not exists rejection_reason text;
alter table public.feedback add column if not exists archived_at timestamptz;
alter table public.feedback add column if not exists archived_by uuid references public.users(id) on delete set null;

alter table public.properties add column if not exists reviewed_by uuid references public.users(id) on delete set null;
alter table public.properties add column if not exists moderation_reason text;
alter table public.properties add column if not exists internal_note text;
alter table public.properties add column if not exists deleted_at timestamptz;
alter table public.properties add column if not exists deleted_by uuid references public.users(id) on delete set null;
-- Digits-only, last 11 characters: identical to normalizePhoneForDuplicateKey()
-- in the client, so duplicate detection can be an indexed equality instead of
-- a whole-table scan.
alter table public.properties add column if not exists contact_phone_key text
  generated always as (nullif(right(regexp_replace(coalesce(contact_number, ''), '\D', '', 'g'), 11), '')) stored;

alter table public.orders add column if not exists admin_note text;
alter table public.orders add column if not exists assigned_to uuid references public.users(id) on delete set null;
alter table public.orders add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists archived_by uuid references public.users(id) on delete set null;

alter table public.property_inquiries add column if not exists assigned_to uuid references public.users(id) on delete set null;
alter table public.property_inquiries add column if not exists follow_up_at timestamptz;
alter table public.property_inquiries add column if not exists admin_note text;
alter table public.property_inquiries add column if not exists archived_at timestamptz;
alter table public.property_inquiries add column if not exists archived_by uuid references public.users(id) on delete set null;

alter table public.payment_transactions add column if not exists rejected_at timestamptz;
alter table public.payment_transactions add column if not exists rejected_by uuid references public.users(id) on delete set null;
alter table public.payment_transactions add column if not exists review_note text;
alter table public.payment_transactions add column if not exists refunded_at timestamptz;
alter table public.payment_transactions add column if not exists refunded_by uuid references public.users(id) on delete set null;

alter table public.user_blacklist add column if not exists lifted_at timestamptz;
alter table public.user_blacklist add column if not exists lifted_by uuid references public.users(id) on delete set null;
alter table public.user_blacklist add column if not exists lift_note text;

alter table public.site_settings add column if not exists maintenance_mode boolean not null default false;
alter table public.site_settings add column if not exists contact_info jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists featured_property_ids uuid[] not null default '{}'::uuid[];

-- Feedback status values: add the constraint without validating old rows first,
-- then validate; a dirty legacy row then fails the migration loudly instead of
-- being silently accepted.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'feedback_status_check') then
    alter table public.feedback
      add constraint feedback_status_check check (status in ('pending', 'approved', 'rejected')) not valid;
    alter table public.feedback validate constraint feedback_status_check;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Indexes for admin list views
-- ---------------------------------------------------------------------------
create index if not exists idx_properties_status_created_at on public.properties (status, created_at desc);
create index if not exists idx_properties_active_status on public.properties (is_active, status);
create index if not exists idx_properties_contact_phone_key on public.properties (contact_phone_key) where contact_phone_key is not null;
create index if not exists idx_payment_transactions_status_created_at on public.payment_transactions (status, created_at desc);
create index if not exists idx_feedback_status_created_at on public.feedback (status, created_at desc);
create index if not exists idx_orders_status_created_at on public.orders (status, created_at desc);
create unique index if not exists uq_user_blacklist_active on public.user_blacklist (user_id) where lifted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Roles, permission matrix, status transitions
-- ---------------------------------------------------------------------------
create table if not exists public.admin_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'moderator', 'finance', 'support', 'content_manager')),
  is_active boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'backfill')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  unique (user_id, role)
);
create index if not exists idx_admin_memberships_user_active on public.admin_memberships (user_id) where is_active;

drop trigger if exists trg_admin_memberships_set_updated_at on public.admin_memberships;
create trigger trg_admin_memberships_set_updated_at
  before update on public.admin_memberships
  for each row execute function public.set_updated_at();

create table if not exists public.admin_role_permissions (
  role text not null,
  permission text not null,
  primary key (role, permission)
);

-- Keep identical to ROLE_PERMISSIONS in src/lib/adminPermissions.js.
insert into public.admin_role_permissions (role, permission) values
  ('super_admin', 'dashboard.view'), ('super_admin', 'users.view'), ('super_admin', 'users.moderate'),
  ('super_admin', 'users.manage_roles'), ('super_admin', 'users.manage_employee'), ('super_admin', 'properties.view'),
  ('super_admin', 'properties.moderate'), ('super_admin', 'properties.feature'), ('super_admin', 'payments.view'),
  ('super_admin', 'payments.review'), ('super_admin', 'credits.adjust'), ('super_admin', 'pricing.manage'),
  ('super_admin', 'refunds.review'), ('super_admin', 'orders.manage'), ('super_admin', 'inquiries.manage'),
  ('super_admin', 'feedback.review'), ('super_admin', 'content.manage'), ('super_admin', 'settings.manage'),
  ('super_admin', 'audit.view'),
  ('moderator', 'dashboard.view'), ('moderator', 'users.view'), ('moderator', 'users.moderate'),
  ('moderator', 'users.manage_employee'), ('moderator', 'properties.view'), ('moderator', 'properties.moderate'),
  ('moderator', 'properties.feature'), ('moderator', 'orders.manage'), ('moderator', 'inquiries.manage'),
  ('moderator', 'feedback.review'),
  ('finance', 'dashboard.view'), ('finance', 'users.view'), ('finance', 'payments.view'), ('finance', 'payments.review'),
  ('finance', 'credits.adjust'), ('finance', 'pricing.manage'), ('finance', 'refunds.review'), ('finance', 'orders.manage'),
  ('support', 'dashboard.view'), ('support', 'users.view'), ('support', 'properties.view'), ('support', 'payments.view'),
  ('support', 'orders.manage'), ('support', 'inquiries.manage'), ('support', 'feedback.review'),
  ('content_manager', 'dashboard.view'), ('content_manager', 'properties.view'), ('content_manager', 'properties.feature'),
  ('content_manager', 'feedback.review'), ('content_manager', 'content.manage')
on conflict do nothing;

create table if not exists public.admin_status_transitions (
  entity_type text not null,
  from_status text not null,
  to_status text not null,
  primary key (entity_type, from_status, to_status)
);

-- Keep identical to ADMIN_STATUS_TRANSITIONS in src/lib/adminStatusTransitions.js.
insert into public.admin_status_transitions (entity_type, from_status, to_status) values
  ('property', 'pending', 'approved'), ('property', 'pending', 'rejected'),
  ('property', 'approved', 'rejected'), ('property', 'approved', 'pending'),
  ('property', 'rejected', 'approved'), ('property', 'rejected', 'pending'),
  ('payment', 'pending', 'awaiting_admin_approval'), ('payment', 'pending', 'failed'), ('payment', 'pending', 'cancelled'),
  ('payment', 'awaiting_admin_approval', 'credited'), ('payment', 'awaiting_admin_approval', 'failed'),
  ('payment', 'awaiting_admin_approval', 'cancelled'), ('payment', 'crediting', 'credited'), ('payment', 'crediting', 'failed'),
  ('payment', 'credited', 'refunded'), ('payment', 'failed', 'pending'),
  ('order', 'pending_payment', 'pending'), ('order', 'pending_payment', 'cancelled'),
  ('order', 'pending', 'confirmed'), ('order', 'pending', 'cancelled'),
  ('order', 'confirmed', 'completed'), ('order', 'confirmed', 'cancelled'), ('order', 'cancelled', 'pending'),
  ('inquiry', 'pending', 'contacted'), ('inquiry', 'pending', 'resolved'), ('inquiry', 'pending', 'closed'),
  ('inquiry', 'contacted', 'resolved'), ('inquiry', 'contacted', 'closed'), ('inquiry', 'contacted', 'pending'),
  ('inquiry', 'resolved', 'closed'), ('inquiry', 'resolved', 'contacted'), ('inquiry', 'closed', 'pending'),
  ('feedback', 'pending', 'approved'), ('feedback', 'pending', 'rejected'),
  ('feedback', 'approved', 'rejected'), ('feedback', 'rejected', 'approved'),
  ('refund', 'requested', 'approved'), ('refund', 'requested', 'rejected'),
  ('withdrawal', 'requested', 'approved'), ('withdrawal', 'requested', 'rejected'),
  ('withdrawal', 'approved', 'paid'), ('withdrawal', 'approved', 'rejected')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.users(id) on delete set null,
  actor_roles text[] not null default '{}',
  action text not null,
  entity_type text not null,
  entity_id text,
  reason text,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_log_created_at on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_entity on public.admin_audit_log (entity_type, entity_id);
create index if not exists idx_admin_audit_log_actor on public.admin_audit_log (actor_id, created_at desc);

create or replace function public.admin_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = 'P0001', message = 'ADMIN_CONFLICT: admin_audit_log is append-only';
end;
$$;

drop trigger if exists trg_admin_audit_log_immutable on public.admin_audit_log;
create trigger trg_admin_audit_log_immutable
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_immutable();

create table if not exists public.credit_pricing_versions (
  id bigint generated always as identity primary key,
  snapshot jsonb not null,
  note text,
  published_by uuid references public.users(id) on delete set null,
  published_at timestamptz not null default now(),
  is_rollback_of bigint references public.credit_pricing_versions(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- 4. Authorization helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_admin_roles()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.role order by m.role), '{}'::text[])
  from public.admin_memberships m
  join public.users u on u.id = m.user_id
  where m.user_id = auth.uid()
    and m.is_active
    and coalesce(u.is_active, true);
$$;

-- "Is staff": any active membership, or the legacy users.is_admin flag.
-- Every existing read policy calls this, so it must stay coarse.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and coalesce(u.is_active, true)
      and (
        coalesce(u.is_admin, false)
        or exists (
          select 1 from public.admin_memberships m
          where m.user_id = u.id and m.is_active
        )
      )
  );
$$;

-- Fine-grained check. A legacy admin with NO membership rows at all keeps full
-- access (so a half-applied backfill never locks anyone out); once a user has
-- any membership row only the matrix counts.
create or replace function public.admin_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.admin_memberships m
      join public.admin_role_permissions rp on rp.role = m.role
      join public.users u on u.id = m.user_id
      where m.user_id = auth.uid()
        and m.is_active
        and coalesce(u.is_active, true)
        and rp.permission = p_permission
    )
    or exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and coalesce(u.is_admin, false)
        and coalesce(u.is_active, true)
        and not exists (select 1 from public.admin_memberships m where m.user_id = u.id)
    );
$$;

create or replace function public.assert_admin_permission(p_permission text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Authentication required.';
  end if;
  if not public.admin_has_permission(p_permission) then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_PERMISSION_DENIED: You do not have the %s permission.', p_permission),
      hint = format('permission=%s', p_permission);
  end if;
  return v_actor;
end;
$$;

create or replace function public.assert_admin_transition(p_entity text, p_from text, p_to text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_from is not distinct from p_to then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: The %s is already %s.', p_entity, coalesce(p_to, 'unset')),
      hint = format('entity=%s;from=%s;to=%s', p_entity, coalesce(p_from, ''), coalesce(p_to, ''));
  end if;
  if not exists (
    select 1 from public.admin_status_transitions t
    where t.entity_type = p_entity and t.from_status = coalesce(p_from, '') and t.to_status = p_to
  ) then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: A %s cannot move from %s to %s.', p_entity, coalesce(p_from, 'unset'), p_to),
      hint = format('entity=%s;from=%s;to=%s', p_entity, coalesce(p_from, ''), p_to);
  end if;
end;
$$;

create or replace function public.log_admin_action(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_reason text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.admin_audit_log (actor_id, actor_roles, action, entity_type, entity_id, reason, before, after, metadata)
  values (auth.uid(), public.current_admin_roles(), p_action, p_entity_type, p_entity_id, nullif(trim(p_reason), ''), p_before, p_after, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.get_my_admin_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'is_active', coalesce((select u.is_active from public.users u where u.id = auth.uid()), false),
    'is_admin', coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false),
    'roles', to_jsonb(public.current_admin_roles()),
    'legacy_admin', exists (
      select 1 from public.users u
      where u.id = auth.uid() and coalesce(u.is_admin, false)
        and not exists (select 1 from public.admin_memberships m where m.user_id = u.id)
    ),
    'permissions', (
      select coalesce(jsonb_agg(distinct p.permission), '[]'::jsonb)
      from (
        select rp.permission
        from public.admin_memberships m
        join public.admin_role_permissions rp on rp.role = m.role
        where m.user_id = auth.uid() and m.is_active
        union all
        select rp.permission
        from public.admin_role_permissions rp
        where rp.role = 'super_admin'
          and exists (
            select 1 from public.users u
            where u.id = auth.uid() and coalesce(u.is_admin, false)
              and not exists (select 1 from public.admin_memberships m where m.user_id = u.id)
          )
      ) p
    ),
    'capabilities', (
      select coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'admin\_%'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Protect privileged user columns from self-service edits
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user must be the caller's role. Inside a
-- SECURITY DEFINER RPC it is the owner (postgres); from PostgREST it is
-- `authenticated` or `service_role`.
create or replace function public.prevent_privileged_user_column_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- service_role, postgres and SECURITY DEFINER functions (owner context) pass.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.is_admin is distinct from old.is_admin and not public.admin_has_permission('users.manage_roles') then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Only a super admin can change admin status.';
  end if;
  if new.is_employee is distinct from old.is_employee and not public.admin_has_permission('users.manage_employee') then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: You cannot change the employee flag.';
  end if;
  if new.is_active is distinct from old.is_active and not public.admin_has_permission('users.moderate') then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: You cannot change account status.';
  end if;
  if new.credits is distinct from old.credits and not public.admin_has_permission('credits.adjust') then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Credits can only be changed by finance.';
  end if;
  if new.role is distinct from old.role and auth.uid() is distinct from new.id and not public.admin_has_permission('users.moderate') then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: You cannot change another user''s role.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_prevent_privileged_changes on public.users;
create trigger trg_users_prevent_privileged_changes
  before update on public.users
  for each row execute function public.prevent_privileged_user_column_changes();

-- ---------------------------------------------------------------------------
-- 6. Admin RPCs (actor = auth.uid(); permission + transition checked here)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_property_status(
  p_property_ids uuid[],
  p_status text,
  p_reason text default null,
  p_internal_note text default null,
  p_from_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('properties.moderate');
  v_ids uuid[];
  v_row public.properties%rowtype;
  v_rows jsonb := '[]'::jsonb;
  v_audit_ids bigint[] := '{}';
  v_audit_id bigint;
  v_id uuid;
  v_before_status text;
begin
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Unknown property status %s.', p_status);
  end if;
  if p_status = 'rejected' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required when rejecting a listing.';
  end if;

  if p_property_ids is null or cardinality(p_property_ids) = 0 then
    if p_from_status is null then
      raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Provide property ids or a from-status.';
    end if;
    select coalesce(array_agg(id), '{}') into v_ids
    from public.properties
    where status = p_from_status and coalesce(is_active, true);
  else
    v_ids := p_property_ids;
  end if;

  if cardinality(v_ids) > 500 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: At most 500 listings can be updated at once.';
  end if;

  foreach v_id in array v_ids loop
    select * into v_row from public.properties where id = v_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = format('ADMIN_NOT_FOUND: Listing %s was not found.', v_id);
    end if;
    if v_row.status is not distinct from p_status then
      continue;
    end if;
    perform public.assert_admin_transition('property', v_row.status, p_status);
    v_before_status := v_row.status;

    update public.properties
    set status = p_status,
        reviewed_at = now(),
        reviewed_by = v_actor,
        moderation_reason = nullif(trim(coalesce(p_reason, '')), ''),
        internal_note = coalesce(nullif(trim(coalesce(p_internal_note, '')), ''), internal_note),
        updated_at = now()
    where id = v_id
    returning * into v_row;

    v_audit_id := public.log_admin_action(
      'property.set_status', 'property', v_id::text, p_reason,
      jsonb_build_object('status', v_before_status),
      jsonb_build_object('status', p_status, 'reviewed_by', v_actor),
      jsonb_build_object('bulk_size', cardinality(v_ids), 'internal_note', p_internal_note)
    );
    v_audit_ids := v_audit_ids || v_audit_id;
    v_rows := v_rows || to_jsonb(v_row);
  end loop;

  return jsonb_build_object('rows', v_rows, 'count', jsonb_array_length(v_rows), 'audit_id', v_audit_id, 'audit_ids', to_jsonb(v_audit_ids));
end;
$$;

create or replace function public.admin_set_property_featured(p_property_id uuid, p_is_featured boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('properties.feature');
  v_before boolean;
  v_row public.properties%rowtype;
  v_audit_id bigint;
begin
  select is_featured into v_before from public.properties where id = p_property_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Listing was not found.';
  end if;
  update public.properties set is_featured = p_is_featured, updated_at = now() where id = p_property_id returning * into v_row;
  v_audit_id := public.log_admin_action('property.set_featured', 'property', p_property_id::text, null,
    jsonb_build_object('is_featured', v_before), jsonb_build_object('is_featured', p_is_featured));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_soft_delete_property(p_property_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('properties.moderate');
  v_row public.properties%rowtype;
  v_audit_id bigint;
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required to remove a listing.';
  end if;
  select * into v_row from public.properties where id = p_property_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Listing was not found.';
  end if;
  update public.properties
  set is_active = false, deactivated_at = coalesce(deactivated_at, now()), deleted_at = now(), deleted_by = v_actor, updated_at = now()
  where id = p_property_id returning * into v_row;
  v_audit_id := public.log_admin_action('property.soft_delete', 'property', p_property_id::text, p_reason,
    jsonb_build_object('is_active', true), jsonb_build_object('is_active', false, 'deleted_by', v_actor));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_phone_key_counts(p_keys text[])
returns table(phone_key text, property_count bigint, pending_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.contact_phone_key, count(*)::bigint, count(*) filter (where p.status = 'pending')::bigint
  from public.properties p
  where public.admin_has_permission('properties.view')
    and p.contact_phone_key = any (p_keys)
  group by p.contact_phone_key;
$$;

create or replace function public.admin_duplicate_phone_groups(p_status text default null, p_limit int default 20, p_offset int default 0)
returns table(phone_key text, property_count bigint, pending_count bigint, latest_created_at timestamp, latest_property_id uuid, total_groups bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission('properties.view');
  if p_limit < 1 or p_limit > 100 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: limit must be between 1 and 100.';
  end if;
  return query
  with groups as (
    select p.contact_phone_key as key,
           count(*)::bigint as property_count,
           count(*) filter (where p.status = 'pending')::bigint as pending_count,
           max(p.created_at) as latest_created_at,
           (array_agg(p.id order by p.created_at desc))[1] as latest_property_id
    from public.properties p
    where p.contact_phone_key is not null and coalesce(p.is_active, true)
    group by p.contact_phone_key
    having count(*) > 1
       and (p_status is null or count(*) filter (where p.status = p_status) > 0)
  )
  select g.key, g.property_count, g.pending_count, g.latest_created_at, g.latest_property_id, count(*) over ()::bigint
  from groups g
  order by g.latest_created_at desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.admin_blacklist_user(
  p_user_id uuid,
  p_reason text,
  p_notes text default null,
  p_is_permanent boolean default true,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('users.moderate');
  v_target public.users%rowtype;
  v_row public.user_blacklist%rowtype;
  v_audit_id bigint;
begin
  if p_user_id = v_actor then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: You cannot blacklist your own account.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required.';
  end if;
  if not p_is_permanent and (p_expires_at is null or p_expires_at <= now()) then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A temporary blacklist needs a future expiry date.';
  end if;
  select * into v_target from public.users where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: User was not found.';
  end if;
  if exists (select 1 from public.admin_memberships m where m.user_id = p_user_id and m.role = 'super_admin' and m.is_active)
     and not ('super_admin' = any (public.current_admin_roles())) then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Only a super admin can blacklist another super admin.';
  end if;
  if exists (select 1 from public.user_blacklist b where b.user_id = p_user_id and b.lifted_at is null) then
    raise exception using errcode = 'P0001', message = 'ADMIN_CONFLICT: This user is already blacklisted.';
  end if;

  insert into public.user_blacklist (user_id, reason, blacklisted_by, notes, is_permanent, expires_at)
  values (p_user_id, trim(p_reason), v_actor, nullif(trim(coalesce(p_notes, '')), ''), p_is_permanent, case when p_is_permanent then null else p_expires_at end)
  returning * into v_row;

  update public.users set is_active = false, updated_at = now() where id = p_user_id;

  v_audit_id := public.log_admin_action('user.blacklist', 'user', p_user_id::text, p_reason,
    jsonb_build_object('is_active', v_target.is_active),
    jsonb_build_object('is_active', false, 'blacklist_id', v_row.id, 'is_permanent', p_is_permanent, 'expires_at', v_row.expires_at),
    jsonb_build_object('notes', p_notes));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_unblacklist_user(p_user_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('users.moderate');
  v_row public.user_blacklist%rowtype;
  v_audit_id bigint;
begin
  update public.user_blacklist
  set lifted_at = now(), lifted_by = v_actor, lift_note = nullif(trim(coalesce(p_note, '')), '')
  where user_id = p_user_id and lifted_at is null
  returning * into v_row;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: This user has no active blacklist entry.';
  end if;
  update public.users set is_active = true, updated_at = now() where id = p_user_id;
  v_audit_id := public.log_admin_action('user.unblacklist', 'user', p_user_id::text, p_note,
    jsonb_build_object('is_active', false, 'blacklist_id', v_row.id), jsonb_build_object('is_active', true));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_set_user_active(p_user_id uuid, p_is_active boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('users.moderate');
  v_before boolean;
  v_row public.users%rowtype;
  v_audit_id bigint;
begin
  if p_user_id = v_actor then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: You cannot change your own account status.';
  end if;
  select is_active into v_before from public.users where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: User was not found.';
  end if;
  if not p_is_active
     and exists (select 1 from public.admin_memberships m where m.user_id = p_user_id and m.role = 'super_admin' and m.is_active)
     and not ('super_admin' = any (public.current_admin_roles())) then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Only a super admin can deactivate another super admin.';
  end if;
  update public.users set is_active = p_is_active, updated_at = now() where id = p_user_id returning * into v_row;
  -- Forced session revocation is deferred; RLS/RPC checks reject inactive users on their next request.
  v_audit_id := public.log_admin_action('user.set_active', 'user', p_user_id::text, p_reason,
    jsonb_build_object('is_active', v_before), jsonb_build_object('is_active', p_is_active));
  return jsonb_build_object('row', to_jsonb(v_row) - 'bkash_number' - 'nagad_number', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_set_employee_flag(p_user_id uuid, p_is_employee boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('users.manage_employee');
  v_before boolean;
  v_row public.users%rowtype;
  v_audit_id bigint;
begin
  select is_employee into v_before from public.users where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: User was not found.';
  end if;
  update public.users set is_employee = p_is_employee, updated_at = now() where id = p_user_id returning * into v_row;
  v_audit_id := public.log_admin_action('user.set_employee', 'user', p_user_id::text, null,
    jsonb_build_object('is_employee', v_before), jsonb_build_object('is_employee', p_is_employee));
  return jsonb_build_object('row', to_jsonb(v_row) - 'bkash_number' - 'nagad_number', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_set_user_roles(p_user_id uuid, p_roles text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('users.manage_roles');
  v_roles text[] := coalesce(p_roles, '{}');
  v_before text[];
  v_role text;
  v_audit_id bigint;
  v_rows jsonb;
begin
  if not ('super_admin' = any (public.current_admin_roles()))
     and not exists (select 1 from public.users u where u.id = v_actor and coalesce(u.is_admin, false)
                     and not exists (select 1 from public.admin_memberships m where m.user_id = u.id)) then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Only a super admin can assign roles.';
  end if;
  if exists (select 1 from unnest(v_roles) r where r not in ('super_admin', 'moderator', 'finance', 'support', 'content_manager')) then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Unknown role.';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: User was not found.';
  end if;

  select coalesce(array_agg(role order by role), '{}') into v_before
  from public.admin_memberships where user_id = p_user_id and is_active;

  -- Never remove the last super admin.
  if 'super_admin' = any (v_before) and not ('super_admin' = any (v_roles)) then
    if (select count(*) from public.admin_memberships where role = 'super_admin' and is_active) <= 1 then
      raise exception using errcode = 'P0001', message = 'ADMIN_CONFLICT: Cannot remove the last super admin.';
    end if;
  end if;

  foreach v_role in array v_roles loop
    insert into public.admin_memberships (user_id, role, is_active, source, created_by)
    values (p_user_id, v_role, true, 'manual', v_actor)
    on conflict (user_id, role) do update
      set is_active = true, revoked_at = null, revoked_by = null, updated_at = now();
  end loop;

  update public.admin_memberships
  set is_active = false, revoked_at = now(), revoked_by = v_actor, updated_at = now()
  where user_id = p_user_id and is_active and not (role = any (v_roles));

  update public.users set is_admin = (cardinality(v_roles) > 0), updated_at = now() where id = p_user_id;

  v_audit_id := public.log_admin_action('user.set_roles', 'user', p_user_id::text, null,
    jsonb_build_object('roles', to_jsonb(v_before)), jsonb_build_object('roles', to_jsonb(v_roles)));

  select coalesce(jsonb_agg(to_jsonb(m) order by m.role), '[]'::jsonb) into v_rows
  from public.admin_memberships m where m.user_id = p_user_id and m.is_active;
  return jsonb_build_object('rows', v_rows, 'count', jsonb_array_length(v_rows), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_adjust_user_credits(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_expected_balance integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('credits.adjust');
  v_before integer;
  v_after integer;
  v_ledger_id uuid;
  v_audit_id bigint;
begin
  if p_delta is null or p_delta = 0 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: The adjustment must be a non-zero amount.';
  end if;
  if abs(p_delta) > 100000 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Adjustments above 100,000 credits are not allowed.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required.';
  end if;
  select coalesce(credits, 0) into v_before from public.users where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: User was not found.';
  end if;
  if p_expected_balance is not null and p_expected_balance <> v_before then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_CONFLICT: The balance changed to %s while you were editing.', v_before),
      hint = format('expected=%s;actual=%s', p_expected_balance, v_before);
  end if;
  if v_before + p_delta < 0 then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INSUFFICIENT_CREDITS: The user only has %s credits.', v_before),
      hint = format('balance=%s;delta=%s', v_before, p_delta);
  end if;

  update public.users set credits = v_before + p_delta, updated_at = now() where id = p_user_id returning credits into v_after;

  insert into public.credit_transactions (user_id, credits_deducted, transaction_type, credits_amount, balance_after, reference_type, provider, metadata)
  values (p_user_id, -p_delta, 'admin_adjustment', p_delta, v_after, 'admin_adjustment', 'admin',
          jsonb_build_object('reason', trim(p_reason), 'actor_id', v_actor))
  returning id into v_ledger_id;

  v_audit_id := public.log_admin_action('user.adjust_credits', 'user', p_user_id::text, p_reason,
    jsonb_build_object('credits', v_before), jsonb_build_object('credits', v_after, 'delta', p_delta, 'ledger_id', v_ledger_id));
  return jsonb_build_object(
    'row', jsonb_build_object('user_id', p_user_id, 'credits_before', v_before, 'credits_after', v_after, 'delta', p_delta, 'ledger_id', v_ledger_id),
    'audit_id', v_audit_id);
end;
$$;

-- Hardened: callable by an admin with payments.review for their own id, or by
-- the service role (Edge Function) with any admin id.
create or replace function public.approve_credit_payment_transaction(p_payment_transaction_id uuid, p_admin_id uuid)
returns table(payment_id uuid, transaction_id text, user_id uuid, credits_added integer, balance_after integer, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.payment_transactions%rowtype;
  next_balance integer;
begin
  if auth.uid() is not null then
    perform public.assert_admin_permission('payments.review');
    if p_admin_id is distinct from auth.uid() then
      raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: The admin id must match the signed-in user.';
    end if;
  elsif current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Authentication required.';
  end if;

  select * into payment_record from public.payment_transactions where id = p_payment_transaction_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Payment transaction not found.';
  end if;

  if payment_record.status = 'credited' then
    return query
    select payment_record.id, payment_record.transaction_id, payment_record.user_id,
           coalesce(payment_record.credits_to_add, 0),
           coalesce((select credits from public.users where id = payment_record.user_id), 0),
           payment_record.status;
    return;
  end if;

  if payment_record.status <> 'awaiting_admin_approval' then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: Only payments awaiting approval can be approved (current: %s).', payment_record.status),
      hint = format('entity=payment;from=%s;to=credited', payment_record.status);
  end if;

  update public.users
  set credits = coalesce(credits, 0) + coalesce(payment_record.credits_to_add, 0), updated_at = now()
  where id = payment_record.user_id
  returning credits into next_balance;

  insert into public.credit_transactions (user_id, credits_deducted, transaction_type, credits_amount, balance_after, reference_type, reference_id, provider, metadata, payment_transaction_id)
  values (payment_record.user_id, -coalesce(payment_record.credits_to_add, 0), 'credit_purchase', coalesce(payment_record.credits_to_add, 0), next_balance,
          'payment_transaction', payment_record.id, coalesce(payment_record.provider, 'eps'),
          jsonb_build_object('invoice_id', coalesce(payment_record.invoice_id, payment_record.reference), 'approved_by', p_admin_id),
          payment_record.transaction_id);

  update public.payment_transactions
  set status = 'credited', approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, p_admin_id),
      credited_at = now(), credited_by = p_admin_id, updated_at = now()
  where id = payment_record.id;

  perform public.log_admin_action('payment.approve', 'payment', payment_record.id::text, null,
    jsonb_build_object('status', payment_record.status),
    jsonb_build_object('status', 'credited', 'credits_added', coalesce(payment_record.credits_to_add, 0), 'balance_after', next_balance),
    jsonb_build_object('via', case when auth.uid() is null then current_user else 'rpc' end, 'admin_id', p_admin_id));

  return query
  select payment_record.id, payment_record.transaction_id, payment_record.user_id, coalesce(payment_record.credits_to_add, 0), next_balance, 'credited'::text;
end;
$$;

create or replace function public.admin_approve_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('payments.review');
  v_result record;
  v_row public.payment_transactions%rowtype;
  v_audit_id bigint;
begin
  select * into v_result from public.approve_credit_payment_transaction(p_payment_id, v_actor);
  select * into v_row from public.payment_transactions where id = p_payment_id;
  select max(id) into v_audit_id from public.admin_audit_log where entity_type = 'payment' and entity_id = p_payment_id::text and action = 'payment.approve';
  return jsonb_build_object('row', to_jsonb(v_row), 'credits_added', v_result.credits_added, 'balance_after', v_result.balance_after, 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_review_payment(p_payment_id uuid, p_decision text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('payments.review');
  v_row public.payment_transactions%rowtype;
  v_target text;
  v_before_status text;
  v_audit_id bigint;
begin
  if p_decision = 'approve' then
    return public.admin_approve_payment(p_payment_id);
  end if;
  if p_decision not in ('reject', 'cancel') then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Decision must be approve, reject or cancel.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required.';
  end if;
  v_target := case when p_decision = 'reject' then 'failed' else 'cancelled' end;
  select * into v_row from public.payment_transactions where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Payment transaction not found.';
  end if;
  perform public.assert_admin_transition('payment', v_row.status, v_target);
  v_before_status := v_row.status;
  update public.payment_transactions
  set status = v_target, rejected_at = now(), rejected_by = v_actor, review_note = trim(p_reason),
      gateway_payload = coalesce(gateway_payload, '{}'::jsonb) || jsonb_build_object('admin_review', jsonb_build_object('decision', p_decision, 'reason', trim(p_reason), 'at', now(), 'by', v_actor)),
      updated_at = now()
  where id = p_payment_id returning * into v_row;
  v_audit_id := public.log_admin_action('payment.' || p_decision, 'payment', p_payment_id::text, p_reason,
    jsonb_build_object('status', v_before_status), jsonb_build_object('status', v_target));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_refund_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('payments.review');
  v_row public.payment_transactions%rowtype;
  v_before integer;
  v_after integer;
  v_ledger_id uuid;
  v_audit_id bigint;
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required to refund.';
  end if;
  select * into v_row from public.payment_transactions where id = p_payment_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Payment transaction not found.';
  end if;
  perform public.assert_admin_transition('payment', v_row.status, 'refunded');
  select coalesce(credits, 0) into v_before from public.users where id = v_row.user_id for update;
  if v_before < coalesce(v_row.credits_to_add, 0) then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INSUFFICIENT_CREDITS: The user has %s credits but %s would be reversed.', v_before, coalesce(v_row.credits_to_add, 0)),
      hint = format('balance=%s;delta=%s', v_before, -coalesce(v_row.credits_to_add, 0));
  end if;
  update public.users set credits = v_before - coalesce(v_row.credits_to_add, 0), updated_at = now() where id = v_row.user_id returning credits into v_after;
  insert into public.credit_transactions (user_id, credits_deducted, transaction_type, credits_amount, balance_after, reference_type, reference_id, provider, metadata, payment_transaction_id)
  values (v_row.user_id, coalesce(v_row.credits_to_add, 0), 'credit_purchase_refund', -coalesce(v_row.credits_to_add, 0), v_after,
          'payment_transaction', v_row.id, coalesce(v_row.provider, 'eps'), jsonb_build_object('reason', trim(p_reason), 'actor_id', v_actor), v_row.transaction_id)
  returning id into v_ledger_id;
  update public.payment_transactions
  set status = 'refunded', refunded_at = now(), refunded_by = v_actor, review_note = trim(p_reason), updated_at = now()
  where id = p_payment_id returning * into v_row;
  v_audit_id := public.log_admin_action('payment.refund', 'payment', p_payment_id::text, p_reason,
    jsonb_build_object('status', 'credited', 'credits', v_before), jsonb_build_object('status', 'refunded', 'credits', v_after, 'ledger_id', v_ledger_id));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_set_order_status(p_order_id uuid, p_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_row public.orders%rowtype;
  v_before text;
  v_audit_id bigint;
begin
  select * into v_row from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Order was not found.';
  end if;
  v_before := v_row.status;
  perform public.assert_admin_transition('order', v_row.status, p_status);
  update public.orders
  set status = p_status, admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), admin_note), updated_at = now()
  where id = p_order_id returning * into v_row;
  v_audit_id := public.log_admin_action('order.set_status', 'order', p_order_id::text, p_note,
    jsonb_build_object('status', v_before), jsonb_build_object('status', p_status));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_set_order_job_feed(p_order_id uuid, p_title text, p_description text, p_is_posted boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_row public.orders%rowtype;
  v_before jsonb;
  v_audit_id bigint;
begin
  select * into v_row from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Order was not found.';
  end if;
  if p_is_posted and v_row.status <> 'confirmed' then
    raise exception using errcode = 'P0001', message = 'ADMIN_INVALID_TRANSITION: Only confirmed orders can be published to the job feed.',
      hint = format('entity=order;from=%s;to=confirmed', v_row.status);
  end if;
  v_before := jsonb_build_object('is_job_feed_posted', v_row.is_job_feed_posted, 'job_feed_title', v_row.job_feed_title, 'job_feed_description', v_row.job_feed_description);
  update public.orders
  set job_feed_title = nullif(trim(coalesce(p_title, '')), ''),
      job_feed_description = nullif(trim(coalesce(p_description, '')), ''),
      is_job_feed_posted = p_is_posted,
      job_feed_posted_at = case when p_is_posted then coalesce(job_feed_posted_at, now()) else null end,
      updated_at = now()
  where id = p_order_id returning * into v_row;
  v_audit_id := public.log_admin_action('order.set_job_feed', 'order', p_order_id::text, null, v_before,
    jsonb_build_object('is_job_feed_posted', v_row.is_job_feed_posted, 'job_feed_title', v_row.job_feed_title, 'job_feed_description', v_row.job_feed_description));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_set_order_assignee(p_order_id uuid, p_assigned_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_row public.orders%rowtype;
  v_before uuid;
  v_audit_id bigint;
begin
  if p_assigned_to is not null and not exists (select 1 from public.admin_memberships m where m.user_id = p_assigned_to and m.is_active)
     and not exists (select 1 from public.users u where u.id = p_assigned_to and coalesce(u.is_admin, false)) then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Orders can only be assigned to admin users.';
  end if;
  select assigned_to into v_before from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Order was not found.';
  end if;
  update public.orders set assigned_to = p_assigned_to, updated_at = now() where id = p_order_id returning * into v_row;
  v_audit_id := public.log_admin_action('order.assign', 'order', p_order_id::text, null,
    jsonb_build_object('assigned_to', v_before), jsonb_build_object('assigned_to', p_assigned_to));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_archive_order(p_order_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_row public.orders%rowtype;
  v_audit_id bigint;
begin
  update public.orders set archived_at = now(), archived_by = v_actor, updated_at = now()
  where id = p_order_id and archived_at is null returning * into v_row;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Order was not found or is already archived.';
  end if;
  v_audit_id := public.log_admin_action('order.archive', 'order', p_order_id::text, p_reason, null, jsonb_build_object('archived_at', v_row.archived_at));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_set_inquiry(
  p_inquiry_id uuid,
  p_status text default null,
  p_assigned_to uuid default null,
  p_follow_up_at timestamptz default null,
  p_note text default null,
  p_clear_assignee boolean default false,
  p_clear_follow_up boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('inquiries.manage');
  v_row public.property_inquiries%rowtype;
  v_before jsonb;
  v_audit_id bigint;
begin
  select * into v_row from public.property_inquiries where id = p_inquiry_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Inquiry was not found.';
  end if;
  if p_status is not null and p_status is distinct from v_row.status then
    perform public.assert_admin_transition('inquiry', v_row.status, p_status);
  end if;
  if p_assigned_to is not null and not exists (select 1 from public.admin_memberships m where m.user_id = p_assigned_to and m.is_active)
     and not exists (select 1 from public.users u where u.id = p_assigned_to and coalesce(u.is_admin, false)) then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Inquiries can only be assigned to admin users.';
  end if;
  v_before := jsonb_build_object('status', v_row.status, 'assigned_to', v_row.assigned_to, 'follow_up_at', v_row.follow_up_at, 'admin_note', v_row.admin_note);
  update public.property_inquiries
  set status = coalesce(p_status, status),
      assigned_to = case when p_clear_assignee then null else coalesce(p_assigned_to, assigned_to) end,
      follow_up_at = case when p_clear_follow_up then null else coalesce(p_follow_up_at, follow_up_at) end,
      admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), admin_note),
      updated_at = now()
  where id = p_inquiry_id returning * into v_row;
  v_audit_id := public.log_admin_action('inquiry.update', 'inquiry', p_inquiry_id::text, p_note, v_before,
    jsonb_build_object('status', v_row.status, 'assigned_to', v_row.assigned_to, 'follow_up_at', v_row.follow_up_at, 'admin_note', v_row.admin_note));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_archive_inquiry(p_inquiry_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('inquiries.manage');
  v_row public.property_inquiries%rowtype;
  v_audit_id bigint;
begin
  update public.property_inquiries set archived_at = now(), archived_by = v_actor, updated_at = now()
  where id = p_inquiry_id and archived_at is null returning * into v_row;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Inquiry was not found or is already archived.';
  end if;
  v_audit_id := public.log_admin_action('inquiry.archive', 'inquiry', p_inquiry_id::text, p_reason, null, jsonb_build_object('archived_at', v_row.archived_at));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_review_feedback(
  p_feedback_id uuid,
  p_status text default null,
  p_rejection_reason text default null,
  p_is_resolved boolean default null,
  p_is_public boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('feedback.review');
  v_row public.feedback%rowtype;
  v_before jsonb;
  v_audit_id bigint;
begin
  select * into v_row from public.feedback where id = p_feedback_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Feedback was not found.';
  end if;
  if p_status is not null and p_status is distinct from v_row.status then
    perform public.assert_admin_transition('feedback', v_row.status, p_status);
    if p_status = 'rejected' and nullif(trim(coalesce(p_rejection_reason, '')), '') is null then
      raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required when rejecting feedback.';
    end if;
  end if;
  if coalesce(p_is_public, false) and coalesce(p_status, v_row.status) <> 'approved' then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Only approved feedback can be shown publicly.';
  end if;
  v_before := jsonb_build_object('status', v_row.status, 'is_resolved', v_row.is_resolved, 'is_public', v_row.is_public, 'rejection_reason', v_row.rejection_reason);
  update public.feedback
  set status = coalesce(p_status, status),
      reviewed_at = case when p_status is not null then now() else reviewed_at end,
      reviewed_by = case when p_status is not null then v_actor else reviewed_by end,
      rejection_reason = case when p_status = 'rejected' then trim(p_rejection_reason) when p_status = 'approved' then null else rejection_reason end,
      is_resolved = coalesce(p_is_resolved, is_resolved),
      is_public = coalesce(p_is_public, is_public),
      updated_at = now()
  where id = p_feedback_id returning * into v_row;
  v_audit_id := public.log_admin_action('feedback.review', 'feedback', p_feedback_id::text, p_rejection_reason, v_before,
    jsonb_build_object('status', v_row.status, 'is_resolved', v_row.is_resolved, 'is_public', v_row.is_public, 'rejection_reason', v_row.rejection_reason));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_archive_feedback(p_feedback_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('feedback.review');
  v_row public.feedback%rowtype;
  v_audit_id bigint;
begin
  update public.feedback set archived_at = now(), archived_by = v_actor, updated_at = now()
  where id = p_feedback_id and archived_at is null returning * into v_row;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Feedback was not found or is already archived.';
  end if;
  v_audit_id := public.log_admin_action('feedback.archive', 'feedback', p_feedback_id::text, p_reason, null, jsonb_build_object('archived_at', v_row.archived_at));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_pricing_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'credit_settings', (select to_jsonb(cs) - 'created_at' - 'updated_at' from public.credit_settings cs where cs.id = true),
    'site_costs', (select jsonb_build_object('property_listing', s.property_listing, 'contact_view', s.contact_view, 'photo_view', s.photo_view)
                   from public.site_settings s order by s.created_at limit 1),
    'packages', (select coalesce(jsonb_agg(to_jsonb(p) - 'created_at' - 'updated_at' order by p.price_bdt), '[]'::jsonb) from public.credit_packages p)
  );
$$;

create or replace function public.admin_apply_pricing_snapshot(p_snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cs jsonb := p_snapshot -> 'credit_settings';
  v_pkg jsonb;
  v_pkg_id uuid;
  v_ids uuid[] := '{}';
begin
  if v_cs is not null then
    insert into public.credit_settings (id, property_listing, contact_view, photo_view)
    values (true, coalesce((v_cs ->> 'property_listing')::int, 20), coalesce((v_cs ->> 'contact_view')::int, 10), coalesce((v_cs ->> 'photo_view')::int, 10))
    on conflict (id) do update
      set property_listing = excluded.property_listing, contact_view = excluded.contact_view, photo_view = excluded.photo_view, updated_at = now();
    update public.site_settings
    set property_listing = coalesce((v_cs ->> 'property_listing')::int, property_listing),
        contact_view = coalesce((v_cs ->> 'contact_view')::int, contact_view),
        photo_view = coalesce((v_cs ->> 'photo_view')::int, photo_view),
        updated_at = now();
  end if;
  if p_snapshot ? 'packages' then
    for v_pkg in select * from jsonb_array_elements(p_snapshot -> 'packages') loop
      if coalesce(v_pkg ->> 'package_name', '') = '' or (v_pkg ->> 'credits_amount') is null or (v_pkg ->> 'price_bdt') is null then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Each package needs a name, credits and a price.';
      end if;
      if (v_pkg ->> 'credits_amount')::int <= 0 or (v_pkg ->> 'price_bdt')::int < 0
         or coalesce((v_pkg ->> 'discount_percentage')::int, 0) not between 0 and 100 then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Package %s has an invalid amount, price or discount.', v_pkg ->> 'package_name');
      end if;
      insert into public.credit_packages (id, package_name, credits_amount, price_bdt, active, discount_percentage, is_popular)
      values (coalesce((v_pkg ->> 'id')::uuid, gen_random_uuid()), v_pkg ->> 'package_name', (v_pkg ->> 'credits_amount')::int, (v_pkg ->> 'price_bdt')::int,
              coalesce((v_pkg ->> 'active')::boolean, true), coalesce((v_pkg ->> 'discount_percentage')::int, 0), coalesce((v_pkg ->> 'is_popular')::boolean, false))
      on conflict (id) do update
        set package_name = excluded.package_name, credits_amount = excluded.credits_amount, price_bdt = excluded.price_bdt,
            active = excluded.active, discount_percentage = excluded.discount_percentage, is_popular = excluded.is_popular, updated_at = now()
      returning id into v_pkg_id;
      v_ids := v_ids || v_pkg_id;
    end loop;
    -- Packages missing from the snapshot are deactivated, never deleted (payment rows reference them).
    update public.credit_packages set active = false, updated_at = now() where not (id = any (v_ids)) and active;
  end if;
end;
$$;

create or replace function public.admin_update_pricing(p_credit_settings jsonb default null, p_packages jsonb default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('pricing.manage');
  v_before jsonb := public.admin_pricing_snapshot();
  v_after jsonb;
  v_version public.credit_pricing_versions%rowtype;
  v_audit_id bigint;
  v_patch jsonb := '{}'::jsonb;
begin
  if p_credit_settings is null and p_packages is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Nothing to publish.';
  end if;
  if p_credit_settings is not null then
    if exists (select 1 from jsonb_object_keys(p_credit_settings) k where k not in ('property_listing', 'contact_view', 'photo_view')) then
      raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Unknown credit setting.';
    end if;
    if exists (select 1 from jsonb_each_text(p_credit_settings) kv where kv.value !~ '^\d+$' or kv.value::int > 10000) then
      raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Credit costs must be whole numbers between 0 and 10,000.';
    end if;
    v_patch := v_patch || jsonb_build_object('credit_settings', coalesce(v_before -> 'credit_settings', '{}'::jsonb) || p_credit_settings);
  end if;
  if p_packages is not null then
    if jsonb_typeof(p_packages) <> 'array' then
      raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Packages must be a list.';
    end if;
    v_patch := v_patch || jsonb_build_object('packages', p_packages);
  end if;

  -- Version 1 is the pre-change state so the first publish can be rolled back.
  if not exists (select 1 from public.credit_pricing_versions) then
    insert into public.credit_pricing_versions (snapshot, note, published_by) values (v_before, 'Initial snapshot before first admin publish', v_actor);
  end if;

  perform public.admin_apply_pricing_snapshot(v_patch);
  v_after := public.admin_pricing_snapshot();
  insert into public.credit_pricing_versions (snapshot, note, published_by) values (v_after, nullif(trim(coalesce(p_note, '')), ''), v_actor) returning * into v_version;
  v_audit_id := public.log_admin_action('pricing.update', 'pricing', v_version.id::text, p_note, v_before, v_after);
  return jsonb_build_object('row', to_jsonb(v_version), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_rollback_pricing(p_version_id bigint, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('pricing.manage');
  v_target public.credit_pricing_versions%rowtype;
  v_before jsonb := public.admin_pricing_snapshot();
  v_after jsonb;
  v_version public.credit_pricing_versions%rowtype;
  v_audit_id bigint;
begin
  select * into v_target from public.credit_pricing_versions where id = p_version_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Pricing version was not found.';
  end if;
  perform public.admin_apply_pricing_snapshot(v_target.snapshot);
  v_after := public.admin_pricing_snapshot();
  insert into public.credit_pricing_versions (snapshot, note, published_by, is_rollback_of)
  values (v_after, coalesce(nullif(trim(coalesce(p_note, '')), ''), format('Rollback to version %s', p_version_id)), v_actor, p_version_id)
  returning * into v_version;
  v_audit_id := public.log_admin_action('pricing.rollback', 'pricing', v_version.id::text, p_note, v_before, v_after, jsonb_build_object('rolled_back_to', p_version_id));
  return jsonb_build_object('row', to_jsonb(v_version), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_update_site_settings(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.site_settings%rowtype;
  v_before jsonb;
  v_audit_id bigint;
  v_key text;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Authentication required.';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Nothing to update.';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    case v_key
      when 'maintenance_mode', 'auto_approve_properties', 'site_theme' then perform public.assert_admin_permission('settings.manage');
      when 'contact_info', 'featured_property_ids' then perform public.assert_admin_permission('content.manage');
      else raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Unknown setting %s.', v_key);
    end case;
  end loop;

  select * into v_row from public.site_settings order by created_at limit 1 for update;
  if not found then
    insert into public.site_settings default values returning * into v_row;
  end if;
  v_before := jsonb_build_object('maintenance_mode', v_row.maintenance_mode, 'auto_approve_properties', v_row.auto_approve_properties,
    'site_theme', v_row.site_theme, 'contact_info', v_row.contact_info, 'featured_property_ids', to_jsonb(v_row.featured_property_ids));

  update public.site_settings
  set maintenance_mode = coalesce((p_patch ->> 'maintenance_mode')::boolean, maintenance_mode),
      auto_approve_properties = coalesce((p_patch ->> 'auto_approve_properties')::boolean, auto_approve_properties),
      site_theme = case when p_patch ? 'site_theme' and (p_patch ->> 'site_theme') in ('light', 'dark') then p_patch ->> 'site_theme' else site_theme end,
      contact_info = case when p_patch ? 'contact_info' then coalesce(p_patch -> 'contact_info', '{}'::jsonb) else contact_info end,
      featured_property_ids = case when p_patch ? 'featured_property_ids'
        then coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_patch -> 'featured_property_ids') x), '{}'::uuid[])
        else featured_property_ids end,
      updated_at = now()
  where id = v_row.id returning * into v_row;

  v_audit_id := public.log_admin_action('settings.update', 'site_settings', v_row.id::text, null, v_before,
    jsonb_build_object('maintenance_mode', v_row.maintenance_mode, 'auto_approve_properties', v_row.auto_approve_properties,
      'site_theme', v_row.site_theme, 'contact_info', v_row.contact_info, 'featured_property_ids', to_jsonb(v_row.featured_property_ids)),
    jsonb_build_object('keys', (select jsonb_agg(k) from jsonb_object_keys(p_patch) k)));
  return jsonb_build_object('row', to_jsonb(v_row), 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_list_audit_log(
  p_entity_type text default null,
  p_entity_id text default null,
  p_actor_id uuid default null,
  p_action text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table(
  id bigint, actor_id uuid, actor_name text, actor_email text, actor_roles text[], action text,
  entity_type text, entity_id text, reason text, before jsonb, after jsonb, metadata jsonb, created_at timestamptz, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission('audit.view');
  if p_limit < 1 or p_limit > 200 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: limit must be between 1 and 200.';
  end if;
  return query
  select l.id, l.actor_id, u.name, u.email, l.actor_roles, l.action, l.entity_type, l.entity_id, l.reason, l.before, l.after, l.metadata, l.created_at,
         count(*) over ()::bigint
  from public.admin_audit_log l
  left join public.users u on u.id = l.actor_id
  where (p_entity_type is null or l.entity_type = p_entity_type)
    and (p_entity_id is null or l.entity_id = p_entity_id)
    and (p_actor_id is null or l.actor_id = p_actor_id)
    and (p_action is null or l.action = p_action)
    and (p_from is null or l.created_at >= p_from)
    and (p_to is null or l.created_at <= p_to)
  order by l.created_at desc, l.id desc
  limit p_limit offset p_offset;
end;
$$;

-- Legacy refund review RPC (created by 20260411193000): if present, narrow it
-- to refunds.review members and record the reviewer + an audit row by wrapping.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'review_contact_unlock_refund_request') then
    alter table public.contact_unlock_refund_requests add column if not exists reviewed_by uuid references public.users(id) on delete set null;
    execute $fn$
      create or replace function public.admin_review_refund_request(p_request_id uuid, p_status text, p_admin_note text default null)
      returns jsonb
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_actor uuid := public.assert_admin_permission('refunds.review');
        v_before text;
        v_row public.contact_unlock_refund_requests%rowtype;
        v_result jsonb;
        v_audit_id bigint;
      begin
        if p_status = 'rejected' and nullif(trim(coalesce(p_admin_note, '')), '') is null then
          raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A note is required when rejecting a refund.';
        end if;
        select status into v_before from public.contact_unlock_refund_requests where id = p_request_id;
        if not found then
          raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Refund request was not found.';
        end if;
        perform public.assert_admin_transition('refund', v_before, p_status);
        select to_jsonb(r) into v_result from public.review_contact_unlock_refund_request(p_request_id, p_status, p_admin_note) r;
        update public.contact_unlock_refund_requests set reviewed_by = v_actor where id = p_request_id returning * into v_row;
        v_audit_id := public.log_admin_action('refund.' || p_status, 'refund_request', p_request_id::text, p_admin_note,
          jsonb_build_object('status', v_before), jsonb_build_object('status', v_row.status, 'credits_restored', v_row.credits_restored));
        return jsonb_build_object('row', to_jsonb(v_row), 'result', v_result, 'audit_id', v_audit_id);
      end;
      $body$;
    $fn$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. RLS: enable everywhere, replace the permissive policies
-- ---------------------------------------------------------------------------
-- New tables
alter table public.admin_memberships enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_status_transitions enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.credit_pricing_versions enable row level security;

revoke all on public.admin_memberships, public.admin_role_permissions, public.admin_status_transitions,
           public.admin_audit_log, public.credit_pricing_versions from anon, authenticated;
grant select on public.admin_memberships, public.admin_role_permissions, public.admin_status_transitions,
             public.admin_audit_log, public.credit_pricing_versions to authenticated;

drop policy if exists admin_memberships_select on public.admin_memberships;
create policy admin_memberships_select on public.admin_memberships for select to authenticated
  using (user_id = auth.uid() or public.admin_has_permission('users.view'));

drop policy if exists admin_role_permissions_select on public.admin_role_permissions;
create policy admin_role_permissions_select on public.admin_role_permissions for select to authenticated
  using (public.is_current_user_admin());

drop policy if exists admin_status_transitions_select on public.admin_status_transitions;
create policy admin_status_transitions_select on public.admin_status_transitions for select to authenticated
  using (public.is_current_user_admin());

drop policy if exists admin_audit_log_select on public.admin_audit_log;
create policy admin_audit_log_select on public.admin_audit_log for select to authenticated
  using (public.admin_has_permission('audit.view'));

drop policy if exists credit_pricing_versions_select on public.credit_pricing_versions;
create policy credit_pricing_versions_select on public.credit_pricing_versions for select to authenticated
  using (public.admin_has_permission('pricing.manage'));

-- users: the deployed "Admins can update/view all users" policies are USING (true)
-- for every authenticated user. Replace with the helper; the trigger above
-- guards the privileged columns.
drop policy if exists "Admins can update all users" on public.users;
create policy "Admins can update all users" on public.users for update to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());
drop policy if exists "Admins can view all users" on public.users;
-- allow_read_all (USING true) is intentionally left in place for this stage:
-- public pages still read other users' names/phones directly. Follow-up.

-- properties: the deployed "Admins can ... all properties" policies are USING (true).
drop policy if exists "Admins can view all properties" on public.properties;
drop policy if exists "Admins can update all properties" on public.properties;
drop policy if exists "Admins can delete all properties" on public.properties;
-- The remaining "Users can ... own properties or admin can ... all" policies cover admins.

-- feedback
drop policy if exists "Anyone can view feedback" on public.feedback;
drop policy if exists "Anyone can update feedback" on public.feedback;
drop policy if exists "Anyone can delete feedback" on public.feedback;
drop policy if exists feedback_public_read on public.feedback;
create policy feedback_public_read on public.feedback for select to anon, authenticated
  using ((status = 'approved' and is_public and archived_at is null) or user_id = auth.uid() or public.is_current_user_admin());
drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback for update to authenticated
  using (public.admin_has_permission('feedback.review')) with check (public.admin_has_permission('feedback.review'));
drop policy if exists feedback_admin_delete on public.feedback;
create policy feedback_admin_delete on public.feedback for delete to authenticated
  using (public.admin_has_permission('feedback.review'));

-- cover photos
drop policy if exists "Authenticated users can manage cover photos" on public.cover_photos;
drop policy if exists cover_photos_admin_manage on public.cover_photos;
create policy cover_photos_admin_manage on public.cover_photos for all to authenticated
  using (public.admin_has_permission('content.manage')) with check (public.admin_has_permission('content.manage'));
drop policy if exists "Anyone can view cover photos" on public.cover_photos;
create policy "Anyone can view cover photos" on public.cover_photos for select to anon, authenticated
  using (coalesce(is_active, true) or public.is_current_user_admin());

-- payment transactions: owners may only cancel their own pending rows
drop policy if exists "Users can update own payment transactions" on public.payment_transactions;
drop policy if exists payment_transactions_owner_cancel_pending on public.payment_transactions;
create policy payment_transactions_owner_cancel_pending on public.payment_transactions for update to authenticated
  using (auth.uid() = user_id and status in ('pending', 'created'))
  with check (auth.uid() = user_id and status in ('pending', 'created', 'cancelled'));
drop policy if exists payment_transactions_admin_update on public.payment_transactions;
create policy payment_transactions_admin_update on public.payment_transactions for update to authenticated
  using (public.admin_has_permission('payments.review')) with check (public.admin_has_permission('payments.review'));

-- search history: any signed-in user could read everyone's searches
drop policy if exists "Authenticated users can view customer search history" on public.customer_search_history;
drop policy if exists customer_search_history_admin_read on public.customer_search_history;
create policy customer_search_history_admin_read on public.customer_search_history for select to authenticated
  using (user_id = auth.uid() or public.is_current_user_admin());

-- orders / inquiries / credit_packages / referral_settings: inline is_admin checks -> helper (role members work too)
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders" on public.orders for select to authenticated using (public.is_current_user_admin());
drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders for update to authenticated
  using (public.admin_has_permission('orders.manage')) with check (public.admin_has_permission('orders.manage'));
drop policy if exists "Admins can delete orders" on public.orders;
create policy "Admins can delete orders" on public.orders for delete to authenticated using (public.admin_has_permission('orders.manage'));

-- The deployed inquiry policy names contain line breaks; drop by prefix.
do $$
declare
  r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'property_inquiries' and policyname like 'Admins can %' loop
    execute format('drop policy if exists %I on public.property_inquiries', r.policyname);
  end loop;
end $$;
drop policy if exists property_inquiries_admin_read on public.property_inquiries;
create policy property_inquiries_admin_read on public.property_inquiries for select to authenticated using (public.is_current_user_admin());
drop policy if exists property_inquiries_admin_update on public.property_inquiries;
create policy property_inquiries_admin_update on public.property_inquiries for update to authenticated
  using (public.admin_has_permission('inquiries.manage')) with check (public.admin_has_permission('inquiries.manage'));
drop policy if exists property_inquiries_admin_delete on public.property_inquiries;
create policy property_inquiries_admin_delete on public.property_inquiries for delete to authenticated using (public.admin_has_permission('inquiries.manage'));

drop policy if exists "Admins can manage credit packages" on public.credit_packages;
create policy "Admins can manage credit packages" on public.credit_packages for all to authenticated
  using (public.admin_has_permission('pricing.manage')) with check (public.admin_has_permission('pricing.manage'));
drop policy if exists "Public can read credit packages" on public.credit_packages;
create policy "Public can read credit packages" on public.credit_packages for select to anon, authenticated
  using (active = true or public.is_current_user_admin());

drop policy if exists "Admins can manage credit settings" on public.credit_settings;
create policy "Admins can manage credit settings" on public.credit_settings for all to authenticated
  using (public.admin_has_permission('pricing.manage')) with check (public.admin_has_permission('pricing.manage'));

drop policy if exists "Admins can manage site settings" on public.site_settings;
create policy "Admins can manage site settings" on public.site_settings for all to authenticated
  using (public.admin_has_permission('settings.manage') or public.admin_has_permission('content.manage'))
  with check (public.admin_has_permission('settings.manage') or public.admin_has_permission('content.manage'));

drop policy if exists "Admins can read referral settings" on public.referral_settings;
create policy "Admins can read referral settings" on public.referral_settings for select to authenticated using (public.is_current_user_admin());
drop policy if exists "Admins can update referral settings" on public.referral_settings;
create policy "Admins can update referral settings" on public.referral_settings for update to authenticated
  using (public.admin_has_permission('settings.manage')) with check (public.admin_has_permission('settings.manage'));

drop policy if exists "Admins can manage blacklist" on public.user_blacklist;
create policy "Admins can manage blacklist" on public.user_blacklist for all to authenticated
  using (public.admin_has_permission('users.moderate')) with check (public.admin_has_permission('users.moderate'));
drop policy if exists user_blacklist_admin_read on public.user_blacklist;
create policy user_blacklist_admin_read on public.user_blacklist for select to authenticated using (public.is_current_user_admin());

-- Tables with RLS OFF on the deployed database (anon had full table privileges)
alter table public.credit_transactions enable row level security;
drop policy if exists credit_transactions_select_own_or_admin on public.credit_transactions;
create policy credit_transactions_select_own_or_admin on public.credit_transactions for select to authenticated
  using (user_id = auth.uid() or public.is_current_user_admin());
-- no client write policies: only SECURITY DEFINER functions and the service role write the ledger

alter table public.photo_views enable row level security;
drop policy if exists photo_views_select_own_or_admin on public.photo_views;
create policy photo_views_select_own_or_admin on public.photo_views for select to authenticated
  using (user_id = auth.uid() or public.is_current_user_admin());
drop policy if exists photo_views_insert_own on public.photo_views;
create policy photo_views_insert_own on public.photo_views for insert to authenticated with check (user_id = auth.uid());

alter table public.user_orders enable row level security;
drop policy if exists user_orders_own_or_admin on public.user_orders;
create policy user_orders_own_or_admin on public.user_orders for all to authenticated
  using (user_id = auth.uid() or public.is_current_user_admin()) with check (user_id = auth.uid() or public.is_current_user_admin());

alter table public.storage_config_note enable row level security;
drop policy if exists storage_config_note_admin_read on public.storage_config_note;
create policy storage_config_note_admin_read on public.storage_config_note for select to authenticated using (public.is_current_user_admin());
alter table public.storage_policies_config enable row level security;
drop policy if exists storage_policies_config_admin_read on public.storage_policies_config;
create policy storage_policies_config_admin_read on public.storage_policies_config for select to authenticated using (public.is_current_user_admin());

-- user_verifications has RLS on but only an INSERT policy: owners and admins can read, admins update.
drop policy if exists user_verifications_select_own_or_admin on public.user_verifications;
create policy user_verifications_select_own_or_admin on public.user_verifications for select to authenticated
  using (user_id = auth.uid() or public.is_current_user_admin());
drop policy if exists user_verifications_admin_update on public.user_verifications;
create policy user_verifications_admin_update on public.user_verifications for update to authenticated
  using (public.admin_has_permission('users.moderate')) with check (public.admin_has_permission('users.moderate'));

-- ---------------------------------------------------------------------------
-- 8. Function EXECUTE sweep: SECURITY DEFINER functions in public lose the
--    default PUBLIC grant; explicit allow-lists are re-granted below.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- Public (anon + authenticated): read-only lookups used before sign-in.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'get_property_detail_for_viewer(uuid)',
    'find_public_property_id_by_number(text)',
    'record_property_view(uuid)',
    'get_referral_candidate(text)',
    'resolve_referral_user_id(text)',
    'is_current_user_admin()',
    'admin_has_permission(text)'
  ] loop
    if to_regprocedure('public.' || fn) is not null then
      execute format('grant execute on function public.%s to anon, authenticated', fn);
    end if;
  end loop;
end $$;

-- Signed-in users.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'ensure_current_user_profile()',
    'unlock_property_contact(uuid)',
    'pin_property_for_24h(uuid)',
    'claim_referral_username(text)',
    'create_withdrawal_request(uuid,numeric)',
    'review_withdrawal_request(uuid,text,text)',
    'create_contact_unlock_refund_request(uuid,text,text)',
    'review_contact_unlock_refund_request(uuid,text,text)',
    'get_property_contact_unlock_analytics(uuid)',
    'complete_credit_topup(text)',
    'get_employee_listing_streak(uuid)',
    'current_admin_roles()',
    'admin_has_permission(text)',
    'assert_admin_permission(text)',
    'assert_admin_transition(text,text,text)',
    'get_my_admin_profile()',
    'admin_set_property_status(uuid[],text,text,text,text)',
    'admin_set_property_featured(uuid,boolean)',
    'admin_soft_delete_property(uuid,text)',
    'admin_phone_key_counts(text[])',
    'admin_duplicate_phone_groups(text,integer,integer)',
    'admin_blacklist_user(uuid,text,text,boolean,timestamptz)',
    'admin_unblacklist_user(uuid,text)',
    'admin_set_user_active(uuid,boolean,text)',
    'admin_set_employee_flag(uuid,boolean)',
    'admin_set_user_roles(uuid,text[])',
    'admin_adjust_user_credits(uuid,integer,text,integer)',
    'approve_credit_payment_transaction(uuid,uuid)',
    'admin_approve_payment(uuid)',
    'admin_review_payment(uuid,text,text)',
    'admin_refund_payment(uuid,text)',
    'admin_set_order_status(uuid,text,text)',
    'admin_set_order_job_feed(uuid,text,text,boolean)',
    'admin_set_order_assignee(uuid,uuid)',
    'admin_archive_order(uuid,text)',
    'admin_set_inquiry(uuid,text,uuid,timestamptz,text,boolean,boolean)',
    'admin_archive_inquiry(uuid,text)',
    'admin_review_feedback(uuid,text,text,boolean,boolean)',
    'admin_archive_feedback(uuid,text)',
    'admin_pricing_snapshot()',
    'admin_update_pricing(jsonb,jsonb,text)',
    'admin_rollback_pricing(bigint,text)',
    'admin_update_site_settings(jsonb)',
    'admin_list_audit_log(text,text,uuid,text,timestamptz,timestamptz,integer,integer)',
    'admin_review_refund_request(uuid,text,text)'
  ] loop
    if to_regprocedure('public.' || fn) is not null then
      execute format('grant execute on function public.%s to authenticated', fn);
    end if;
  end loop;
end $$;
-- Deliberately NOT granted to clients: log_admin_action, admin_apply_pricing_snapshot,
-- increment_user_credits, ensure_user_profile_for_user, handle_new_user, trigger functions,
-- referral/points internals (award_*, backfill_referral_tree, rebuild_team_tree_metrics,
-- upsert_team_tree_entry, resolve_signup_sponsor_id, process_referral_bonus_for_invite,
-- recalculate_employee_listing_streaks, refresh_employee_listing_streak_*,
-- record_listing_submission_completion). They run as the owner from triggers/other functions
-- or from Edge Functions with the service role.

-- ---------------------------------------------------------------------------
-- 9. Backfill: every legacy admin becomes a super_admin membership
-- ---------------------------------------------------------------------------
insert into public.admin_memberships (user_id, role, is_active, source)
select id, 'super_admin', true, 'backfill'
from public.users
where coalesce(is_admin, false)
on conflict (user_id, role) do nothing;

-- ---------------------------------------------------------------------------
-- 10. Final assertion: no public table may be left without RLS
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_missing is not null then
    raise exception 'Tables without RLS after migration: %', v_missing;
  end if;
end $$;

commit;
