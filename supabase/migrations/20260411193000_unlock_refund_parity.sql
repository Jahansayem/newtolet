create extension if not exists pgcrypto;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and coalesce(is_admin, false) = true
  );
$$;

create table if not exists public.credit_settings (
  id boolean primary key default true,
  property_listing integer not null default 20,
  contact_view integer not null default 20,
  photo_view integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_settings_single_row check (id = true)
);

insert into public.credit_settings (id, property_listing, contact_view, photo_view)
values (true, 20, 20, 10)
on conflict (id) do nothing;

alter table if exists public.credit_settings enable row level security;

drop policy if exists "Anyone can read credit settings" on public.credit_settings;
create policy "Anyone can read credit settings"
on public.credit_settings
for select
to authenticated, anon
using (true);

drop policy if exists "Admins can manage credit settings" on public.credit_settings;
create policy "Admins can manage credit settings"
on public.credit_settings
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create table if not exists public.contact_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  credits_spent integer not null default 0,
  viewed_at timestamptz not null default now()
);

delete from public.contact_views
where user_id is null
   or property_id is null;

update public.contact_views
set credits_spent = 0
where credits_spent is null;

update public.contact_views
set viewed_at = now()
where viewed_at is null;

alter table if exists public.contact_views
  alter column user_id set not null,
  alter column property_id set not null,
  alter column credits_spent set not null,
  alter column credits_spent set default 0,
  alter column viewed_at set not null,
  alter column viewed_at set default now();

with ranked_contact_views as (
  select
    id,
    row_number() over (
      partition by user_id, property_id
      order by viewed_at asc nulls last, id asc
    ) as rn
  from public.contact_views
)
delete from public.contact_views
where id in (
  select id
  from ranked_contact_views
  where rn > 1
);

create unique index if not exists idx_contact_views_user_property_unique
on public.contact_views (user_id, property_id);

create index if not exists idx_contact_views_user_viewed_at
on public.contact_views (user_id, viewed_at desc);

create index if not exists idx_contact_views_property_id
on public.contact_views (property_id);

alter table if exists public.contact_views enable row level security;

