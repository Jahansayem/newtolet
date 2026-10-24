#!/usr/bin/env bash
# Apply the admin-suite migration(s) to the self-hosted Supabase stack on the
# VPS, printing the security posture before and after.
#
#   bash scripts/deploy/supabase-selfhost/apply-admin-migration.sh HOST [SSH_KEY]
#
#   HOST     VPS IP or hostname (user defaults to root; use user@host to override)
#   SSH_KEY  private key path, default ~/.ssh/newtolet_vps
#
# Order (each file is one psql run with ON_ERROR_STOP=1; the new migration is a
# single transaction so a failure leaves the database untouched):
#   1. 20260411193000_unlock_refund_parity.sql  only if contact_unlock_refund_requests
#      is missing (the deployed DB never got it; the Unlock Refunds tab depends on it)
#   2. 20260413120000_sync_shared_unlock_cost.sql  only if (1) ran, to restore the
#      current unlock_property_contact() body that (1) would otherwise downgrade
#   3. 20261025090000_admin_roles_audit_rpcs.sql
#
# Runs as `postgres` (owner of every public table). The Claude Code auto-mode
# classifier blocks remote DB writes; run this with the `!` prefix.

set -euo pipefail

TARGET="${1:?usage: apply-admin-migration.sh HOST [SSH_KEY]}"
SSH_KEY="${2:-$HOME/.ssh/newtolet_vps}"
case "$TARGET" in
  *@*) ;;
  *) TARGET="root@$TARGET" ;;
esac

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MIG_DIR="$REPO/supabase/migrations"
ADMIN_MIGRATION="$MIG_DIR/20261025090000_admin_roles_audit_rpcs.sql"
REFUND_MIGRATION="$MIG_DIR/20260411193000_unlock_refund_parity.sql"
UNLOCK_COST_MIGRATION="$MIG_DIR/20260413120000_sync_shared_unlock_cost.sql"
for f in "$ADMIN_MIGRATION" "$REFUND_MIGRATION" "$UNLOCK_COST_MIGRATION"; do
  [[ -f "$f" ]] || { echo "migration not found: $f" >&2; exit 1; }
done

SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

remote_sql() {
  ssh "${SSH_OPTS[@]}" "$TARGET" \
    "docker exec -i supabase-db psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -f -" <<<"$1"
}

apply_file() {
  echo "== applying $(basename "$1") as postgres =="
  # CRLF-safe: strip carriage returns so psql never sees \r inside dollar quotes.
  tr -d '\r' < "$1" | ssh "${SSH_OPTS[@]}" "$TARGET" \
    "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -"
}

STATE_SQL="
select 'rls_off: '||coalesce(string_agg(c.relname, ', ' order by c.relname), '(none)')
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
select 'true_policies(non-select): '||coalesce(string_agg(tablename||'.'||policyname, ', ' order by tablename, policyname), '(none)')
  from pg_policies where schemaname='public' and cmd<>'SELECT' and (qual='true' or with_check='true');
select 'secdef_anon_exec: '||count(*)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');
select 'admin_memberships: '||coalesce((select count(*)::text from public.admin_memberships), 'table missing');
select 'audit_rows: '||coalesce((select count(*)::text from public.admin_audit_log), 'table missing');
select 'users_is_admin: '||count(*) from public.users where is_admin;
"

echo "== before =="
remote_sql "$STATE_SQL" || true

HAS_REFUND_TABLE="$(remote_sql "select count(*) from pg_tables where schemaname='public' and tablename='contact_unlock_refund_requests';")"
if [[ "$HAS_REFUND_TABLE" == "0" ]]; then
  echo "contact_unlock_refund_requests is missing; applying the unlock-refund migrations first"
  apply_file "$REFUND_MIGRATION"
  apply_file "$UNLOCK_COST_MIGRATION"
fi

apply_file "$ADMIN_MIGRATION"

echo "== after =="
remote_sql "$STATE_SQL"

EXPECTED_TABLES=(admin_memberships admin_role_permissions admin_status_transitions admin_audit_log credit_pricing_versions)
EXPECTED_FUNCTIONS=(admin_has_permission get_my_admin_profile log_admin_action assert_admin_permission assert_admin_transition
  admin_set_property_status admin_set_property_featured admin_soft_delete_property admin_phone_key_counts admin_duplicate_phone_groups
  admin_blacklist_user admin_unblacklist_user admin_set_user_active admin_set_employee_flag admin_set_user_roles admin_adjust_user_credits
  admin_approve_payment admin_review_payment admin_refund_payment admin_set_order_status admin_set_order_job_feed admin_set_order_assignee
  admin_archive_order admin_set_inquiry admin_archive_inquiry admin_review_feedback admin_archive_feedback admin_update_pricing
  admin_rollback_pricing admin_update_site_settings admin_list_audit_log admin_review_refund_request)

PRESENT_TABLES="$(remote_sql "select tablename from pg_tables where schemaname='public';")"
PRESENT_FUNCTIONS="$(remote_sql "select distinct proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';")"
MISSING=0
for t in "${EXPECTED_TABLES[@]}"; do
  grep -qx "$t" <<<"$PRESENT_TABLES" || { echo "missing table: $t" >&2; MISSING=1; }
done
for f in "${EXPECTED_FUNCTIONS[@]}"; do
  grep -qx "$f" <<<"$PRESENT_FUNCTIONS" || { echo "missing function: $f" >&2; MISSING=1; }
done
HAS_TRIGGER="$(remote_sql "select count(*) from pg_trigger where tgname='trg_users_prevent_privileged_changes';")"
[[ "$HAS_TRIGGER" == "1" ]] || { echo "missing trigger: trg_users_prevent_privileged_changes" >&2; MISSING=1; }
HAS_COLUMN="$(remote_sql "select count(*) from information_schema.columns where table_schema='public' and table_name='properties' and column_name='contact_phone_key';")"
[[ "$HAS_COLUMN" == "1" ]] || { echo "missing column: properties.contact_phone_key" >&2; MISSING=1; }

if [[ "$MISSING" == "1" ]]; then
  exit 1
fi
echo "ADMIN_MIGRATION_DONE"
