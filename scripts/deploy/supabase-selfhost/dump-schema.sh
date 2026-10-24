#!/usr/bin/env bash
# Snapshot the DEPLOYED public schema and its security posture from the
# self-hosted Supabase stack on the VPS, so migrations are written against
# reality instead of the (partly stale) DATABASE_SCHEMA.sql.
#
#   bash scripts/deploy/supabase-selfhost/dump-schema.sh HOST [SSH_KEY]
#
#   HOST     VPS IP or hostname (user defaults to root; use user@host to override)
#   SSH_KEY  private key path, default ~/.ssh/newtolet_vps
#
# Read-only: nothing is written on the VPS. Output lands in claudedocs/db/
# (committed; pg_dump -s contains no data and no secrets):
#
#   schema-public-YYYYMMDD.sql   pg_dump --schema-only of the public schema
#   policies-YYYYMMDD.txt        every RLS policy in public + storage
#   rls-YYYYMMDD.txt             RLS flag per public table
#   functions-YYYYMMDD.txt       public functions: SECURITY DEFINER, ACL, search_path
#   grants-YYYYMMDD.txt          table grants held by anon / authenticated / PUBLIC
#   data-facts-YYYYMMDD.txt      counts and distinct status values the migration relies on

set -euo pipefail

TARGET="${1:?usage: dump-schema.sh HOST [SSH_KEY]}"
SSH_KEY="${2:-$HOME/.ssh/newtolet_vps}"
case "$TARGET" in
  *@*) ;;
  *) TARGET="root@$TARGET" ;;
esac

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT_DIR="$REPO/claudedocs/db"
STAMP="$(date +%Y%m%d)"
mkdir -p "$OUT_DIR"

SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

remote_sql() {
  ssh "${SSH_OPTS[@]}" "$TARGET" \
    "docker exec -i supabase-db psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -f -" <<<"$1"
}

# Data facts reference columns that may not exist on the deployed schema (that
# is exactly what we are trying to learn), so one failing statement must not
# abort the rest: errors are printed inline and the loop continues.
remote_sql_lenient() {
  ssh "${SSH_OPTS[@]}" "$TARGET" \
    "docker exec -i supabase-db psql -U postgres -d postgres -At -v ON_ERROR_STOP=0 -f - 2>&1" <<<"$1"
}

echo "== pg_dump --schema-only public =="
ssh "${SSH_OPTS[@]}" "$TARGET" \
  "docker exec supabase-db pg_dump -U postgres -d postgres --schema-only --no-owner --no-privileges -n public" \
  > "$OUT_DIR/schema-public-$STAMP.sql"
echo "wrote $(wc -l < "$OUT_DIR/schema-public-$STAMP.sql") lines"

echo "== policies =="
remote_sql "
select schemaname||'.'||tablename||' | '||policyname||' | '||cmd||' | '||roles::text
       ||' | USING: '||coalesce(qual,'-')||' | CHECK: '||coalesce(with_check,'-')
  from pg_policies
 where schemaname in ('public','storage')
 order by schemaname, tablename, policyname;
" > "$OUT_DIR/policies-$STAMP.txt"
echo "wrote $(wc -l < "$OUT_DIR/policies-$STAMP.txt") policies"

echo "== rls flags =="
remote_sql "
select c.relname||' | rls='||c.relrowsecurity||' | force='||c.relforcerowsecurity
       ||' | owner='||pg_get_userbyid(c.relowner)
       ||' | policies='||(select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by c.relname;
" > "$OUT_DIR/rls-$STAMP.txt"
echo "wrote $(wc -l < "$OUT_DIR/rls-$STAMP.txt") tables"

echo "== functions =="
remote_sql "
select p.oid::regprocedure::text
       ||' | secdef='||p.prosecdef
       ||' | lang='||l.lanname
       ||' | acl='||coalesce(p.proacl::text,'DEFAULT(public execute)')
       ||' | config='||coalesce(array_to_string(p.proconfig,';'),'-')
       ||' | owner='||pg_get_userbyid(p.proowner)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
 where n.nspname = 'public'
 order by 1;
" > "$OUT_DIR/functions-$STAMP.txt"
echo "wrote $(wc -l < "$OUT_DIR/functions-$STAMP.txt") functions"

echo "== grants =="
remote_sql "
select grantee||' | '||table_name||' | '||string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC','service_role')
 group by grantee, table_name
 order by table_name, grantee;
" > "$OUT_DIR/grants-$STAMP.txt"
echo "wrote $(wc -l < "$OUT_DIR/grants-$STAMP.txt") grant rows"

echo "== data facts =="
remote_sql_lenient "
select 'pg_version='||version();
select 'role '||rolname||' super='||rolsuper||' bypassrls='||rolbypassrls from pg_roles where rolname in ('postgres','supabase_admin','authenticator','anon','authenticated','service_role') order by rolname;
select 'users_total='||count(*) from public.users;
select 'users_is_admin='||count(*) from public.users where is_admin;
select 'users_is_admin_inactive='||count(*) from public.users where is_admin and is_active is false;
select 'users_is_employee='||count(*) from public.users where is_employee;
select 'users_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='users';
select 'properties_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='properties';
select 'feedback_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='feedback';
select 'orders_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='orders';
select 'inquiries_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='property_inquiries';
select 'payment_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='payment_transactions';
select 'site_settings_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='site_settings';
select 'user_blacklist_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='user_blacklist';
select 'credit_transactions_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='credit_transactions';
select 'refund_columns='||string_agg(column_name||':'||data_type, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='contact_unlock_refund_requests';
select 'properties_rows='||count(*)||' status='||coalesce(status,'NULL')||' active='||coalesce(is_active::text,'NULL') from public.properties group by status, is_active order by 1;
select 'payment_status='||coalesce(status,'NULL')||' rows='||count(*) from public.payment_transactions group by status order by 1;
select 'order_status='||coalesce(status,'NULL')||' rows='||count(*) from public.orders group by status order by 1;
select 'inquiry_status='||coalesce(status,'NULL')||' rows='||count(*) from public.property_inquiries group by status order by 1;
select 'feedback_status='||coalesce(status,'NULL')||' rows='||count(*) from public.feedback group by status order by 1;
select 'refund_status='||coalesce(status,'NULL')||' rows='||count(*) from public.contact_unlock_refund_requests group by status order by 1;
select 'activities_rows='||count(*) from public.activities;
select 'user_blacklist_rows='||count(*) from public.user_blacklist;
select 'credit_packages_rows='||count(*)||' active='||count(*) filter (where active) from public.credit_packages;
select 'site_settings_rows='||count(*) from public.site_settings;
select 'views='||string_agg(c.relname||'('||coalesce(array_to_string(c.reloptions,';'),'no-options')||')', ', ') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v';
select 'triggers='||string_agg(tgname||' on '||tgrelid::regclass::text, ', ') from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace);
select 'indexes_properties='||string_agg(indexname||': '||indexdef, ' || ') from pg_indexes where schemaname='public' and tablename='properties';
select 'indexes_payments='||string_agg(indexname||': '||indexdef, ' || ') from pg_indexes where schemaname='public' and tablename='payment_transactions';
" > "$OUT_DIR/data-facts-$STAMP.txt"
echo "wrote $(wc -l < "$OUT_DIR/data-facts-$STAMP.txt") facts"

echo "SCHEMA_DUMP_DONE $OUT_DIR/*-$STAMP.*"
