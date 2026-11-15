-- Customer Orders: one record per paid house-search request (HOUSE_SEARCH, 500 BDT),
-- shared by the admin dashboard and the AI-agent REST API.
--
-- Adds
--   * customer_orders (+ customer_order_counters for NT-YYYY-NNNN numbers),
--     customer_order_payment_claims, customer_order_matches,
--     append-only customer_order_status_history / _notes / _activity,
--     customer_order_transitions (the status machine), customer_order_api_requests
--     (API rate limit), and the customer_orders_enriched view that DERIVES
--     amount_paid / amount_due / payment_status / payment_verification and the
--     listings-found counts (none of those is ever stored);
--   * core functions co_* that take an explicit actor and are executable by
--     service_role only (the customer-orders Edge Function calls them);
--   * admin wrappers admin_customer_order_* (orders.manage; payments.review for
--     verifying a claim and for soft delete) that call the same core functions,
--     so the dashboard and the API share one status machine and one payment rule set;
--   * an AFTER INSERT trigger on public.orders that mirrors each website order
--     into customer_orders as created_via = 'customer' (the website form, the old
--     orders table, its admin tab and the job feed are not changed), plus a
--     backfill of the existing rows.
--
-- Depends on 20261025090000_admin_roles_audit_rpcs.sql (assert_admin_permission,
-- admin_has_permission, log_admin_action, set_updated_at).
-- NOTE: re-running 20261025's EXECUTE sweep would revoke the grants made here;
-- re-apply this file afterwards if that ever happens.
--
-- Apply (user runs with `!`):
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < supabase/migrations/20261116090000_customer_orders.sql
-- Dry run with the assertion suite:
--   bash scripts/deploy/supabase-selfhost/run-rls-tests.sh HOST --dry-run-customer-orders
-- Revert: scripts/deploy/supabase-selfhost/rollback-customer-orders.sql

begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.customer_order_counters (
  year int primary key,
  last_no int not null default 0
);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  type text not null default 'HOUSE_SEARCH' check (type in ('HOUSE_SEARCH')),
  status text not null default 'PENDING' check (status in (
    'PENDING', 'REQUIREMENTS_COLLECTED', 'SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN', 'PREVIEWS_SENT',
    'PAYMENT_INTERESTED', 'PAYMENT_CLAIMED', 'PAYMENT_VERIFIED', 'MATCHED', 'COMPLETED',
    'SELF_SERVICE', 'CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'PAYMENT_ISSUE', 'PAYMENT_FAILED')),
  search_mode text check (search_mode in ('AI', 'HUMAN')),
  search_taken_over_by text,
  created_via text not null check (created_via in ('customer', 'ai_agent', 'human_agent')),
  created_by_label text not null,
  source text not null default 'manual' check (source in ('messenger', 'lead_generation', 'manual', 'phone', 'website')),
  customer_user_id uuid references public.users(id) on delete set null,
  customer_name text not null check (char_length(btrim(customer_name)) > 0),
  customer_phone text check (customer_phone is null or customer_phone ~ '^01[3-9][0-9]{8}$'),
  facebook_name text,
  facebook_thread_url text,
  area text,
  rooms int check (rooms is null or rooms between 0 and 50),
  budget_min int check (budget_min is null or budget_min >= 0),
  budget_max int check (budget_max is null or budget_max >= 0),
  move_in_date date,
  tenant_type text check (tenant_type is null or tenant_type in ('family', 'bachelor')),
  gas text,
  bathrooms int check (bathrooms is null or bathrooms between 0 and 50),
  balconies int check (balconies is null or balconies between 0 and 50),
  facilities text,
  requirement_notes text,
  service_charge_bdt int not null check (service_charge_bdt > 0),
  assigned_to uuid references public.users(id) on delete set null,
  follow_up_at timestamptz,
  payment_claimed_at timestamptz,
  payment_verified_at timestamptz,
  idempotency_key text,
  legacy_order_id uuid unique references public.orders(id) on delete set null,
  deleted_at timestamptz,
  deleted_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_orders_contact_check check (
    customer_phone is not null or nullif(btrim(coalesce(facebook_thread_url, '')), '') is not null or customer_user_id is not null),
  constraint customer_orders_budget_check check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create index if not exists idx_customer_orders_phone on public.customer_orders (customer_phone) where customer_phone is not null;
create index if not exists idx_customer_orders_status on public.customer_orders (status);
create index if not exists idx_customer_orders_assigned on public.customer_orders (assigned_to) where assigned_to is not null;
create index if not exists idx_customer_orders_created on public.customer_orders (created_at desc);
create index if not exists idx_customer_orders_created_via on public.customer_orders (created_via);
create unique index if not exists uq_customer_orders_idempotency
  on public.customer_orders (created_by_label, idempotency_key) where idempotency_key is not null;

create table if not exists public.customer_order_payment_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  amount_bdt int not null check (amount_bdt > 0),
  trx_id text,
  sender_last4 text check (sender_last4 is null or sender_last4 ~ '^[0-9]{4}$'),
  status text not null default 'CLAIMED' check (status in ('CLAIMED', 'VERIFIED', 'REJECTED')),
  claimed_by_type text not null,
  claimed_by_label text not null,
  claimed_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_by_label text,
  reviewed_at timestamptz,
  review_note text,
  constraint customer_order_claims_reference_check check (trx_id is not null or sender_last4 is not null)
);
create index if not exists idx_customer_order_claims_order on public.customer_order_payment_claims (order_id);
create index if not exists idx_customer_order_claims_open on public.customer_order_payment_claims (order_id) where status = 'CLAIMED';
create unique index if not exists uq_customer_order_claims_trx
  on public.customer_order_payment_claims (order_id, upper(trx_id)) where trx_id is not null;

create table if not exists public.customer_order_matches (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  reference_id text not null,
  property_id uuid references public.properties(id) on delete set null,
  general_location text,
  rent int check (rent is null or rent >= 0),
  verification_status text not null default 'unverified' check (verification_status in ('verified', 'unverified')),
  owner_contact_phone text,
  exact_address text,
  owner_permission boolean not null default false,
  owner_permission_recorded_by text,
  owner_permission_recorded_at timestamptz,
  removed_at timestamptz,
  created_by_type text not null,
  created_by_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customer_order_matches_order on public.customer_order_matches (order_id) where removed_at is null;

create table if not exists public.customer_order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  from_status text,
  to_status text not null,
  reason text,
  taken_over_by text,
  actor_type text not null,
  actor_id uuid,
  actor_label text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_order_history_order on public.customer_order_status_history (order_id, created_at desc);

create table if not exists public.customer_order_notes (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  actor_type text not null,
  actor_id uuid,
  actor_label text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_order_notes_order on public.customer_order_notes (order_id, created_at desc);

create table if not exists public.customer_order_activity (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  action text not null,
  before jsonb,
  after jsonb,
  actor_type text not null,
  actor_id uuid,
  actor_label text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_order_activity_order on public.customer_order_activity (order_id, created_at desc);

-- Keep identical to CUSTOMER_ORDER_TRANSITIONS in src/lib/customerOrderStatus.js
-- (tests/customerOrderStatus.test.mjs compares the two).
-- PAYMENT_CLAIMED, PAYMENT_VERIFIED and PAYMENT_FAILED are deliberately absent as
-- targets: only a payment claim / a claim review can reach them.
create table if not exists public.customer_order_transitions (
  from_status text not null,
  to_status text not null,
  agent_allowed boolean not null default true,
  primary key (from_status, to_status)
);

delete from public.customer_order_transitions;
insert into public.customer_order_transitions (from_status, to_status, agent_allowed) values
  ('PENDING', 'REQUIREMENTS_COLLECTED', true), ('PENDING', 'SEARCHING_BY_AI', true), ('PENDING', 'SEARCHING_BY_HUMAN', true),
  ('PENDING', 'SELF_SERVICE', true), ('PENDING', 'CANCELLED', true),
  ('REQUIREMENTS_COLLECTED', 'SEARCHING_BY_AI', true), ('REQUIREMENTS_COLLECTED', 'SEARCHING_BY_HUMAN', true),
  ('REQUIREMENTS_COLLECTED', 'PAYMENT_INTERESTED', true), ('REQUIREMENTS_COLLECTED', 'SELF_SERVICE', true),
  ('REQUIREMENTS_COLLECTED', 'CANCELLED', true),
  ('SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN', true), ('SEARCHING_BY_AI', 'PREVIEWS_SENT', true),
  ('SEARCHING_BY_AI', 'PAYMENT_INTERESTED', true), ('SEARCHING_BY_AI', 'SELF_SERVICE', true),
  ('SEARCHING_BY_AI', 'CANCELLED', true), ('SEARCHING_BY_AI', 'REFUND_REQUESTED', true),
  ('SEARCHING_BY_HUMAN', 'SEARCHING_BY_AI', true), ('SEARCHING_BY_HUMAN', 'PREVIEWS_SENT', true),
  ('SEARCHING_BY_HUMAN', 'PAYMENT_INTERESTED', true), ('SEARCHING_BY_HUMAN', 'SELF_SERVICE', true),
  ('SEARCHING_BY_HUMAN', 'CANCELLED', true), ('SEARCHING_BY_HUMAN', 'REFUND_REQUESTED', true),
  ('PREVIEWS_SENT', 'SEARCHING_BY_AI', true), ('PREVIEWS_SENT', 'SEARCHING_BY_HUMAN', true),
  ('PREVIEWS_SENT', 'PAYMENT_INTERESTED', true), ('PREVIEWS_SENT', 'MATCHED', true),
  ('PREVIEWS_SENT', 'SELF_SERVICE', true), ('PREVIEWS_SENT', 'CANCELLED', true), ('PREVIEWS_SENT', 'REFUND_REQUESTED', true),
  ('PAYMENT_INTERESTED', 'PAYMENT_ISSUE', true), ('PAYMENT_INTERESTED', 'SEARCHING_BY_AI', true),
  ('PAYMENT_INTERESTED', 'SEARCHING_BY_HUMAN', true), ('PAYMENT_INTERESTED', 'PREVIEWS_SENT', true),
  ('PAYMENT_INTERESTED', 'SELF_SERVICE', true), ('PAYMENT_INTERESTED', 'CANCELLED', true),
  ('PAYMENT_CLAIMED', 'PAYMENT_ISSUE', true), ('PAYMENT_CLAIMED', 'SEARCHING_BY_AI', true),
  ('PAYMENT_CLAIMED', 'SEARCHING_BY_HUMAN', true), ('PAYMENT_CLAIMED', 'PREVIEWS_SENT', true),
  ('PAYMENT_CLAIMED', 'CANCELLED', true),
  ('PAYMENT_VERIFIED', 'SEARCHING_BY_AI', true), ('PAYMENT_VERIFIED', 'SEARCHING_BY_HUMAN', true),
  ('PAYMENT_VERIFIED', 'PREVIEWS_SENT', true), ('PAYMENT_VERIFIED', 'MATCHED', true),
  ('PAYMENT_VERIFIED', 'REFUND_REQUESTED', true),
  ('MATCHED', 'COMPLETED', true), ('MATCHED', 'SEARCHING_BY_AI', true), ('MATCHED', 'SEARCHING_BY_HUMAN', true),
  ('MATCHED', 'REFUND_REQUESTED', true),
  ('PAYMENT_ISSUE', 'PAYMENT_INTERESTED', true), ('PAYMENT_ISSUE', 'SELF_SERVICE', true), ('PAYMENT_ISSUE', 'CANCELLED', true),
  ('PAYMENT_FAILED', 'PAYMENT_INTERESTED', true), ('PAYMENT_FAILED', 'PAYMENT_ISSUE', true),
  ('PAYMENT_FAILED', 'SELF_SERVICE', true), ('PAYMENT_FAILED', 'CANCELLED', true),
  ('REFUND_REQUESTED', 'REFUNDED', false), ('REFUND_REQUESTED', 'SEARCHING_BY_AI', false),
  ('REFUND_REQUESTED', 'SEARCHING_BY_HUMAN', false),
  ('CANCELLED', 'PENDING', false), ('SELF_SERVICE', 'PENDING', false);

create table if not exists public.customer_order_api_requests (
  key_label text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key_label, window_start)
);

-- ---------------------------------------------------------------------------
-- 2. Triggers: order number, updated_at, append-only logs
-- ---------------------------------------------------------------------------
create or replace function public.customer_orders_assign_order_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int;
  v_no int;
begin
  if tg_op = 'UPDATE' then
    new.order_no := old.order_no;      -- frozen once issued
    return new;
  end if;
  v_year := extract(year from (now() at time zone 'Asia/Dhaka'))::int;
  insert into public.customer_order_counters as c (year, last_no) values (v_year, 1)
  on conflict (year) do update set last_no = c.last_no + 1
  returning c.last_no into v_no;
  new.order_no := format('NT-%s-%s', v_year, lpad(v_no::text, 4, '0'));   -- any client value is ignored
  return new;
end;
$$;

drop trigger if exists trg_customer_orders_order_no on public.customer_orders;
create trigger trg_customer_orders_order_no
  before insert or update on public.customer_orders
  for each row execute function public.customer_orders_assign_order_no();

drop trigger if exists trg_customer_orders_set_updated_at on public.customer_orders;
create trigger trg_customer_orders_set_updated_at
  before update on public.customer_orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customer_order_matches_set_updated_at on public.customer_order_matches;
create trigger trg_customer_order_matches_set_updated_at
  before update on public.customer_order_matches
  for each row execute function public.set_updated_at();

create or replace function public.customer_order_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = 'P0001', message = format('ADMIN_CONFLICT: %s is append-only', tg_table_name);
end;
$$;

drop trigger if exists trg_customer_order_status_history_immutable on public.customer_order_status_history;
create trigger trg_customer_order_status_history_immutable
  before update or delete on public.customer_order_status_history
  for each row execute function public.customer_order_log_immutable();

drop trigger if exists trg_customer_order_notes_immutable on public.customer_order_notes;
create trigger trg_customer_order_notes_immutable
  before update or delete on public.customer_order_notes
  for each row execute function public.customer_order_log_immutable();

drop trigger if exists trg_customer_order_activity_immutable on public.customer_order_activity;
create trigger trg_customer_order_activity_immutable
  before update or delete on public.customer_order_activity
  for each row execute function public.customer_order_log_immutable();

-- Orders are soft-deleted only.
create or replace function public.customer_orders_no_hard_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = 'P0001', message = 'ADMIN_CONFLICT: customer orders are never hard-deleted';
end;
$$;

drop trigger if exists trg_customer_orders_no_hard_delete on public.customer_orders;
create trigger trg_customer_orders_no_hard_delete
  before delete on public.customer_orders
  for each row execute function public.customer_orders_no_hard_delete();

-- ---------------------------------------------------------------------------
-- 3. Derived view: payment totals and listings-found counts are computed here
--    and nowhere else.
-- ---------------------------------------------------------------------------
drop view if exists public.customer_orders_enriched;
create view public.customer_orders_enriched with (security_invoker = true) as
select
  o.*,
  coalesce(p.amount_paid, 0)::int as amount_paid,
  coalesce(p.amount_verified, 0)::int as amount_verified,
  greatest(o.service_charge_bdt - coalesce(p.amount_paid, 0), 0)::int as amount_due,
  (coalesce(p.amount_paid, 0) > o.service_charge_bdt) as overpaid,
  case
    when coalesce(p.amount_paid, 0) <= 0 then 'PENDING'
    when coalesce(p.amount_paid, 0) < o.service_charge_bdt then 'PARTIAL_PAID'
    else 'PAID'
  end as payment_status,
  case
    when coalesce(p.amount_verified, 0) >= o.service_charge_bdt then 'VERIFIED'
    when coalesce(p.live_claims, 0) > 0 then 'CLAIMED'
    else 'UNVERIFIED'
  end as payment_verification,
  coalesce(p.open_claims, 0)::int as claims_awaiting_verification,
  coalesce(m.total, 0)::int as listings_found_count,
  coalesce(m.verified, 0)::int as listings_verified_count,
  coalesce(m.unverified, 0)::int as listings_unverified_count,
  (o.payment_verified_at is not null
    and coalesce(p.amount_verified, 0) >= o.service_charge_bdt
    and o.status not in ('REFUND_REQUESTED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE')) as contact_unlocked,
  coalesce(nullif(btrim(a.full_name), ''), nullif(btrim(a.name), ''), a.email) as assignee_name
from public.customer_orders o
left join lateral (
  select
    sum(c.amount_bdt) filter (where c.status <> 'REJECTED') as amount_paid,
    sum(c.amount_bdt) filter (where c.status = 'VERIFIED') as amount_verified,
    count(*) filter (where c.status <> 'REJECTED') as live_claims,
    count(*) filter (where c.status = 'CLAIMED') as open_claims
  from public.customer_order_payment_claims c
  where c.order_id = o.id
) p on true
left join lateral (
  select
    count(*) as total,
    count(*) filter (where mm.verification_status = 'verified') as verified,
    count(*) filter (where mm.verification_status <> 'verified') as unverified
  from public.customer_order_matches mm
  where mm.order_id = o.id and mm.removed_at is null
) m on true
left join public.users a on a.id = o.assigned_to;

-- ---------------------------------------------------------------------------
-- 4. Access: admins holding orders.manage may read; every write goes through
--    the functions below.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'customer_order_counters', 'customer_orders', 'customer_order_payment_claims', 'customer_order_matches',
    'customer_order_status_history', 'customer_order_notes', 'customer_order_activity',
    'customer_order_transitions', 'customer_order_api_requests'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;

  foreach t in array array[
    'customer_orders', 'customer_order_payment_claims', 'customer_order_matches',
    'customer_order_status_history', 'customer_order_notes', 'customer_order_activity', 'customer_order_transitions'
  ] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.admin_has_permission(''orders.manage'')))',
      t || '_admin_read', t);
  end loop;
