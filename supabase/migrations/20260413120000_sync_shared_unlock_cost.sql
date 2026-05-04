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
  photo_view integer not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_settings_single_row check (id = true)
);

insert into public.credit_settings (id, property_listing, contact_view, photo_view)
values (true, 20, 20, 20)
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

update public.contact_views
set credits_spent = coalesce(credits_spent, 0)
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

with shared_unlock_cost as (
  select greatest(
    coalesce(cs.property_listing, cs.contact_view, cs.photo_view, ss.property_listing, ss.contact_view, ss.photo_view, 20),
    0
  ) as value
  from public.credit_settings cs
  left join public.site_settings ss on true
  where cs.id = true
  limit 1
)
update public.credit_settings
set
  property_listing = suc.value,
  contact_view = suc.value,
  photo_view = suc.value,
  updated_at = now()
from shared_unlock_cost suc
where id = true;

with shared_unlock_cost as (
  select greatest(
    coalesce(cs.property_listing, cs.contact_view, cs.photo_view, ss.property_listing, ss.contact_view, ss.photo_view, 20),
    0
  ) as value
  from public.credit_settings cs
  left join public.site_settings ss on true
  where cs.id = true
  limit 1
)
update public.site_settings
set
  property_listing = suc.value,
  contact_view = suc.value,
  photo_view = suc.value,
  updated_at = now()
from shared_unlock_cost suc;

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

  select greatest(coalesce(property_listing, contact_view, photo_view, 20), 0)
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
  )
  on conflict do nothing;

  return query
  select
    true,
    false,
    v_unlock_cost,
    v_remaining_credits;
end;
$$;