drop policy if exists "Users can manage own contact views" on public.contact_views;
create policy "Users can manage own contact views"
on public.contact_views
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.contact_unlock_refund_requests (
  id uuid primary key default gen_random_uuid(),
  contact_view_id uuid not null references public.contact_views(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  reason_code text not null,
  details text,
  status text not null default 'requested',
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  credited_at timestamptz,
  credits_restored integer not null default 0,
  constraint contact_unlock_refund_requests_contact_view_unique unique (contact_view_id),
  constraint contact_unlock_refund_reason_code_check
    check (reason_code in ('rented_out', 'unreachable', 'wrong_location', 'other')),
  constraint contact_unlock_refund_status_check
    check (status in ('requested', 'approved', 'rejected'))
);

create index if not exists idx_contact_unlock_refund_requests_user_requested_at
on public.contact_unlock_refund_requests (user_id, requested_at desc);

create index if not exists idx_contact_unlock_refund_requests_status_requested_at
on public.contact_unlock_refund_requests (status, requested_at desc);

create index if not exists idx_contact_unlock_refund_requests_property_id
on public.contact_unlock_refund_requests (property_id);

alter table if exists public.contact_unlock_refund_requests enable row level security;

drop policy if exists "Users can read own contact unlock refund requests" on public.contact_unlock_refund_requests;
create policy "Users can read own contact unlock refund requests"
on public.contact_unlock_refund_requests
for select
to authenticated
using (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "Users can create own contact unlock refund requests" on public.contact_unlock_refund_requests;
create policy "Users can create own contact unlock refund requests"
on public.contact_unlock_refund_requests
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Admins can update contact unlock refund requests" on public.contact_unlock_refund_requests;
create policy "Admins can update contact unlock refund requests"
on public.contact_unlock_refund_requests
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create or replace function public.unlock_property_contact(p_property_id uuid)
returns table (
  success boolean,
  already_unlocked boolean,
  credits_spent integer,
  remaining_credits integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_contact_view public.contact_views;
  v_current_credits integer;
  v_unlock_cost integer := 20;
  v_remaining_credits integer;
  v_new_contact_view public.contact_views;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_property_id is null then
    raise exception 'Property is required.';
  end if;

  perform 1
  from public.properties
  where id = p_property_id;

  if not found then
    raise exception 'Property not found.';
  end if;

  select credits
  into v_current_credits
  from public.users
  where id = v_user_id
  for update;

  if v_current_credits is null then
    raise exception 'User profile not found.';
  end if;

  select *
  into v_existing_contact_view
  from public.contact_views
  where user_id = v_user_id
    and property_id = p_property_id
  limit 1;

  if found then
    return query
    select
      true,
      true,
      coalesce(v_existing_contact_view.credits_spent, 0),
      v_current_credits;
    return;
  end if;

  select coalesce(contact_view, 20)
  into v_unlock_cost
  from public.credit_settings
  where id = true;

  v_unlock_cost := greatest(coalesce(v_unlock_cost, 20), 0);

  if v_current_credits < v_unlock_cost then
    raise exception 'Insufficient credits';
  end if;

  update public.users
  set
    credits = v_current_credits - v_unlock_cost,
    updated_at = now()
  where id = v_user_id
  returning credits into v_remaining_credits;

  insert into public.contact_views (
    user_id,
    property_id,
    credits_spent,
    viewed_at
  )
  values (
    v_user_id,
    p_property_id,
    v_unlock_cost,
    now()
  )
  returning *
  into v_new_contact_view;

  insert into public.credit_transactions (
    user_id,
    credits_deducted,
    transaction_type,
    property_id,
    created_at,
    balance_after,
    reference_type,
    reference_id,
    metadata
  )
  values (
    v_user_id,
    v_unlock_cost,
    'contact_view',
    p_property_id,
    now(),
    v_remaining_credits,
    'contact_view',
    v_new_contact_view.id,
    jsonb_build_object(
      'contact_view_id', v_new_contact_view.id,
      'property_id', p_property_id
    )
  );

  return query
  select
    true,
    false,
    v_unlock_cost,
    v_remaining_credits;
end;
$$;

create or replace function public.create_contact_unlock_refund_request(
  p_contact_view_id uuid,
  p_reason_code text,
  p_details text default null
)
returns setof public.contact_unlock_refund_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_contact_view public.contact_views;
  v_existing_request public.contact_unlock_refund_requests;
  v_created_request public.contact_unlock_refund_requests;
  v_reason_code text := lower(coalesce(trim(p_reason_code), ''));
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_contact_view_id is null then
    raise exception 'Unlock record is required.';
  end if;

  if v_reason_code not in ('rented_out', 'unreachable', 'wrong_location', 'other') then
    raise exception 'Unsupported refund reason.';
  end if;

  select *
  into v_contact_view
  from public.contact_views
  where id = p_contact_view_id;

  if v_contact_view.id is null then
    raise exception 'Unlock record not found.';
  end if;

  if v_contact_view.user_id <> v_user_id then
    raise exception 'You can only request a refund for your own unlock.';
  end if;

  if now() > v_contact_view.viewed_at + interval '72 hours' then
    raise exception 'Refund requests must be submitted within 72 hours of unlock.';
  end if;

  select *
  into v_existing_request
  from public.contact_unlock_refund_requests
  where contact_view_id = p_contact_view_id
  limit 1;

  if v_existing_request.id is not null then
    raise exception 'A refund request already exists for this unlock.';
  end if;

  insert into public.contact_unlock_refund_requests (
    contact_view_id,
    user_id,
    property_id,
    reason_code,
    details,
    status,
    requested_at,
    credits_restored
  )
  values (
    v_contact_view.id,
    v_contact_view.user_id,
    v_contact_view.property_id,
    v_reason_code,
    nullif(trim(coalesce(p_details, '')), ''),
    'requested',
    now(),
    0
  )
  returning *
  into v_created_request;

  return next v_created_request;
end;
$$;

create or replace function public.review_contact_unlock_refund_request(
  p_request_id uuid,
  p_status text,
  p_admin_note text default null
)
returns setof public.contact_unlock_refund_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.contact_unlock_refund_requests;
  v_contact_view public.contact_views;
  v_new_balance integer;
  v_next_status text := lower(coalesce(trim(p_status), ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_current_user_admin() then
    raise exception 'Admin access required.';
  end if;

  if p_request_id is null then
    raise exception 'Refund request is required.';
  end if;

  if v_next_status not in ('approved', 'rejected') then
    raise exception 'Unsupported refund status.';
  end if;

  select *
  into v_request
  from public.contact_unlock_refund_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Refund request not found.';
  end if;

  if v_request.status <> 'requested' then
    raise exception 'Refund request has already been reviewed.';
  end if;

  select *
  into v_contact_view
  from public.contact_views
  where id = v_request.contact_view_id;

  if v_contact_view.id is null then
    raise exception 'Unlock record not found for refund request.';
  end if;

  if v_next_status = 'approved' then
    update public.users
    set
      credits = coalesce(credits, 0) + coalesce(v_contact_view.credits_spent, 0),
      updated_at = now()
    where id = v_request.user_id
    returning credits into v_new_balance;

    insert into public.credit_transactions (
      user_id,
      credits_deducted,
      transaction_type,
      property_id,
      created_at,
      balance_after,
      reference_type,
      reference_id,
      metadata
    )
    values (
      v_request.user_id,
      coalesce(v_contact_view.credits_spent, 0) * -1,
      'contact_view_refund',
      v_request.property_id,
      now(),
      v_new_balance,
      'contact_unlock_refund_request',
      v_request.id,
      jsonb_build_object(
        'contact_view_id', v_request.contact_view_id,
        'approved_by', auth.uid()
      )
    );

    update public.contact_unlock_refund_requests
    set
      status = 'approved',
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      reviewed_at = now(),
      credited_at = now(),
      credits_restored = coalesce(v_contact_view.credits_spent, 0)
    where id = v_request.id
    returning *
    into v_request;
  else
    update public.contact_unlock_refund_requests
    set
      status = 'rejected',
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      reviewed_at = now()
    where id = v_request.id
    returning *
    into v_request;
  end if;

  return next v_request;
end;
$$;

create or replace function public.get_property_contact_unlock_analytics(p_property_id uuid)
returns table (
  contact_unlocks integer,
  total_credits_spent integer,
  recent_view_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_property_id is null then
    raise exception 'Property is required.';
  end if;

  select user_id
  into v_owner_id
  from public.properties
  where id = p_property_id;

  if v_owner_id is null then
    raise exception 'Property not found.';
  end if;

  if v_owner_id <> v_user_id and not public.is_current_user_admin() then
    raise exception 'Access denied.';
  end if;

  return query
  select
    (
      select count(*)
      from public.contact_views cv
      where cv.property_id = p_property_id
    )::integer as contact_unlocks,
    (
      select coalesce(sum(cv.credits_spent), 0)
      from public.contact_views cv
      where cv.property_id = p_property_id
    )::integer as total_credits_spent,
    (
      select coalesce(sum(pvh.view_count), 0)
      from public.property_view_history pvh
      where pvh.property_id = p_property_id
    )::integer as recent_view_count;
end;
$$;

grant execute on function public.unlock_property_contact(uuid) to authenticated;
grant execute on function public.create_contact_unlock_refund_request(uuid, text, text) to authenticated;
grant execute on function public.review_contact_unlock_refund_request(uuid, text, text) to authenticated;
grant execute on function public.get_property_contact_unlock_analytics(uuid) to authenticated;