end $$;

revoke all on public.customer_orders_enriched from public, anon, authenticated;
grant select on public.customer_orders_enriched to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Helpers
-- ---------------------------------------------------------------------------
-- The service charge is a server constant; no caller can supply it.
create or replace function public.co_service_charge(p_type text)
returns int
language sql
immutable
as $$
  select case p_type when 'HOUSE_SEARCH' then 500 end;
$$;

create or replace function public.co_normalize_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v text := regexp_replace(coalesce(p_phone, ''), '[\s\-()]', '', 'g');
begin
  v := regexp_replace(v, '^(\+?88)', '');
  if v !~ '^01[3-9][0-9]{8}$' then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_VALIDATION: Phone must be a Bangladeshi mobile number (01XXXXXXXXX or +8801XXXXXXXXX).';
  end if;
  return v;
end;
$$;

create or replace function public.co_try_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
begin
  return public.co_normalize_phone(p_phone);
exception when others then
  return null;
end;
$$;

create or replace function public.co_assert_actor(p_actor_type text, p_actor_label text)
returns void
language plpgsql
immutable
as $$
begin
  if p_actor_type is null or p_actor_type not in ('admin', 'api_agent', 'api_admin', 'system') then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Unknown actor type.';
  end if;
  if nullif(btrim(coalesce(p_actor_label, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: An actor label is required.';
  end if;
end;
$$;

create or replace function public.co_admin_label(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select coalesce(nullif(btrim(u.full_name), ''), nullif(btrim(u.name), ''), u.email) from public.users u where u.id = p_user_id),
    p_user_id::text);
$$;

create or replace function public.co_assert_assignable(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  if not exists (select 1 from public.admin_memberships m where m.user_id = p_user_id and m.is_active)
     and not exists (select 1 from public.users u where u.id = p_user_id and coalesce(u.is_admin, false)) then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Orders can only be assigned to admin users.';
  end if;
end;
$$;

-- Validates and normalises a JSON object of order / match fields. Unknown keys
-- are rejected, so a caller can never smuggle in a price, a paid amount, a
-- payment status or a payment number.
create or replace function public.co_clean_fields(p jsonb, p_allowed text[])
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  k text;
  v jsonb;
  t text;
  v_out jsonb := '{}'::jsonb;
  v_max int;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A JSON object is required.';
  end if;
  for k, v in select key, value from jsonb_each(p) loop
    if not (k = any (p_allowed)) then
      raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" is not accepted.', k);
    end if;
    if jsonb_typeof(v) in ('object', 'array') then
      raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" must be a plain value.', k);
    end if;
    t := nullif(btrim(v #>> '{}'), '');
    if t is null then
      v_out := v_out || jsonb_build_object(k, null);
      continue;
    end if;

    if k in ('rooms', 'bathrooms', 'balconies', 'budget_min', 'budget_max', 'rent') then
      if t !~ '^[0-9]{1,9}$' then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" must be a whole number.', k);
      end if;
      if k in ('rooms', 'bathrooms', 'balconies') and t::int > 50 then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" is out of range.', k);
      end if;
      v_out := v_out || jsonb_build_object(k, t::int);
    elsif k in ('customer_phone', 'owner_contact_phone') then
      v_out := v_out || jsonb_build_object(k, public.co_normalize_phone(t));
    elsif k = 'move_in_date' then
      if t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: move_in_date must be a date in YYYY-MM-DD format.';
      end if;
      begin
        perform t::date;
      exception when others then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: move_in_date is not a real date.';
      end;
      v_out := v_out || jsonb_build_object(k, t);
    elsif k = 'follow_up_at' then
      begin
        perform t::timestamptz;
      exception when others then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: follow_up_at must be an ISO 8601 timestamp.';
      end;
      v_out := v_out || jsonb_build_object(k, t);
    elsif k = 'type' then
      if upper(t) <> 'HOUSE_SEARCH' then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Only HOUSE_SEARCH orders are supported.';
      end if;
      v_out := v_out || jsonb_build_object(k, 'HOUSE_SEARCH');
    elsif k = 'tenant_type' then
      if lower(t) not in ('family', 'bachelor') then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: tenant_type must be family or bachelor.';
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t));
    elsif k = 'source' then
      if lower(t) not in ('messenger', 'lead_generation', 'manual', 'phone') then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: source must be messenger, lead_generation, manual or phone.';
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t));
    elsif k = 'verification_status' then
      if lower(t) not in ('verified', 'unverified') then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: verification_status must be verified or unverified.';
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t));
    elsif k in ('assigned_to', 'property_id') then
      if t !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" must be a uuid.', k);
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t));
    elsif k in ('owner_permission', 'removed') then
      if lower(t) not in ('true', 'false') then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" must be true or false.', k);
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t) = 'true');
    elsif k = 'facebook_thread_url' then
      if t !~* '^https?://' or char_length(t) > 1000 then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: facebook_thread_url must be an http(s) URL.';
      end if;
      v_out := v_out || jsonb_build_object(k, t);
    else
      v_max := case when k in ('requirement_notes', 'facilities', 'exact_address') then 2000 else 255 end;
      if char_length(t) > v_max then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" is too long (max %s characters).', k, v_max);
      end if;
      v_out := v_out || jsonb_build_object(k, t);
    end if;
  end loop;

  if (v_out ->> 'budget_min') is not null and (v_out ->> 'budget_max') is not null
     and (v_out ->> 'budget_min')::int > (v_out ->> 'budget_max')::int then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: budget_min cannot be greater than budget_max.';
  end if;
  return v_out;
end;
$$;

