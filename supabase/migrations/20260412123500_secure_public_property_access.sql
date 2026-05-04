begin;

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

alter table if exists public.properties enable row level security;

drop policy if exists "Users can insert own properties" on public.properties;
create policy "Users can insert own properties"
on public.properties
for insert
to authenticated
with check (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "Users can read own properties or admin can read all" on public.properties;
create policy "Users can read own properties or admin can read all"
on public.properties
for select
to authenticated
using (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "Users can update own properties or admin can update all" on public.properties;
create policy "Users can update own properties or admin can update all"
on public.properties
for update
to authenticated
using (auth.uid() = user_id or public.is_current_user_admin())
with check (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists "Users can delete own properties or admin can delete all" on public.properties;
create policy "Users can delete own properties or admin can delete all"
on public.properties
for delete
to authenticated
using (auth.uid() = user_id or public.is_current_user_admin());

create or replace function public.get_property_detail_for_viewer(p_property_id uuid)
returns table (
  id uuid,
  user_id uuid,
  property_id_number text,
  category text,
  property_type text,
  total_rooms integer,
  total_bathrooms integer,
  balcony integer,
  floor_level text,
  occupancy text,
  room_size_sqft integer,
  rent_amount_bdt integer,
  rent_period text,
  state_district text,
  area text,
  sub_area text,
  contact_number text,
  short_description text,
  sector text,
  road text,
  house_plot text,
  lat numeric,
  lng numeric,
  available_from date,
  deadline date,
  status text,
  created_at timestamp,
  updated_at timestamp,
  reviewed_at timestamptz,
  is_featured boolean,
  is_active boolean,
  is_pinned boolean,
  total_kitchen integer,
  dining_rooms integer,
  living_rooms integer,
  is_rent_negotiable boolean,
  protected_contact_unlocked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property public.properties%rowtype;
  v_viewer_id uuid := auth.uid();
  v_can_reveal boolean := false;
begin
  if p_property_id is null then
    raise exception 'Property is required.';
  end if;

  select *
  into v_property
  from public.properties
  where properties.id = p_property_id
  limit 1;

  if not found then
    raise exception 'Property not found.';
  end if;

  if coalesce(v_property.is_active, true) = false
     and v_property.user_id is distinct from v_viewer_id
     and not public.is_current_user_admin() then
    raise exception 'Property not found.';
  end if;

  if v_property.status <> 'approved'
     and v_property.user_id is distinct from v_viewer_id
     and not public.is_current_user_admin() then
    raise exception 'Property not found.';
  end if;

  v_can_reveal :=
    public.is_current_user_admin()
    or (v_viewer_id is not null and v_property.user_id = v_viewer_id)
    or exists (
      select 1
      from public.contact_views cv
      where cv.user_id = v_viewer_id
        and cv.property_id = v_property.id
    );

  return query
  select
    v_property.id,
    v_property.user_id,
    v_property.property_id_number,
    v_property.category,
    v_property.property_type,
    v_property.total_rooms,
    v_property.total_bathrooms,
    v_property.balcony,
    v_property.floor_level,
    v_property.occupancy,
    v_property.room_size_sqft,
    v_property.rent_amount_bdt,
    v_property.rent_period,
    v_property.state_district,
    v_property.area,
    v_property.sub_area,
    case when v_can_reveal then v_property.contact_number else null end,
    v_property.short_description,
    case when v_can_reveal then v_property.sector else null end,
    case when v_can_reveal then v_property.road else null end,
    case when v_can_reveal then v_property.house_plot else null end,
    v_property.lat::numeric,
    v_property.lng::numeric,
    v_property.available_from,
    v_property.deadline,
    v_property.status,
    v_property.created_at,
    v_property.updated_at,
    v_property.reviewed_at,
    v_property.is_featured,
    coalesce(v_property.is_active, true),
    coalesce(v_property.is_pinned, false),
    v_property.total_kitchen,
    v_property.dining_rooms,
    v_property.living_rooms,
    coalesce(v_property.is_rent_negotiable, false),
    v_can_reveal;
end;
$$;

grant execute on function public.get_property_detail_for_viewer(uuid) to anon, authenticated;

commit;
