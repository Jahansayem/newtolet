-- Listing availability status and "rent includes" (thetolet parity, claudedocs/thetolet-parity-plan.md
-- Prompt 3).
--
-- availability_status: 'available' (default), 'coming_soon', or 'rented'. Owners mark a listing rented
--   from My Properties; that only changes this column, so the listing stays approved (see the
--   prevent_direct_property_moderation_changes trigger: it guards status, not this column). Rented
--   listings stay readable on their detail page (with a banner) but the site leaves them out of
--   search and the home page.
-- rent_includes: which bills the monthly rent already covers. Empty array = not stated.
--
-- The site works before and after this migration: propertyCatalogService probes for the column and
-- only filters on it once it exists. Apply this BEFORE deploying a build that saves the new fields,
-- otherwise saving a listing with them fails with "column does not exist".

begin;

alter table public.properties
  add column if not exists availability_status text not null default 'available',
  add column if not exists rent_includes text[] not null default '{}';

alter table public.properties drop constraint if exists properties_availability_status_check;
alter table public.properties add constraint properties_availability_status_check
  check (availability_status in ('available', 'coming_soon', 'rented'));

-- Keep in sync with RENT_INCLUDES_OPTIONS in src/lib/listingAvailability.js.
alter table public.properties drop constraint if exists properties_rent_includes_check;
alter table public.properties add constraint properties_rent_includes_check
  check (rent_includes <@ array[
    'water', 'gas', 'electricity', 'service_charge', 'security',
    'internet', 'lift', 'generator', 'parking'
  ]::text[]);

-- Same columns, in the same order, as 20261114120000_qa_listing_quality.sql, with the two new ones
-- appended. Appending lets "create or replace" keep the view in place (no drop needed).
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
  p.lng,
  p.expires_at,
  p.whatsapp_enabled,
  p.availability_status,
  p.rent_includes
from public.properties p
where p.status = 'approved'
  and coalesce(p.is_active, true) = true
  and p.deleted_at is null
  and (p.expires_at is null or p.expires_at > now());

grant select on public.public_property_catalog to anon, authenticated, service_role;

-- The detail page now shows "Last updated". DATABASE_SCHEMA.sql defines this trigger but no migration
-- did, so make sure it exists. View counts live in property_view_history, so viewing a listing does
-- not change its updated_at.
drop trigger if exists trg_properties_set_updated_at on public.properties;
create trigger trg_properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

commit;
