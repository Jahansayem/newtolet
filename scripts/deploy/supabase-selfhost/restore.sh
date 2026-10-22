#!/usr/bin/env bash
# Restore the hosted dumps into the self-hosted Supabase database.
set -uo pipefail
cd /opt/supabase
MIG=/root/migration

for f in public.dump auth-data.dump storage-data.dump; do
  docker cp "$MIG/$f" supabase-db:/tmp/$f
done

echo "== restore public schema (DDL + data) =="
docker exec supabase-db pg_restore -U postgres -d postgres \
  --no-owner --no-privileges --disable-triggers /tmp/public.dump \
  > "$MIG/restore-public.log" 2>&1
echo "public restore rc=$? (object-exists errors are benign)"

echo "== public table count =="
docker exec supabase-db psql -U postgres -d postgres -Atc \
  "select count(*) from pg_tables where schemaname='public'"

echo "== row counts =="
docker exec supabase-db psql -U postgres -d postgres -Atc \
  "select 'properties='||(select count(*) from public.properties)
        ||' property_images='||(select count(*) from public.property_images)
        ||' orders='||(select count(*) from public.orders)
        ||' users='||(select count(*) from public.users)"

echo "== restore auth users/identities =="
docker exec supabase-db pg_restore -U postgres -d postgres \
  --data-only --disable-triggers /tmp/auth-data.dump \
  > "$MIG/restore-auth.log" 2>&1
echo "auth restore rc=$?"
docker exec supabase-db psql -U postgres -d postgres -Atc \
  "select 'auth_users='||(select count(*) from auth.users)||' identities='||(select count(*) from auth.identities)"

echo "== restore storage buckets/objects =="
docker exec supabase-db pg_restore -U postgres -d postgres \
  --data-only --disable-triggers /tmp/storage-data.dump \
  > "$MIG/restore-storage.log" 2>&1
echo "storage restore rc=$?"
docker exec supabase-db psql -U postgres -d postgres -Atc \
  "select 'buckets='||(select count(*) from storage.buckets)||' objects='||(select count(*) from storage.objects)"

echo "RESTORE_DONE"
