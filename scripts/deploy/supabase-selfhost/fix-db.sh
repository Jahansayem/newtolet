#!/usr/bin/env bash
# Post-restore fixes: ltree/team_tree, pending migrations, failed FK rows.
set -uo pipefail
MIG=/root/migration
psql() { docker exec -i supabase-db psql -U postgres -d postgres "$@"; }

echo "== enable ltree, re-create team_tree from dump =="
psql -v ON_ERROR_STOP=0 -c "CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;" 2>&1 | tail -1
docker exec supabase-db pg_restore -U postgres -d postgres --no-owner --no-privileges \
  --disable-triggers -t team_tree /tmp/public.dump > "$MIG/restore-teamtree.log" 2>&1
echo "team_tree restore rc=$?"
psql -Atc "select 'team_tree='||count(*) from public.team_tree" 2>&1 | tail -1

echo "== reload feedback rows that failed FK =="
docker exec supabase-db pg_restore -U postgres -d postgres --data-only \
  --disable-triggers -t feedback /tmp/public.dump > "$MIG/restore-feedback.log" 2>&1
psql -Atc "select 'feedback='||count(*) from public.feedback" 2>&1 | tail -1

echo "== apply pending migrations in order =="
for f in $(ls -1 "$MIG/sql"/*.sql | sort); do
  name=$(basename "$f")
  out=$(psql -v ON_ERROR_STOP=0 -f - < "$f" 2>&1)
  errs=$(printf '%s' "$out" | grep -ciE "^ERROR")
  echo "  $name -> errors:$errs"
  printf '%s\n' "$out" | grep -iE "^ERROR" | grep -ivE "already exists|does not exist, skipping|duplicate" | head -3
done

echo "== verify app-required objects =="
psql -Atc "select 'pinned_until='||count(*) from information_schema.columns where table_name='properties' and column_name='pinned_until'"
psql -Atc "select 'catalog_view='||count(*) from pg_views where viewname='public_property_catalog'"
psql -Atc "select 'detail_rpc='||count(*) from pg_proc where proname='get_property_detail_for_viewer'"
psql -Atc "select 'oauth_cols='||count(*) from information_schema.columns where table_name='users' and column_name in ('avatar_url','google_id','provider','full_name')"
psql -Atc "select 'propid_seq='||count(*) from pg_class where relkind='S' and relname like '%property_id%'"
echo "FIX_DONE"
