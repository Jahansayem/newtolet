#!/usr/bin/env bash
# Apply the storage bucket + storage.objects RLS policies to the self-hosted
# Supabase stack on the VPS.
#
#   bash scripts/deploy/supabase-selfhost/apply-storage-policies.sh HOST [SSH_KEY]
#
#   HOST     VPS IP or hostname (user defaults to root; use user@host to override)
#   SSH_KEY  private key path, default ~/.ssh/newtolet_vps
#
# Why: restore.sh loaded storage.buckets/storage.objects with `pg_restore
# --data-only`, which brings the rows but none of the RLS policies (policies are
# DDL). With RLS on and no policies, every browser upload (role `authenticated`)
# is rejected with "new row violates row-level security policy"; the admin
# cover-photo upload was the first one noticed, but property-images and
# id-documents are affected the same way.
#
# The SQL lives in supabase/migrations/20261024120000_storage_bucket_policies.sql
# (single source of truth); this script only streams it into psql, printing the
# policy state before and after. It is idempotent and safe to re-run.
#
# The Claude Code auto-mode classifier blocks remote DB writes; run this with
# the `!` prefix from the prompt.

set -euo pipefail

TARGET="${1:?usage: apply-storage-policies.sh HOST [SSH_KEY]}"
SSH_KEY="${2:-$HOME/.ssh/newtolet_vps}"
case "$TARGET" in
  *@*) ;;
  *) TARGET="root@$TARGET" ;;
esac

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MIGRATION="$REPO/supabase/migrations/20261024120000_storage_bucket_policies.sql"
if [[ ! -f "$MIGRATION" ]]; then
  echo "migration not found: $MIGRATION" >&2
  exit 1
fi

SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

# One psql round-trip per call; the SQL travels on stdin so every statement's
# result is printed (psql -c only shows the last one on older versions).
remote_sql() {
  ssh "${SSH_OPTS[@]}" "$TARGET" \
    "docker exec -i supabase-db psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -f -" <<<"$1"
}

STATE_SQL="
select 'bucket: '||id||' public='||public
       ||' limit='||coalesce(file_size_limit::text,'-')
       ||' mime='||coalesce(array_to_string(allowed_mime_types,','),'-')
  from storage.buckets order by id;
select 'rls_enabled='||relrowsecurity from pg_class where oid='storage.objects'::regclass;
select 'policy: '||policyname||' ['||cmd||'] roles='||roles::text
  from pg_policies where schemaname='storage' and tablename='objects' order by policyname;
select 'policy_count='||count(*)
  from pg_policies where schemaname='storage' and tablename='objects';
"

echo "== before =="
remote_sql "$STATE_SQL"
HAS_ADMIN_FN="$(remote_sql "select count(*) from pg_proc where proname='is_current_user_admin';")"
if [[ "$HAS_ADMIN_FN" == "0" ]]; then
  echo "public.is_current_user_admin() is missing on the VPS; apply DATABASE_SCHEMA.sql first" >&2
  exit 1
fi

# storage.objects is owned by supabase_storage_admin on the self-hosted stack;
# ENABLE ROW LEVEL SECURITY and CREATE POLICY both require the table owner or a
# superuser, and `postgres` is neither there ("must be owner of table objects").
# The unix socket only peer-authenticates `postgres`, so connect over TCP inside
# the container as the superuser `supabase_admin` with the container's own
# POSTGRES_PASSWORD (the secret never leaves the VPS).
echo "== applying $(basename "$MIGRATION") as supabase_admin =="
ssh "${SSH_OPTS[@]}" "$TARGET" \
  "docker exec -i supabase-db sh -c 'PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f -'" \
  < "$MIGRATION"

echo "== after =="
remote_sql "$STATE_SQL"

EXPECTED=(
  storage_cover_photos_select storage_cover_photos_insert
  storage_cover_photos_update storage_cover_photos_delete
  storage_property_images_select storage_property_images_insert
  storage_property_images_update storage_property_images_delete
  storage_id_documents_select storage_id_documents_insert
  storage_id_documents_update storage_id_documents_delete
)
PRESENT="$(remote_sql "select policyname from pg_policies where schemaname='storage' and tablename='objects';")"
MISSING=0
for p in "${EXPECTED[@]}"; do
  if ! grep -qx "$p" <<<"$PRESENT"; then
    echo "missing policy: $p" >&2
    MISSING=1
  fi
done
if [[ "$MISSING" == "1" ]]; then
  exit 1
fi
echo "STORAGE_POLICIES_DONE"
