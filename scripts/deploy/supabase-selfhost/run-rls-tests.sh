#!/usr/bin/env bash
# Run the admin RLS / permission assertion suite against the VPS database.
#
#   bash scripts/deploy/supabase-selfhost/run-rls-tests.sh HOST [SSH_KEY] [--dry-run-migration]
#
#   HOST                 VPS IP or hostname (user defaults to root)
#   SSH_KEY              private key path, default ~/.ssh/newtolet_vps
#   --dry-run-migration  stream 20261025090000_admin_roles_audit_rpcs.sql first
#                        (with its trailing COMMIT removed) so the whole run,
#                        migration + tests, happens in one transaction that is
#                        rolled back. Use this BEFORE applying for real.
#
# Everything runs inside BEGIN ... ROLLBACK, so nothing persists. Identity is
# switched with SET LOCAL ROLE + request.jwt.claims; `postgres` is a member of
# anon/authenticated/service_role on this stack (verified 2026-10-24), and it
# owns every public table, so objects created during a dry run get the same
# owner they will have in production.
#
# Output must contain RLS_TESTS_PASSED and no "TEST FAIL" line.
# The classifier may treat this as a remote write; run with the `!` prefix.

set -euo pipefail

TARGET="${1:?usage: run-rls-tests.sh HOST [SSH_KEY] [--dry-run-migration]}"
shift
SSH_KEY="$HOME/.ssh/newtolet_vps"
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run-migration) DRY_RUN=1 ;;
    *) SSH_KEY="$arg" ;;
  esac
done
case "$TARGET" in
  *@*) ;;
  *) TARGET="root@$TARGET" ;;
esac

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TESTS="$REPO/scripts/deploy/supabase-selfhost/rls-tests.sql"
MIGRATION="$REPO/supabase/migrations/20261025090000_admin_roles_audit_rpcs.sql"
[[ -f "$TESTS" ]] || { echo "missing $TESTS" >&2; exit 1; }

SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

build_sql() {
  echo "begin;"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "-- dry run: migration body without its own begin/commit"
    tr -d '\r' < "$MIGRATION" | sed -e '/^begin;$/d' -e '/^commit;$/d'
  fi
  tr -d '\r' < "$TESTS"
  echo "rollback;"
}

OUTPUT="$(build_sql | ssh "${SSH_OPTS[@]}" "$TARGET" \
  "docker exec -i supabase-db psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -f -" 2>&1)" || {
  echo "$OUTPUT"
  echo "RLS_TESTS_ERROR (psql exited non-zero)" >&2
  exit 1
}

echo "$OUTPUT"
if grep -q "TEST FAIL" <<<"$OUTPUT"; then
  echo "RLS_TESTS_FAILED" >&2
  exit 1
fi
if ! grep -q "RLS_TESTS_PASSED" <<<"$OUTPUT"; then
  echo "RLS_TESTS_INCOMPLETE (no RLS_TESTS_PASSED marker)" >&2
  exit 1
fi
