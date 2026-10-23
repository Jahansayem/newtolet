#!/usr/bin/env bash
# Restore the constraints, indexes and RLS policies of public.team_tree on the
# self-hosted Supabase stack from the hosted-project dump.
#
#   bash scripts/deploy/supabase-selfhost/repair-team-tree.sh HOST [DUMP] [SSH_KEY]
#
#   HOST     VPS IP or hostname (user defaults to root; use user@host to override)
#   DUMP     path of the pg_dump custom-format file on the VPS,
#            default /root/migration/public.dump
#   SSH_KEY  private key path, default ~/.ssh/newtolet_vps
#
# Why: fix-db.sh re-created team_tree with `pg_restore -t team_tree`, which copied
# the table and rows but none of the post-data objects. Without the UNIQUE (user_id)
# key, upsert_team_tree_entry()'s `ON CONFLICT (user_id)` raises
# "there is no unique or exclusion constraint matching the ON CONFLICT specification"
# and GoTrue answers every signup with "Database error creating new user".
#
# The script restores exactly the dump's TOC entries for team_tree:
#   team_tree_pkey, team_tree_user_id_key, idx_team_tree_*, team_tree_*_fkey,
#   the two "Users can view ..." policies and ROW SECURITY.
# It is additive and idempotent (existing objects produce "already exists" notices).

set -euo pipefail

TARGET="${1:?usage: repair-team-tree.sh HOST [DUMP] [SSH_KEY]}"
DUMP="${2:-/root/migration/public.dump}"
SSH_KEY="${3:-$HOME/.ssh/newtolet_vps}"
case "$TARGET" in
  *@*) ;;
  *) TARGET="root@$TARGET" ;;
esac

SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

ssh "${SSH_OPTS[@]}" "$TARGET" bash -s -- "$DUMP" <<'REMOTE'
set -euo pipefail
DUMP="$1"
# </dev/null everywhere: this script arrives on stdin, so children must not read it.
Q() { docker exec supabase-db psql -U postgres -d postgres -Atc "$1" </dev/null; }

if [[ ! -f "$DUMP" ]]; then
  echo "dump not found: $DUMP" >&2
  exit 1
fi

echo "== before =="
echo "constraints: $(Q "select count(*) from pg_constraint where conrelid='public.team_tree'::regclass;")"
echo "indexes:     $(Q "select count(*) from pg_indexes where schemaname='public' and tablename='team_tree';")"
echo "rows / duplicate user_id: $(Q "select count(*)||' / '||(count(*)-count(distinct user_id)) from public.team_tree;")"

DUP="$(Q "select count(*)-count(distinct user_id) from public.team_tree;")"
if [[ "$DUP" != "0" ]]; then
  echo "team_tree has duplicate user_id rows; resolve them before adding the unique key" >&2
  exit 1
fi

docker cp "$DUMP" supabase-db:/tmp/team_tree_repair.dump </dev/null
docker exec supabase-db sh -c '
  set -e
  pg_restore -l /tmp/team_tree_repair.dump \
    | grep -E "(CONSTRAINT|FK CONSTRAINT|POLICY|ROW SECURITY) public team_tree |INDEX public idx_team_tree_" \
    > /tmp/team_tree_repair.list
  echo "== restoring these TOC entries =="
  cut -d" " -f3- /tmp/team_tree_repair.list
  pg_restore -U postgres -d postgres --no-owner --no-privileges \
    -L /tmp/team_tree_repair.list /tmp/team_tree_repair.dump 2>&1 \
    | grep -vE "^pg_restore: (connecting|creating|processing)" || true
  rm -f /tmp/team_tree_repair.dump /tmp/team_tree_repair.list
' </dev/null

echo "== after =="
Q "select conname||' ('||contype::text||')' from pg_constraint where conrelid='public.team_tree'::regclass order by 1;"
Q "select indexname from pg_indexes where schemaname='public' and tablename='team_tree' order by 1;"
Q "select 'policy: '||policyname from pg_policies where tablename='team_tree' order by 1;"

UNIQ="$(Q "select count(*) from pg_constraint where conrelid='public.team_tree'::regclass and contype in ('p','u');")"
if [[ "$UNIQ" -lt 2 ]]; then
  echo "primary/unique keys are still missing on team_tree" >&2
  exit 1
fi
echo "REPAIR_DONE"
REMOTE
