-- Self-hosted substitute for the Supabase security advisors. Read-only.
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -At -f -" \
--     < scripts/deploy/supabase-selfhost/security-advisor.sql
--
-- Each block prints one line per finding; an empty block is a pass.
-- Expected after 20261025090000_admin_roles_audit_rpcs.sql:
--   A (tables without RLS)                 : none
--   B (permissive non-SELECT policies)     : property_inquiries inserts only
--   C (definer functions anon can execute) : the public read-only lookups only
--   D (definer functions w/o search_path)  : legacy referral helpers (follow-up)
--   E (views without security_invoker)     : none
--   F (RLS on but no policies)             : none
--   G (SELECT policies USING true)         : users.allow_read_all, site/exchange/credit settings (known)

select '-- A. public tables without RLS';
select 'A '||c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
 order by 1;

select '-- B. non-SELECT policies with USING(true) or WITH CHECK(true)';
select 'B '||tablename||'.'||policyname||' ['||cmd||'] roles='||roles::text
  from pg_policies
 where schemaname = 'public' and cmd <> 'SELECT' and (qual = 'true' or with_check = 'true')
 order by 1;

select '-- C. SECURITY DEFINER functions executable by anon';
select 'C '||p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
 order by 1;

select '-- D. SECURITY DEFINER functions without a fixed search_path';
select 'D '||p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
 order by 1;

select '-- E. views in public without security_invoker';
select 'E '||c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v'
   and not coalesce((select bool_or(o like 'security_invoker=%true%' or o like 'security_invoker=on') from unnest(c.reloptions) o), false)
 order by 1;

select '-- F. tables with RLS enabled but no policies (black-holed for clients)';
select 'F '||c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
 order by 1;

select '-- G. SELECT policies with USING(true) (data readable by every listed role)';
select 'G '||tablename||'.'||policyname||' roles='||roles::text
  from pg_policies
 where schemaname = 'public' and cmd = 'SELECT' and qual = 'true'
 order by 1;

select '-- H. client-callable functions that take an actor/admin id argument';
select 'H '||p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and (pg_get_function_identity_arguments(p.oid) ilike '%admin_id%' or pg_get_function_identity_arguments(p.oid) ilike '%actor%')
   and has_function_privilege('authenticated', p.oid, 'execute')
 order by 1;

select '-- done';
