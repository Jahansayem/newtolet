#!/usr/bin/env bash
# Apply a migration to a throwaway copy of the production database and print checks.
# Runs ON THE VPS. Production is only read (pg_dump); all writes go to newtolet_staging.
#
# Usage (from the repo, PC side):
#   scp -i ~/.ssh/newtolet_vps supabase/migrations/<file>.sql scripts/deploy/supabase-selfhost/test-migration-on-staging.sh root@HOST:/root/
#   ssh -i ~/.ssh/newtolet_vps root@HOST 'bash /root/test-migration-on-staging.sh /root/<file>.sql'
#   (add KEEP=1 to keep the staging database afterwards)
#   Extra .sql files after the migration (seed, unseed, rollback ...) are applied in order once the checks pass.
set -euo pipefail

MIGRATION="${1:?migration file path required}"
shift
EXTRA=("$@")
CONTAINER="${CONTAINER:-supabase-db}"
STAGING_DB="newtolet_staging"
DUMP="/tmp/newtolet-staging.dump"

in_db() {
  # All commands run inside the DB container as supabase_admin over TCP (see newtolet-vps-deploy notes).
  docker exec -i "$CONTAINER" bash -c 'PGPASSWORD="$POSTGRES_PASSWORD" "$@"' _ "$@" </dev/null
}

echo "== cloning production into $STAGING_DB"
in_db psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q \
  -c "drop database if exists $STAGING_DB" -c "create database $STAGING_DB"
in_db pg_dump -h 127.0.0.1 -U supabase_admin -d postgres -Fc -f "$DUMP"
in_db pg_restore -h 127.0.0.1 -U supabase_admin -d "$STAGING_DB" --no-owner "$DUMP" >/tmp/staging-restore.log 2>&1 || true
echo "restore warnings: $(grep -c 'error' /tmp/staging-restore.log || true) (see /tmp/staging-restore.log)"
in_db psql -h 127.0.0.1 -U supabase_admin -d postgres -q -c "alter database $STAGING_DB owner to postgres"

sql() {
  in_db psql -h 127.0.0.1 -U supabase_admin -d "$STAGING_DB" -At -F ' | ' -c "$1"
}

# Migration-specific checks, chosen by file name.
checks_before() {
  case "$(basename "$MIGRATION")" in
    *qa_listing_quality*)
      sql "select 'approved listings', count(*) from public.properties where status = 'approved' and coalesce(is_active, true)
        union all select 'rent <= 1', count(*) from public.properties where rent_amount_bdt <= 1
        union all select 'negotiable', count(*) from public.properties where is_rent_negotiable
        union all select 'catalog view rows', count(*) from public.public_property_catalog" ;;
    *customer_orders*)
      sql "select 'website orders (public.orders)', count(*) from public.orders
        union all select 'customer_order tables', count(*) from information_schema.tables where table_schema = 'public' and table_name like 'customer\_order%'" ;;
    *) echo "(no specific checks for this migration)" ;;
  esac
}

checks_after() {
  case "$(basename "$MIGRATION")" in
    *qa_listing_quality*)
      checks_before
      sql "select 'expires_at null', count(*)::text from public.properties where expires_at is null
        union all select 'expires min/max', min(expires_at)::date || ' / ' || max(expires_at)::date from public.properties
        union all select 'whatsapp_enabled col', count(*)::text from information_schema.columns where table_name = 'properties' and column_name = 'whatsapp_enabled'
        union all select 'saved_searches table', count(*)::text from information_schema.tables where table_name = 'saved_searches'
        union all select 'new functions', count(*)::text from pg_proc where proname in
          ('renew_property_listing','verified_owner_property_ids','submit_user_verification','admin_review_user_verification','admin_set_report_status')" ;;
    *customer_orders*)
      checks_before
      sql "select 'customer_orders by created_via: ' || created_via, count(*)::text from public.customer_orders group by created_via
        union all select 'mirrored website orders', count(*)::text from public.customer_orders where legacy_order_id is not null
        union all select 'transitions', count(*)::text from public.customer_order_transitions
        union all select 'core + admin functions', count(*)::text from pg_proc where proname like 'co\_%' or proname like 'admin\_customer\_order\_%'
        union all select 'anon-executable (must be 0)', count(*)::text from pg_proc p where (p.proname like 'co\_%' or p.proname like 'admin\_customer\_order\_%') and has_function_privilege('anon', p.oid, 'execute')" ;;
    *) echo "(no specific checks for this migration)" ;;
  esac
}

echo "== before"
checks_before

echo "== applying $(basename "$MIGRATION")"
docker cp "$MIGRATION" "$CONTAINER:/tmp/migration.sql"
in_db psql -h 127.0.0.1 -U supabase_admin -d "$STAGING_DB" -v ON_ERROR_STOP=1 -f /tmp/migration.sql

echo "== after"
checks_after

echo "== re-running the migration (must be idempotent)"
in_db psql -h 127.0.0.1 -U supabase_admin -d "$STAGING_DB" -v ON_ERROR_STOP=1 -q -f /tmp/migration.sql && echo "second run OK"
checks_after

case "$(basename "$MIGRATION")" in
  *qa_listing_quality*)
    echo "== anon role can call the public lookup"
    sql "set role anon;
      select count(*) from public.verified_owner_property_ids(array(select id from public.properties limit 50));" ;;
  *customer_orders*)
    echo "== anon role must be refused"
    if sql "set role anon; select count(*) from public.customer_orders;" 2>/dev/null; then
      echo "FAIL: anon can read customer_orders"; exit 1
    else
      echo "anon denied OK"
    fi ;;
esac

for extra in "${EXTRA[@]:-}"; do
  [[ -n "$extra" ]] || continue
  echo "== applying extra file $(basename "$extra")"
  docker cp "$extra" "$CONTAINER:/tmp/extra.sql"
  in_db psql -h 127.0.0.1 -U supabase_admin -d "$STAGING_DB" -v ON_ERROR_STOP=1 -f /tmp/extra.sql
done

if [[ "${KEEP:-0}" != "1" ]]; then
  in_db psql -h 127.0.0.1 -U supabase_admin -d postgres -q -c "drop database $STAGING_DB"
  echo "staging database dropped"
fi
in_db rm -f "$DUMP" /tmp/migration.sql /tmp/extra.sql
echo "== done"