create or replace function public.co_enriched(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(e) from public.customer_orders_enriched e where e.id = p_order_id;
$$;

create or replace function public.co_log_activity(
  p_order_id uuid, p_actor_type text, p_actor_id uuid, p_actor_label text,
  p_action text, p_before jsonb default null, p_after jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.customer_order_activity (order_id, action, before, after, actor_type, actor_id, actor_label)
  values (p_order_id, p_action, p_before, p_after, p_actor_type, p_actor_id, p_actor_label);
$$;

-- Locks and returns a live (not soft-deleted) order.
create or replace function public.co_lock_order(p_order_id uuid)
returns public.customer_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_orders%rowtype;
begin
  select * into v_row from public.customer_orders where id = p_order_id and deleted_at is null for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Order was not found.';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Core functions (service_role only). Every one takes the actor explicitly:
--    p_actor_type is admin | api_agent | api_admin | system.
-- ---------------------------------------------------------------------------
create or replace function public.co_create_order(
  p_actor_type text, p_actor_id uuid, p_actor_label text,
  p_payload jsonb, p_idempotency_key text default null, p_confirm_duplicate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_existing uuid;
  v_dup text;
  v_id uuid;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_via text;
  v_area_key text;
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  if p_actor_type = 'system' then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: System orders are created by the website mirror only.';
  end if;
  if v_key is not null and char_length(v_key) > 200 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Idempotency-Key is too long (max 200 characters).';
  end if;

  -- A retry with the same key returns the original order.
  if v_key is not null then
    select id into v_existing from public.customer_orders
    where created_by_label = p_actor_label and idempotency_key = v_key;
    if found then
      return jsonb_build_object('order', public.co_enriched(v_existing), 'created', false);
    end if;
  end if;

  v := public.co_clean_fields(p_payload, array[
    'type', 'customer_name', 'customer_phone', 'facebook_name', 'facebook_thread_url', 'source',
    'area', 'rooms', 'budget_min', 'budget_max', 'move_in_date', 'tenant_type', 'gas', 'bathrooms', 'balconies',
    'facilities', 'requirement_notes', 'assigned_to', 'follow_up_at']);

  if (v ->> 'customer_name') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Customer name is required.';
  end if;
  if (v ->> 'customer_phone') is null and (v ->> 'facebook_thread_url') is null then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_VALIDATION: At least one contact channel is required (phone or Facebook thread URL).';
  end if;
  perform public.co_assert_assignable((v ->> 'assigned_to')::uuid);

  -- Second ACTIVE order for the same customer and the same area: warn, do not hard-block.
  v_area_key := lower(regexp_replace(coalesce(v ->> 'area', ''), '\s+', ' ', 'g'));
  if not coalesce(p_confirm_duplicate, false) then
    select o.order_no into v_dup
    from public.customer_orders o
    where o.deleted_at is null
      and o.status not in ('COMPLETED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE')
      and lower(regexp_replace(coalesce(o.area, ''), '\s+', ' ', 'g')) = v_area_key
      and ((o.customer_phone is not null and o.customer_phone = (v ->> 'customer_phone'))
        or ((v ->> 'customer_phone') is null and o.facebook_thread_url is not null
            and o.facebook_thread_url = (v ->> 'facebook_thread_url')))
    order by o.created_at desc
    limit 1;
    if v_dup is not null then
      raise exception using errcode = 'P0001',
        message = format('ADMIN_CONFLICT: An active order (%s) already exists for this customer and area.', v_dup),
        hint = format('duplicate_of=%s', v_dup);
    end if;
  end if;

  v_via := case when p_actor_type = 'api_agent' then 'ai_agent' else 'human_agent' end;

  insert into public.customer_orders (
    order_no, type, status, created_via, created_by_label, source,
    customer_name, customer_phone, facebook_name, facebook_thread_url,
    area, rooms, budget_min, budget_max, move_in_date, tenant_type, gas, bathrooms, balconies,
    facilities, requirement_notes, service_charge_bdt, assigned_to, follow_up_at, idempotency_key)
  values (
    '', 'HOUSE_SEARCH', 'PENDING', v_via, p_actor_label,
    coalesce(v ->> 'source', case when p_actor_type = 'api_agent' then 'messenger' else 'manual' end),
    v ->> 'customer_name', v ->> 'customer_phone', v ->> 'facebook_name', v ->> 'facebook_thread_url',
    v ->> 'area', (v ->> 'rooms')::int, (v ->> 'budget_min')::int, (v ->> 'budget_max')::int,
    (v ->> 'move_in_date')::date, v ->> 'tenant_type', v ->> 'gas', (v ->> 'bathrooms')::int, (v ->> 'balconies')::int,
    v ->> 'facilities', v ->> 'requirement_notes', public.co_service_charge('HOUSE_SEARCH'),
    (v ->> 'assigned_to')::uuid, (v ->> 'follow_up_at')::timestamptz, v_key)
  returning id into v_id;

  insert into public.customer_order_status_history (order_id, from_status, to_status, reason, actor_type, actor_id, actor_label)
  values (v_id, null, 'PENDING', 'Order created', p_actor_type, p_actor_id, p_actor_label);
  perform public.co_log_activity(v_id, p_actor_type, p_actor_id, p_actor_label, 'order.create', null, v);

  return jsonb_build_object('order', public.co_enriched(v_id), 'created', true);
end;
$$;

create or replace function public.co_update_order(
  p_actor_type text, p_actor_id uuid, p_actor_label text, p_order_id uuid, p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_row public.customer_orders%rowtype;
  v_before jsonb;
  v_min int;
  v_max int;
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  v := public.co_clean_fields(p_patch, array[
    'customer_name', 'customer_phone', 'facebook_name', 'facebook_thread_url', 'source',
    'area', 'rooms', 'budget_min', 'budget_max', 'move_in_date', 'tenant_type', 'gas', 'bathrooms', 'balconies',
    'facilities', 'requirement_notes', 'follow_up_at']);
  if v = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Nothing to update.';
  end if;

  v_row := public.co_lock_order(p_order_id);
  select coalesce(jsonb_object_agg(e.key, to_jsonb(v_row) -> e.key), '{}'::jsonb) into v_before from jsonb_each(v) e;

  if v ? 'customer_name' and (v ->> 'customer_name') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Customer name cannot be empty.';
  end if;
  if v ? 'source' and (v ->> 'source') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: source cannot be empty.';
  end if;
  if (case when v ? 'customer_phone' then v ->> 'customer_phone' else v_row.customer_phone end) is null
     and (case when v ? 'facebook_thread_url' then v ->> 'facebook_thread_url' else v_row.facebook_thread_url end) is null
     and v_row.customer_user_id is null then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_VALIDATION: At least one contact channel is required (phone or Facebook thread URL).';
  end if;
  v_min := case when v ? 'budget_min' then (v ->> 'budget_min')::int else v_row.budget_min end;
  v_max := case when v ? 'budget_max' then (v ->> 'budget_max')::int else v_row.budget_max end;
  if v_min is not null and v_max is not null and v_min > v_max then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: budget_min cannot be greater than budget_max.';
  end if;

  update public.customer_orders set
    customer_name = case when v ? 'customer_name' then v ->> 'customer_name' else customer_name end,
    customer_phone = case when v ? 'customer_phone' then v ->> 'customer_phone' else customer_phone end,
    facebook_name = case when v ? 'facebook_name' then v ->> 'facebook_name' else facebook_name end,
    facebook_thread_url = case when v ? 'facebook_thread_url' then v ->> 'facebook_thread_url' else facebook_thread_url end,
    source = case when v ? 'source' then v ->> 'source' else source end,
    area = case when v ? 'area' then v ->> 'area' else area end,
    rooms = case when v ? 'rooms' then (v ->> 'rooms')::int else rooms end,
    budget_min = v_min,
    budget_max = v_max,
    move_in_date = case when v ? 'move_in_date' then (v ->> 'move_in_date')::date else move_in_date end,
    tenant_type = case when v ? 'tenant_type' then v ->> 'tenant_type' else tenant_type end,
    gas = case when v ? 'gas' then v ->> 'gas' else gas end,
    bathrooms = case when v ? 'bathrooms' then (v ->> 'bathrooms')::int else bathrooms end,
    balconies = case when v ? 'balconies' then (v ->> 'balconies')::int else balconies end,
    facilities = case when v ? 'facilities' then v ->> 'facilities' else facilities end,
    requirement_notes = case when v ? 'requirement_notes' then v ->> 'requirement_notes' else requirement_notes end,
    follow_up_at = case when v ? 'follow_up_at' then (v ->> 'follow_up_at')::timestamptz else follow_up_at end
  where id = p_order_id;

  perform public.co_log_activity(p_order_id, p_actor_type, p_actor_id, p_actor_label, 'order.update', v_before, v);
  return jsonb_build_object('order', public.co_enriched(p_order_id), 'before', v_before, 'after', v);
end;
$$;

create or replace function public.co_set_status(
  p_actor_type text, p_actor_id uuid, p_actor_label text,
  p_order_id uuid, p_to_status text, p_reason text, p_taken_over_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_orders%rowtype;
  v_to text := upper(btrim(coalesce(p_to_status, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_taken text := nullif(btrim(coalesce(p_taken_over_by, '')), '');
  v_agent_allowed boolean;
  v_verified int;
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  v_row := public.co_lock_order(p_order_id);

  if v_to = '' then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: to_status is required.';
  end if;
  if v_reason is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required for every status change.';
  end if;
  if char_length(v_reason) > 1000 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Reason is too long (max 1000 characters).';
  end if;
  if v_to = v_row.status then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: The order is already %s.', v_to),
      hint = format('entity=customer_order;from=%s;to=%s', v_row.status, v_to);
  end if;
  if v_to in ('PAYMENT_CLAIMED', 'PAYMENT_VERIFIED', 'PAYMENT_FAILED') then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: %s is set only by recording or reviewing a payment claim.', v_to),
      hint = format('entity=customer_order;from=%s;to=%s', v_row.status, v_to);
  end if;

  select t.agent_allowed into v_agent_allowed
  from public.customer_order_transitions t
  where t.from_status = v_row.status and t.to_status = v_to;
  if not found then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: Cannot move %s → %s.', v_row.status, v_to),
      hint = format('entity=customer_order;from=%s;to=%s', v_row.status, v_to);
  end if;
  if p_actor_type = 'api_agent' and not v_agent_allowed then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_PERMISSION_DENIED: An agent key cannot move an order %s → %s.', v_row.status, v_to);
  end if;

  select coalesce(sum(amount_bdt), 0)::int into v_verified
  from public.customer_order_payment_claims where order_id = p_order_id and status = 'VERIFIED';

  if v_to = 'MATCHED' and v_verified < v_row.service_charge_bdt then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_INVALID_TRANSITION: MATCHED requires the full charge to be paid and verified.',
      hint = format('entity=customer_order;from=%s;to=%s', v_row.status, v_to);
  end if;
  if v_to = 'REFUND_REQUESTED' and v_verified <= 0 then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_INVALID_TRANSITION: A refund can be requested only after a verified payment.',
      hint = format('entity=customer_order;from=%s;to=%s', v_row.status, v_to);
  end if;
  if v_to in ('CANCELLED', 'SELF_SERVICE') and v_verified > 0 then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: This order has a verified payment; use REFUND_REQUESTED instead of %s.', v_to),
      hint = format('entity=customer_order;from=%s;to=%s', v_row.status, v_to);
  end if;
  if v_to = 'SEARCHING_BY_HUMAN' and v_taken is null then
    raise exception using errcode = 'P0001',
      message = 'ADMIN_VALIDATION: taken_over_by is required when a human takes over the search.';
  end if;

  update public.customer_orders set
    status = v_to,
    search_mode = case v_to when 'SEARCHING_BY_AI' then 'AI' when 'SEARCHING_BY_HUMAN' then 'HUMAN' else search_mode end,
    search_taken_over_by = case v_to when 'SEARCHING_BY_HUMAN' then v_taken when 'SEARCHING_BY_AI' then null else search_taken_over_by end
  where id = p_order_id;

  insert into public.customer_order_status_history (order_id, from_status, to_status, reason, taken_over_by, actor_type, actor_id, actor_label)
  values (p_order_id, v_row.status, v_to, v_reason,
          case when v_to = 'SEARCHING_BY_HUMAN' then v_taken end, p_actor_type, p_actor_id, p_actor_label);

  return jsonb_build_object('order', public.co_enriched(p_order_id), 'from_status', v_row.status, 'to_status', v_to);
end;
$$;

-- Records one payment or partial payment. This can only ever produce a CLAIMED
-- claim and (at most) the PAYMENT_CLAIMED order status; nothing here verifies.
create or replace function public.co_record_payment_claim(
  p_actor_type text, p_actor_id uuid, p_actor_label text,
  p_order_id uuid, p_amount_bdt int, p_trx_id text default null, p_sender_last4 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_orders%rowtype;
  v_trx text := nullif(upper(regexp_replace(coalesce(p_trx_id, ''), '\s', '', 'g')), '');
  v_last4 text := nullif(btrim(coalesce(p_sender_last4, '')), '');
  v_claim_id uuid;
  v_verified int;
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  if p_amount_bdt is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: amount_bdt is required for a payment claim.';
  end if;
  if p_amount_bdt <= 0 or p_amount_bdt > 1000000 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: amount_bdt must be a positive whole number of BDT.';
  end if;
  if v_trx is null and v_last4 is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Send trx_id or sender_last4 (either one is enough).';
  end if;
  if v_trx is not null and v_trx !~ '^[A-Z0-9]{6,30}$' then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: trx_id must be 6-30 letters and digits.';
  end if;
  if v_last4 is not null and v_last4 !~ '^[0-9]{4}$' then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: sender_last4 must be exactly 4 digits.';
  end if;

  v_row := public.co_lock_order(p_order_id);
  if v_row.status in ('COMPLETED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE', 'REFUND_REQUESTED') then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_INVALID_TRANSITION: A payment cannot be recorded on a %s order.', v_row.status),
      hint = format('entity=customer_order;from=%s;to=PAYMENT_CLAIMED', v_row.status);
  end if;
  if v_trx is not null and exists (
    select 1 from public.customer_order_payment_claims c where c.order_id = p_order_id and upper(c.trx_id) = v_trx
  ) then
    raise exception using errcode = 'P0001', message = 'ADMIN_CONFLICT: This TrxID is already recorded on the order.',
      hint = 'duplicate_trx';
  end if;

  insert into public.customer_order_payment_claims (order_id, amount_bdt, trx_id, sender_last4, claimed_by_type, claimed_by_label)
  values (p_order_id, p_amount_bdt, v_trx, v_last4, p_actor_type, p_actor_label)
  returning id into v_claim_id;

  select coalesce(sum(amount_bdt), 0)::int into v_verified
  from public.customer_order_payment_claims where order_id = p_order_id and status = 'VERIFIED';

  -- An order whose charge is already fully verified keeps its status; the new
  -- claim is an overpayment and is flagged by the view. Otherwise: PAYMENT_CLAIMED.
  if v_verified < v_row.service_charge_bdt and v_row.status <> 'PAYMENT_CLAIMED' then
    update public.customer_orders set status = 'PAYMENT_CLAIMED', payment_claimed_at = coalesce(payment_claimed_at, now())
    where id = p_order_id;
    insert into public.customer_order_status_history (order_id, from_status, to_status, reason, actor_type, actor_id, actor_label)
    values (p_order_id, v_row.status, 'PAYMENT_CLAIMED',
            format('Payment claim recorded: %s BDT (%s)', p_amount_bdt, case when v_trx is not null then 'TrxID' else 'sender last-4' end),
            p_actor_type, p_actor_id, p_actor_label);
  else
    update public.customer_orders set payment_claimed_at = coalesce(payment_claimed_at, now()) where id = p_order_id;
  end if;

  perform public.co_log_activity(p_order_id, p_actor_type, p_actor_id, p_actor_label, 'payment.claim', null,
    jsonb_build_object('claim_id', v_claim_id, 'amount_bdt', p_amount_bdt, 'trx_id', v_trx, 'sender_last4', v_last4));

  return jsonb_build_object('order', public.co_enriched(p_order_id), 'claim_id', v_claim_id);
end;
$$;

-- Verify or reject ONE claim. Human-only: an agent key is refused here as well
-- as in the API layer. Verifying never changes amounts; it flips the claim and,
-- once verified claims cover the full charge, the order.
create or replace function public.co_review_payment_claim(
  p_actor_type text, p_actor_id uuid, p_actor_label text,
  p_claim_id uuid, p_decision text, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.customer_order_payment_claims%rowtype;
  v_row public.customer_orders%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_verified int;
  v_live int;
  v_new_status text;
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  if p_actor_type not in ('admin', 'api_admin') then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: Only an authorised human can verify or reject a payment.';
  end if;
  if v_decision not in ('verify', 'reject') then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: decision must be verify or reject.';
  end if;
  if v_decision = 'reject' and v_note is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A note is required when rejecting a payment claim.';
  end if;

  select order_id into v_claim.order_id from public.customer_order_payment_claims where id = p_claim_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Payment claim was not found.';
  end if;
  v_row := public.co_lock_order(v_claim.order_id);
  select * into v_claim from public.customer_order_payment_claims where id = p_claim_id for update;
  if v_claim.status <> 'CLAIMED' then
    raise exception using errcode = 'P0001',
      message = format('ADMIN_CONFLICT: This claim is already %s.', v_claim.status);
  end if;

  update public.customer_order_payment_claims set
    status = case when v_decision = 'verify' then 'VERIFIED' else 'REJECTED' end,
    reviewed_by = p_actor_id, reviewed_by_label = p_actor_label, reviewed_at = now(), review_note = v_note
  where id = p_claim_id;

  select coalesce(sum(amount_bdt) filter (where status = 'VERIFIED'), 0)::int,
         count(*) filter (where status <> 'REJECTED')::int
    into v_verified, v_live
  from public.customer_order_payment_claims where order_id = v_row.id;

  if v_decision = 'verify' and v_verified >= v_row.service_charge_bdt then
    update public.customer_orders set payment_verified_at = coalesce(payment_verified_at, now()) where id = v_row.id;
    if v_row.status in ('PAYMENT_CLAIMED', 'PAYMENT_ISSUE', 'PAYMENT_INTERESTED', 'PAYMENT_FAILED') then
      v_new_status := 'PAYMENT_VERIFIED';
    end if;
  elsif v_decision = 'reject' and v_live = 0 and v_row.status = 'PAYMENT_CLAIMED' then
    v_new_status := 'PAYMENT_FAILED';
  end if;

  if v_new_status is not null then
    update public.customer_orders set status = v_new_status where id = v_row.id;
    insert into public.customer_order_status_history (order_id, from_status, to_status, reason, actor_type, actor_id, actor_label)
    values (v_row.id, v_row.status, v_new_status,
            case when v_decision = 'verify' then 'Payment verified in full' else coalesce('Payment claim rejected: ' || v_note, 'Payment claim rejected') end,
            p_actor_type, p_actor_id, p_actor_label);
  end if;

  perform public.co_log_activity(v_row.id, p_actor_type, p_actor_id, p_actor_label,
    case when v_decision = 'verify' then 'payment.verify' else 'payment.reject' end,
    jsonb_build_object('claim_id', p_claim_id, 'status', 'CLAIMED'),
    jsonb_build_object('claim_id', p_claim_id, 'status', case when v_decision = 'verify' then 'VERIFIED' else 'REJECTED' end,
                       'amount_bdt', v_claim.amount_bdt, 'note', v_note));

  return jsonb_build_object('order', public.co_enriched(v_row.id), 'claim_id', p_claim_id,
    'claim_status', case when v_decision = 'verify' then 'VERIFIED' else 'REJECTED' end);
end;
$$;

create or replace function public.co_add_note(
  p_actor_type text, p_actor_id uuid, p_actor_label text, p_order_id uuid, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_note_id bigint;
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  if v_body is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Note text is required.';
  end if;
  if char_length(v_body) > 4000 then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Note is too long (max 4000 characters).';
  end if;
  perform public.co_lock_order(p_order_id);
  insert into public.customer_order_notes (order_id, body, actor_type, actor_id, actor_label)
  values (p_order_id, v_body, p_actor_type, p_actor_id, p_actor_label)
  returning id into v_note_id;
  return jsonb_build_object('order', public.co_enriched(p_order_id), 'note_id', v_note_id);
end;
$$;

create or replace function public.co_add_match(
  p_actor_type text, p_actor_id uuid, p_actor_label text, p_order_id uuid, p_match jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_match_id uuid;
  v_permission boolean;
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  v := public.co_clean_fields(p_match, array[
    'reference_id', 'property_id', 'general_location', 'rent', 'verification_status',
    'owner_contact_phone', 'exact_address', 'owner_permission']);
  if (v ->> 'reference_id') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: reference_id is required for a match.';
  end if;
  if (v ->> 'property_id') is not null and not exists (select 1 from public.properties p where p.id = (v ->> 'property_id')::uuid) then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: property_id does not match a listing.';
  end if;
  perform public.co_lock_order(p_order_id);
  if exists (
    select 1 from public.customer_order_matches m
    where m.order_id = p_order_id and m.removed_at is null and lower(m.reference_id) = lower(v ->> 'reference_id')
  ) then
    raise exception using errcode = 'P0001', message = 'ADMIN_CONFLICT: This reference_id is already attached to the order.',
      hint = 'duplicate_match';
  end if;
  v_permission := coalesce((v ->> 'owner_permission')::boolean, false);

  insert into public.customer_order_matches (
    order_id, reference_id, property_id, general_location, rent, verification_status,
    owner_contact_phone, exact_address, owner_permission, owner_permission_recorded_by, owner_permission_recorded_at,
    created_by_type, created_by_label)
  values (
    p_order_id, v ->> 'reference_id', (v ->> 'property_id')::uuid, v ->> 'general_location', (v ->> 'rent')::int,
    coalesce(v ->> 'verification_status', 'unverified'), v ->> 'owner_contact_phone', v ->> 'exact_address',
    v_permission, case when v_permission then p_actor_label end, case when v_permission then now() end,
    p_actor_type, p_actor_label)
  returning id into v_match_id;

  perform public.co_log_activity(p_order_id, p_actor_type, p_actor_id, p_actor_label, 'match.add', null,
    jsonb_build_object('match_id', v_match_id, 'reference_id', v ->> 'reference_id',
                       'verification_status', coalesce(v ->> 'verification_status', 'unverified')));
  return jsonb_build_object('order', public.co_enriched(p_order_id), 'match_id', v_match_id);
end;
$$;

create or replace function public.co_update_match(
  p_actor_type text, p_actor_id uuid, p_actor_label text, p_match_id uuid, p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_match public.customer_order_matches%rowtype;
  v_before jsonb;
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  v := public.co_clean_fields(p_patch, array[
    'general_location', 'rent', 'verification_status', 'owner_contact_phone', 'exact_address', 'owner_permission', 'removed']);
  if v = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Nothing to update.';
  end if;
  select order_id into v_match.order_id from public.customer_order_matches where id = p_match_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Match was not found.';
  end if;
  perform public.co_lock_order(v_match.order_id);
  select * into v_match from public.customer_order_matches where id = p_match_id for update;
  if v_match.removed_at is not null then
    raise exception using errcode = 'P0001', message = 'ADMIN_CONFLICT: This match was removed from the order.';
  end if;
  if v ? 'verification_status' and (v ->> 'verification_status') is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: verification_status cannot be empty.';
  end if;
  select coalesce(jsonb_object_agg(e.key, to_jsonb(v_match) -> e.key), '{}'::jsonb) into v_before
  from jsonb_each(v - 'removed') e;

  update public.customer_order_matches set
    general_location = case when v ? 'general_location' then v ->> 'general_location' else general_location end,
    rent = case when v ? 'rent' then (v ->> 'rent')::int else rent end,
    verification_status = case when v ? 'verification_status' then v ->> 'verification_status' else verification_status end,
    owner_contact_phone = case when v ? 'owner_contact_phone' then v ->> 'owner_contact_phone' else owner_contact_phone end,
    exact_address = case when v ? 'exact_address' then v ->> 'exact_address' else exact_address end,
    owner_permission = case when v ? 'owner_permission' then coalesce((v ->> 'owner_permission')::boolean, false) else owner_permission end,
    owner_permission_recorded_by = case
      when v ? 'owner_permission' and coalesce((v ->> 'owner_permission')::boolean, false) is distinct from owner_permission
        then case when coalesce((v ->> 'owner_permission')::boolean, false) then p_actor_label end
      else owner_permission_recorded_by end,
    owner_permission_recorded_at = case
      when v ? 'owner_permission' and coalesce((v ->> 'owner_permission')::boolean, false) is distinct from owner_permission
        then case when coalesce((v ->> 'owner_permission')::boolean, false) then now() end
      else owner_permission_recorded_at end,
    removed_at = case when coalesce((v ->> 'removed')::boolean, false) then now() else removed_at end
  where id = p_match_id;

  perform public.co_log_activity(v_match.order_id, p_actor_type, p_actor_id, p_actor_label,
    case when coalesce((v ->> 'removed')::boolean, false) then 'match.remove' else 'match.update' end,
    v_before || jsonb_build_object('match_id', p_match_id), v || jsonb_build_object('match_id', p_match_id));
  return jsonb_build_object('order', public.co_enriched(v_match.order_id), 'match_id', p_match_id);
end;
$$;

create or replace function public.co_assign(
  p_actor_type text, p_actor_id uuid, p_actor_label text, p_order_id uuid, p_assigned_to uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.customer_orders%rowtype;
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  perform public.co_assert_assignable(p_assigned_to);
  v_row := public.co_lock_order(p_order_id);
  update public.customer_orders set assigned_to = p_assigned_to where id = p_order_id;
  perform public.co_log_activity(p_order_id, p_actor_type, p_actor_id, p_actor_label, 'order.assign',
    jsonb_build_object('assigned_to', v_row.assigned_to), jsonb_build_object('assigned_to', p_assigned_to));
  return jsonb_build_object('order', public.co_enriched(p_order_id), 'before', v_row.assigned_to);
end;
$$;

create or replace function public.co_soft_delete(
  p_actor_type text, p_actor_id uuid, p_actor_label text, p_order_id uuid, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.co_assert_actor(p_actor_type, p_actor_label);
  if p_actor_type not in ('admin', 'api_admin') then
    raise exception using errcode = 'P0001', message = 'ADMIN_PERMISSION_DENIED: An agent key cannot delete an order.';
  end if;
  if v_reason is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A reason is required to delete an order.';
  end if;
  perform public.co_lock_order(p_order_id);
  update public.customer_orders set deleted_at = now(), deleted_by_label = p_actor_label where id = p_order_id;
  perform public.co_log_activity(p_order_id, p_actor_type, p_actor_id, p_actor_label, 'order.delete', null,
    jsonb_build_object('reason', v_reason));
  return jsonb_build_object('order', public.co_enriched(p_order_id));
end;
$$;

-- Status history + notes + activity, newest first.
create or replace function public.co_timeline(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.item order by x.at desc, x.kind_order desc, x.ord desc), '[]'::jsonb)
  from (
    select h.created_at as at, 3 as kind_order, h.id as ord, jsonb_build_object(
      'kind', 'status', 'at', h.created_at, 'from_status', h.from_status, 'to_status', h.to_status, 'reason', h.reason,
      'taken_over_by', h.taken_over_by, 'actor_type', h.actor_type, 'actor_label', h.actor_label) as item
    from public.customer_order_status_history h where h.order_id = p_order_id
    union all
    select n.created_at, 2, n.id, jsonb_build_object(
      'kind', 'note', 'at', n.created_at, 'body', n.body, 'actor_type', n.actor_type, 'actor_label', n.actor_label)
    from public.customer_order_notes n where n.order_id = p_order_id
    union all
    select a.created_at, 1, a.id, jsonb_build_object(
      'kind', 'activity', 'at', a.created_at, 'action', a.action, 'before', a.before, 'after', a.after,
      'actor_type', a.actor_type, 'actor_label', a.actor_label)
    from public.customer_order_activity a where a.order_id = p_order_id
  ) x;
$$;

-- Fixed one-minute window per API key label. Returns false when over the limit.
create or replace function public.co_rate_limit_hit(p_key_label text, p_limit int default 120)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_hits int;
begin
  insert into public.customer_order_api_requests as r (key_label, window_start, hits)
  values (p_key_label, v_window, 1)
  on conflict (key_label, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if v_hits = 1 then
    delete from public.customer_order_api_requests where key_label = p_key_label and window_start < v_window - interval '10 minutes';
  end if;
  return v_hits <= greatest(coalesce(p_limit, 120), 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Website orders appear in the same list (created_via = 'customer').
--    The legacy row is read as jsonb so a missing optional column cannot break it.
-- ---------------------------------------------------------------------------
create or replace function public.co_mirror_legacy_order(p_legacy_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  l jsonb;
  u public.users%rowtype;
  v_id uuid;
  v_status text;
  v_notes text;
begin
  select to_jsonb(o) into l from public.orders o where o.id = p_legacy_id;
  if l is null or (l ->> 'archived_at') is not null then
    return null;
  end if;
  select id into v_id from public.customer_orders where legacy_order_id = p_legacy_id;
  if found then
    return v_id;
  end if;
  if (l ->> 'user_id') is not null then
    select * into u from public.users where id = (l ->> 'user_id')::uuid;
  end if;

  v_status := case l ->> 'status' when 'completed' then 'COMPLETED' when 'cancelled' then 'CANCELLED' else 'PENDING' end;
  v_notes := left(nullif(concat_ws(E'\n',
    case when nullif(l ->> 'category', '') is not null then 'Category: ' || (l ->> 'category') end,
    nullif(l ->> 'additional_preferences', '')), ''), 2000);

  insert into public.customer_orders (
    order_no, type, status, created_via, created_by_label, source, customer_user_id, customer_name, customer_phone,
    area, rooms, budget_max, move_in_date, requirement_notes, service_charge_bdt, legacy_order_id, created_at)
  values (
    '', 'HOUSE_SEARCH', v_status, 'customer', 'website-form', 'website', u.id,
    coalesce(nullif(btrim(u.full_name), ''), nullif(btrim(u.name), ''), nullif(btrim(u.email), ''), 'Website customer'),
    public.co_try_phone(u.phone),
    left(nullif(concat_ws(', ', nullif(l ->> 'area', ''), nullif(l ->> 'sub_area', ''), nullif(l ->> 'district', '')), ''), 255),
    case when (l ->> 'rooms')::int between 0 and 50 then (l ->> 'rooms')::int end,
    case when (l ->> 'max_budget')::int >= 0 then (l ->> 'max_budget')::int end,
    (l ->> 'property_need_from')::date, v_notes,
    -- The charge the website showed this customer, not the Messenger constant.
    case when coalesce((l ->> 'cost')::int, 0) > 0 then (l ->> 'cost')::int else public.co_service_charge('HOUSE_SEARCH') end,
    p_legacy_id, coalesce((l ->> 'created_at')::timestamptz, now()))
  returning id into v_id;

  insert into public.customer_order_status_history (order_id, from_status, to_status, reason, actor_type, actor_label)
  values (v_id, null, v_status, 'Order placed on the website', 'system', 'website-form');
  return v_id;
end;
$$;

create or replace function public.customer_orders_on_legacy_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.co_mirror_legacy_order(new.id);
  exception when others then
    -- Mirroring must never abort a customer's website order.
    raise warning 'customer_orders mirror failed for order %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_customer_orders_mirror on public.orders;
create trigger trg_customer_orders_mirror
  after insert on public.orders
  for each row execute function public.customer_orders_on_legacy_order();

-- Backfill the existing website orders (oldest first so numbers follow age).
do $$
declare
  r record;
begin
  for r in select id from public.orders order by created_at nulls last, id loop
    begin
      perform public.co_mirror_legacy_order(r.id);
    exception when others then
      raise warning 'customer_orders backfill skipped order %: %', r.id, sqlerrm;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Admin wrappers (dashboard). Permission check, then the same core function.
-- ---------------------------------------------------------------------------
create or replace function public.admin_customer_order_create(p_payload jsonb, p_confirm_duplicate boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_res jsonb;
  v_audit_id bigint;
begin
  v_res := public.co_create_order('admin', v_actor, public.co_admin_label(v_actor), p_payload, null, p_confirm_duplicate);
  v_audit_id := public.log_admin_action('customer_order.create', 'customer_order', v_res -> 'order' ->> 'id', null, null,
    jsonb_build_object('order_no', v_res -> 'order' ->> 'order_no'));
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_customer_order_update(p_order_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_res jsonb;
  v_audit_id bigint;
begin
  v_res := public.co_update_order('admin', v_actor, public.co_admin_label(v_actor), p_order_id, p_patch);
  v_audit_id := public.log_admin_action('customer_order.update', 'customer_order', p_order_id::text, null, v_res -> 'before', v_res -> 'after');
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_customer_order_set_status(
  p_order_id uuid, p_status text, p_reason text, p_taken_over_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_res jsonb;
  v_audit_id bigint;
begin
  v_res := public.co_set_status('admin', v_actor, public.co_admin_label(v_actor), p_order_id, p_status, p_reason, p_taken_over_by);
  v_audit_id := public.log_admin_action('customer_order.set_status', 'customer_order', p_order_id::text, p_reason,
    jsonb_build_object('status', v_res ->> 'from_status'), jsonb_build_object('status', v_res ->> 'to_status'));
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_customer_order_record_claim(
  p_order_id uuid, p_amount_bdt int, p_trx_id text default null, p_sender_last4 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_res jsonb;
  v_audit_id bigint;
begin
  v_res := public.co_record_payment_claim('admin', v_actor, public.co_admin_label(v_actor), p_order_id, p_amount_bdt, p_trx_id, p_sender_last4);
  v_audit_id := public.log_admin_action('customer_order.payment_claim', 'customer_order', p_order_id::text, null, null,
    jsonb_build_object('claim_id', v_res ->> 'claim_id', 'amount_bdt', p_amount_bdt));
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_customer_order_review_claim(p_claim_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('payments.review');
  v_res jsonb;
  v_audit_id bigint;
begin
  v_res := public.co_review_payment_claim('admin', v_actor, public.co_admin_label(v_actor), p_claim_id, p_decision, p_note);
  v_audit_id := public.log_admin_action('customer_order.payment_' || lower(btrim(p_decision)), 'customer_order',
    v_res -> 'order' ->> 'id', p_note, jsonb_build_object('claim_id', p_claim_id, 'status', 'CLAIMED'),
    jsonb_build_object('claim_id', p_claim_id, 'status', v_res ->> 'claim_status'));
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_customer_order_add_note(p_order_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_res jsonb;
begin
  v_res := public.co_add_note('admin', v_actor, public.co_admin_label(v_actor), p_order_id, p_body);
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', null);
end;
$$;

create or replace function public.admin_customer_order_add_match(p_order_id uuid, p_match jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_res jsonb;
  v_audit_id bigint;
begin
  v_res := public.co_add_match('admin', v_actor, public.co_admin_label(v_actor), p_order_id, p_match);
  v_audit_id := public.log_admin_action('customer_order.match_add', 'customer_order', p_order_id::text, null, null,
    jsonb_build_object('match_id', v_res ->> 'match_id'));
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_customer_order_update_match(p_match_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_res jsonb;
  v_audit_id bigint;
begin
  v_res := public.co_update_match('admin', v_actor, public.co_admin_label(v_actor), p_match_id, p_patch);
  v_audit_id := public.log_admin_action('customer_order.match_update', 'customer_order', v_res -> 'order' ->> 'id', null, null,
    jsonb_build_object('match_id', p_match_id) || coalesce(p_patch, '{}'::jsonb));
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_customer_order_assign(p_order_id uuid, p_assigned_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('orders.manage');
  v_res jsonb;
  v_audit_id bigint;
begin
  v_res := public.co_assign('admin', v_actor, public.co_admin_label(v_actor), p_order_id, p_assigned_to);
  v_audit_id := public.log_admin_action('customer_order.assign', 'customer_order', p_order_id::text, null,
    jsonb_build_object('assigned_to', v_res ->> 'before'), jsonb_build_object('assigned_to', p_assigned_to));
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', v_audit_id);
end;
$$;

create or replace function public.admin_customer_order_delete(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('payments.review');
  v_res jsonb;
  v_audit_id bigint;
begin
  v_res := public.co_soft_delete('admin', v_actor, public.co_admin_label(v_actor), p_order_id, p_reason);
  v_audit_id := public.log_admin_action('customer_order.delete', 'customer_order', p_order_id::text, p_reason, null,
    jsonb_build_object('deleted_at', v_res -> 'order' ->> 'deleted_at'));
  return jsonb_build_object('row', v_res -> 'order', 'audit_id', v_audit_id);
end;
$$;

-- One round trip for the detail screen.
create or replace function public.admin_customer_order_detail(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order jsonb;
begin
  perform public.assert_admin_permission('orders.manage');
  v_order := public.co_enriched(p_order_id);
  if v_order is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: Order was not found.';
  end if;
  return jsonb_build_object(
    'order', v_order,
    'claims', (select coalesce(jsonb_agg(to_jsonb(c) order by c.claimed_at desc), '[]'::jsonb)
               from public.customer_order_payment_claims c where c.order_id = p_order_id),
    'matches', (select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc), '[]'::jsonb)
                from public.customer_order_matches m where m.order_id = p_order_id and m.removed_at is null),
    'timeline', public.co_timeline(p_order_id));
end;
$$;

-- Dashboard counters and the sidebar badge.
create or replace function public.admin_customer_order_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public.assert_admin_permission('orders.manage');
  select jsonb_build_object(
    'open', count(*) filter (where e.status not in ('COMPLETED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE')),
    'awaiting_verification', count(*) filter (where e.claims_awaiting_verification > 0),
    'refund_window', count(*) filter (where e.payment_verified_at > now() - interval '7 days'
      and e.status not in ('COMPLETED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE')),
    'overdue_follow_ups', count(*) filter (where e.follow_up_at < now()
      and e.status not in ('COMPLETED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE')),
    'zero_listings', count(*) filter (where e.listings_found_count = 0
      and e.status not in ('COMPLETED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE')),
    'attention', count(*) filter (where e.claims_awaiting_verification > 0
      or (e.follow_up_at < now() and e.status not in ('COMPLETED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE')))
  ) into v
  from public.customer_orders_enriched e
  where e.deleted_at is null;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. EXECUTE grants: nothing new is callable by anon; only the admin wrappers
--    are callable by authenticated (each checks its permission itself).
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'co\_%' or p.proname like 'admin\_customer\_order\_%' or p.proname like 'customer\_order%')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
    if r.proname like 'admin\_customer\_order\_%' then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Assertions
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
  v_anon int;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'customer\_order%' and not c.relrowsecurity;
  if v_missing is not null then
    raise exception 'Customer order tables without RLS: %', v_missing;
  end if;

  select count(*) into v_anon
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname like 'co\_%' or p.proname like 'admin\_customer\_order\_%')
    and has_function_privilege('anon', p.oid, 'execute');
  if v_anon > 0 then
    raise exception 'Customer order functions executable by anon: %', v_anon;
  end if;

  if exists (select 1 from public.customer_order_transitions where to_status in ('PAYMENT_CLAIMED', 'PAYMENT_VERIFIED', 'PAYMENT_FAILED')) then
    raise exception 'Payment statuses must not be reachable through a manual transition';
  end if;
  if public.co_service_charge('HOUSE_SEARCH') <> 500 then
    raise exception 'HOUSE_SEARCH charge must be 500 BDT';
  end if;
end $$;

commit;
