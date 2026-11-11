-- Backfill properties.total_rooms for listings made through the website form.
--
-- Until 2026-11-12 the Add/Edit listing forms had a "Rooms" counter that saved
-- into dining_rooms, and nothing wrote total_rooms. Cards, the detail page and
-- the rooms filter read total_rooms, so those listings showed no room count.
--
-- This copies dining_rooms into total_rooms where total_rooms is empty.
-- Listings owned by the API agent account are skipped: the agent API fills
-- dining_rooms on purpose. dining_rooms itself is left unchanged.
--
-- The touched rows are recorded in properties_total_rooms_backfill_20261112 so
-- the change can be reverted with
-- scripts/deploy/supabase-selfhost/rollback-total-rooms-backfill.sql.
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < supabase/migrations/20261112090000_backfill_total_rooms_from_dining.sql

begin;

create table if not exists public.properties_total_rooms_backfill_20261112 (
  property_id uuid primary key,
  dining_rooms integer not null,
  backfilled_at timestamptz not null default now()
);

alter table public.properties_total_rooms_backfill_20261112 enable row level security;
revoke all on public.properties_total_rooms_backfill_20261112 from public, anon, authenticated;

insert into public.properties_total_rooms_backfill_20261112 (property_id, dining_rooms)
select p.id, p.dining_rooms
from public.properties p
where p.total_rooms is null
  and p.dining_rooms > 0
  and not exists (
    select 1 from public.users u
    where u.id = p.user_id and u.email = 'ai-agent@newtolet.com'
  )
on conflict (property_id) do nothing;

update public.properties p
set total_rooms = b.dining_rooms
from public.properties_total_rooms_backfill_20261112 b
where p.id = b.property_id
  and p.total_rooms is null;

select 'TOTAL_ROOMS_BACKFILLED rows=' || count(*)
from public.properties_total_rooms_backfill_20261112;

commit;
