grant select on public.property_images to anon, authenticated;
grant select on public.property_amenities to anon, authenticated;
grant insert, update, delete on public.property_images to authenticated;
grant insert, update, delete on public.property_amenities to authenticated;

alter table if exists public.property_images enable row level security;
alter table if exists public.property_amenities enable row level security;

drop policy if exists "Public can read approved property images" on public.property_images;
create policy "Public can read approved property images"
on public.property_images
for select
to anon, authenticated
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
      and (
        p.user_id = (select auth.uid())
        or public.is_current_user_admin()
      )
  )
);

drop policy if exists "Users can manage images for own properties" on public.property_images;
drop policy if exists "Users can insert images for own properties" on public.property_images;
create policy "Users can manage images for own properties"
on public.property_images
for all
to authenticated
using (
  exists (
    select 1
    from public.properties p
    where p.id = property_images.property_id
      and (
        p.user_id = (select auth.uid())
        or public.is_current_user_admin()
      )
  )
)
with check (
  exists (
    select 1
    from public.properties p
    where p.id = property_images.property_id
      and (
        p.user_id = (select auth.uid())
        or public.is_current_user_admin()
      )
  )
);

drop policy if exists "Public can read approved property amenities" on public.property_amenities;
create policy "Public can read approved property amenities"
on public.property_amenities
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.properties p
    where p.id = property_amenities.property_id
      and p.status = 'approved'
      and p.is_active is not false
  )
  or exists (
    select 1
    from public.properties p
    where p.id = property_amenities.property_id
      and (
        p.user_id = (select auth.uid())
        or public.is_current_user_admin()
      )
  )
);

drop policy if exists "Users can manage amenities for own properties" on public.property_amenities;
drop policy if exists "Users can insert amenities for own properties" on public.property_amenities;
create policy "Users can manage amenities for own properties"
on public.property_amenities
for all
to authenticated
using (
  exists (
    select 1
    from public.properties p
    where p.id = property_amenities.property_id
      and (
        p.user_id = (select auth.uid())
        or public.is_current_user_admin()
      )
  )
)
with check (
  exists (
    select 1
    from public.properties p
    where p.id = property_amenities.property_id
      and (
        p.user_id = (select auth.uid())
        or public.is_current_user_admin()
      )
  )
);
