-- Revert of supabase/migrations/20261112090000_backfill_total_rooms_from_dining.sql.
-- Clears total_rooms on the listings the backfill filled, but only where the
-- value is still the one the backfill wrote (a later edit is kept), then drops
-- the record table.
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/rollback-total-rooms-backfill.sql

begin;

update public.properties p
set total_rooms = null
from public.properties_total_rooms_backfill_20261112 b
where p.id = b.property_id
  and p.total_rooms = b.dining_rooms;

drop table public.properties_total_rooms_backfill_20261112;

select 'TOTAL_ROOMS_BACKFILL_ROLLED_BACK';

commit;
