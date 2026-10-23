alter table if exists public.properties
  add column if not exists is_pinned boolean default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_until timestamptz;

create or replace view public.public_property_catalog
with (security_invoker = true) as
select
  p.id,
  p.property_id_number,
  p.category,
  p.property_type,
  p.total_rooms,
  p.total_bathrooms,
  p.balcony,
  p.floor_level,
  p.occupancy,
  p.room_size_sqft,
  p.rent_amount_bdt,
  p.rent_period,
  p.state_district,
  p.area,
  p.sub_area,
  p.short_description,
  p.available_from,
  p.deadline,
  p.status,
  p.created_at,
  p.updated_at,
  p.reviewed_at,
  p.is_featured,
  p.is_active,
  p.is_pinned,
  p.pinned_at,
  p.pinned_until,
  p.total_kitchen,
  p.dining_rooms,
  p.living_rooms,
  p.is_rent_negotiable,
  p.lat,
  p.lng
from public.properties p
where p.status = 'approved'
  and coalesce(p.is_active, true) = true;

grant select on public.public_property_catalog to anon, authenticated;

create index if not exists idx_properties_active_pin_sort
on public.properties (pinned_until desc, created_at desc)
where pinned_until is not null;

create or replace function public.pin_property_for_24h(p_property_id uuid)
returns table (
  success boolean,
  property_id uuid,
  pinned_at timestamptz,
  pinned_until timestamptz,
  credits_spent integer,
  remaining_credits integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_property public.properties%rowtype;
  v_current_credits integer;
  v_remaining_credits integer;
  v_pin_cost integer := 50;
  v_pinned_at timestamptz := now();
  v_pinned_until timestamptz := now() + interval '24 hours';
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_property_id is null then
    raise exception 'Property is required.';
  end if;

  select *
  into v_property
  from public.properties
  where id = p_property_id
  for update;

  if not found then
    raise exception 'Property not found.';
  end if;

  if v_property.user_id is distinct from v_user_id then
    raise exception 'You can only pin your own property.';
  end if;

  if v_property.pinned_until is not null and v_property.pinned_until > now() then
    raise exception 'Property is already pinned.';
  end if;

  select credits
  into v_current_credits
  from public.users
  where id = v_user_id
  for update;

  if v_current_credits is null then
    raise exception 'User profile not found.';
  end if;

  if v_current_credits < v_pin_cost then
    raise exception 'You need 50 credits to pin this property.';
  end if;

  update public.users
  set
    credits = v_current_credits - v_pin_cost,
    updated_at = now()
  where id = v_user_id
    and credits >= v_pin_cost
  returning credits into v_remaining_credits;

  if v_remaining_credits is null then
    raise exception 'You need 50 credits to pin this property.';
  end if;

  update public.properties
  set
    is_pinned = true,
    pinned_at = v_pinned_at,
    pinned_until = v_pinned_until,
    updated_at = now()
  where id = p_property_id;

  insert into public.credit_transactions (
    user_id,
    credits_deducted,
    transaction_type,
    property_id,
    created_at,
    credits_amount,
    balance_after,
    reference_type,
    reference_id,
    metadata
  )
  values (
    v_user_id,
    v_pin_cost,
    'property_pin',
    p_property_id,
    now(),
    v_pin_cost,
    v_remaining_credits,
    'property_pin',
    p_property_id,
    jsonb_build_object(
      'property_id', p_property_id,
      'pinned_at', v_pinned_at,
      'pinned_until', v_pinned_until,
      'duration_hours', 24
    )
  );

  return query
  select
    true,
    p_property_id,
    v_pinned_at,
    v_pinned_until,
    v_pin_cost,
    v_remaining_credits;
end;
$$;

revoke all on function public.pin_property_for_24h(uuid) from public;
grant execute on function public.pin_property_for_24h(uuid) to authenticated;
