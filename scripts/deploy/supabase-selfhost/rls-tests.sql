-- Admin RLS / permission assertion suite. Run by run-rls-tests.sh inside
-- BEGIN ... ROLLBACK (the runner adds both), as `postgres`.
--
-- Conventions: every check is a DO block that RAISEs 'TEST FAIL: ...' on the
-- wrong outcome (psql stops on the first failure); a passing block is followed
-- by `select 'PASS ...'`. The final line prints RLS_TESTS_PASSED.

-- ---------------------------------------------------------------------------
-- Fixtures (rolled back with the transaction)
-- ---------------------------------------------------------------------------
create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('super',  '00000000-0000-4000-8000-000000000001'),
  ('mod',    '00000000-0000-4000-8000-000000000002'),
  ('fin',    '00000000-0000-4000-8000-000000000003'),
  ('plain',  '00000000-0000-4000-8000-000000000004'),
  ('legacy', '00000000-0000-4000-8000-000000000005'),
  ('pay',    '00000000-0000-4000-8000-0000000000a1'),
  ('prop',   '00000000-0000-4000-8000-0000000000b1'),
  ('fb',     '00000000-0000-4000-8000-0000000000c1');
grant select on t_ids to public;

insert into public.users (id, email, name, is_admin, is_active, credits, role) values
  ((select id from t_ids where k = 'super'),  'rls-super@test.local',  'RLS Super',  true,  true, 0,  'tenant'),
  ((select id from t_ids where k = 'mod'),    'rls-mod@test.local',    'RLS Mod',    false, true, 0,  'tenant'),
  ((select id from t_ids where k = 'fin'),    'rls-fin@test.local',    'RLS Fin',    false, true, 0,  'tenant'),
  ((select id from t_ids where k = 'plain'),  'rls-plain@test.local',  'RLS Plain',  false, true, 20, 'tenant'),
  ((select id from t_ids where k = 'legacy'), 'rls-legacy@test.local', 'RLS Legacy', true,  true, 0,  'tenant');

insert into public.admin_memberships (user_id, role, source) values
  ((select id from t_ids where k = 'super'), 'super_admin', 'manual'),
  ((select id from t_ids where k = 'mod'),   'moderator',   'manual'),
  ((select id from t_ids where k = 'fin'),   'finance',     'manual');

insert into public.payment_transactions (id, user_id, transaction_id, amount, status, credits_to_add, provider)
values ((select id from t_ids where k = 'pay'), (select id from t_ids where k = 'plain'), 'RLS-TEST-TXN-1', 500, 'awaiting_admin_approval', 50, 'eps');

insert into public.properties (id, user_id, category, property_type, rent_period, state_district, area, contact_number, rent_amount_bdt, short_description, status)
values ((select id from t_ids where k = 'prop'), (select id from t_ids where k = 'plain'), 'Flat', 'Family', 'monthly', 'Dhaka', 'Mirpur', '01711111111', 12000, 'RLS test listing', 'pending');

insert into public.feedback (id, user_id, name, feedback, status)
values ((select id from t_ids where k = 'fb'), (select id from t_ids where k = 'plain'), 'RLS Plain', 'pending feedback should be hidden', 'pending');

-- ---------------------------------------------------------------------------
-- T0. structure
-- ---------------------------------------------------------------------------
do $$
declare v text;
begin
  select string_agg(c.relname, ', ') into v from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v is not null then raise exception 'TEST FAIL: tables without RLS: %', v; end if;
end $$;
select 'PASS T0.1 every public table has RLS';

do $$
declare c int;
begin
  select count(*) into c from public.admin_role_permissions where role = 'super_admin';
  if c <> 19 then raise exception 'TEST FAIL: super_admin has % permissions, expected 19', c; end if;
  select count(*) into c from public.admin_role_permissions where role = 'moderator';
  if c <> 10 then raise exception 'TEST FAIL: moderator has % permissions, expected 10', c; end if;
  select count(*) into c from public.admin_role_permissions where role = 'finance';
  if c <> 8 then raise exception 'TEST FAIL: finance has % permissions, expected 8', c; end if;
  select count(*) into c from public.admin_role_permissions where role = 'support';
  if c <> 7 then raise exception 'TEST FAIL: support has % permissions, expected 7', c; end if;
  select count(*) into c from public.admin_role_permissions where role = 'content_manager';
  if c <> 5 then raise exception 'TEST FAIL: content_manager has % permissions, expected 5', c; end if;
end $$;
select 'PASS T0.2 permission matrix counts match src/lib/adminPermissions.js';

do $$
declare c int;
begin
  select count(*) into c from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');
  if c > 7 then raise exception 'TEST FAIL: % SECURITY DEFINER functions are executable by anon (allow-list is 7)', c; end if;
  if has_function_privilege('anon', 'public.increment_user_credits(uuid,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.increment_user_credits(uuid,integer)', 'execute') then
    raise exception 'TEST FAIL: increment_user_credits is still client-executable';
  end if;
  if has_function_privilege('anon', 'public.approve_credit_payment_transaction(uuid,uuid)', 'execute') then
    raise exception 'TEST FAIL: approve_credit_payment_transaction is executable by anon';
  end if;
  if has_function_privilege('authenticated', 'public.log_admin_action(text,text,text,text,jsonb,jsonb,jsonb)', 'execute') then
    raise exception 'TEST FAIL: log_admin_action is client-executable';
  end if;
end $$;
select 'PASS T0.3 function execute sweep';

-- ---------------------------------------------------------------------------
-- T1. anon
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  perform count(*) from public.admin_audit_log;
  raise exception 'TEST FAIL: anon can read admin_audit_log';
exception when insufficient_privilege then null;
end $$;
select 'PASS T1.1 anon cannot read the audit log';

do $$
begin
  perform public.admin_set_property_status(array[(select id from t_ids where k = 'prop')], 'approved');
  raise exception 'TEST FAIL: anon could execute admin_set_property_status';
exception when insufficient_privilege then null;
end $$;
select 'PASS T1.2 anon cannot execute admin RPCs';

do $$
begin
  perform * from public.approve_credit_payment_transaction((select id from t_ids where k = 'pay'), (select id from t_ids where k = 'super'));
  raise exception 'TEST FAIL: anon could execute approve_credit_payment_transaction';
exception when insufficient_privilege then null;
end $$;
select 'PASS T1.3 anon cannot approve payments';

do $$
declare c int;
begin
  select count(*) into c from public.feedback where status = 'pending';
  if c <> 0 then raise exception 'TEST FAIL: anon sees % pending feedback rows', c; end if;
end $$;
select 'PASS T1.4 anon only sees approved public feedback';

do $$
begin
  if public.is_current_user_admin() then raise exception 'TEST FAIL: anon is admin'; end if;
end $$;
select 'PASS T1.5 is_current_user_admin() is false for anon';

reset role;

-- ---------------------------------------------------------------------------
-- T2. plain authenticated user
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'plain'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'plain'), true);

do $$
begin
  update public.users set name = 'RLS Plain Renamed' where id = auth.uid();
  if not found then raise exception 'TEST FAIL: plain user could not update own name'; end if;
end $$;
select 'PASS T2.1 plain user can edit own profile fields';

do $$
begin
  update public.users set is_admin = true where id = auth.uid();
  raise exception 'TEST FAIL: plain user promoted themselves to admin';
exception when others then
  if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error on is_admin self-update: %', sqlerrm; end if;
end $$;
select 'PASS T2.2 plain user cannot set own is_admin';

do $$
begin
  update public.users set credits = 999999 where id = auth.uid();
  raise exception 'TEST FAIL: plain user changed own credits';
exception when others then
  if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error on credits self-update: %', sqlerrm; end if;
end $$;
select 'PASS T2.3 plain user cannot set own credits';

do $$
declare p jsonb := public.get_my_admin_profile();
begin
  if jsonb_array_length(p -> 'roles') <> 0 or (p ->> 'legacy_admin')::boolean then
    raise exception 'TEST FAIL: plain profile has roles: %', p;
  end if;
end $$;
select 'PASS T2.4 plain user has no admin roles';

do $$
begin
  perform public.admin_set_property_status(array[(select id from t_ids where k = 'prop')], 'approved');
  raise exception 'TEST FAIL: plain user approved a listing';
exception when others then
  if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
end $$;
select 'PASS T2.5 plain user is denied by admin RPCs';

do $$
declare c int;
begin
  select count(*) into c from public.admin_audit_log;
  if c <> 0 then raise exception 'TEST FAIL: plain user sees % audit rows', c; end if;
  select count(*) into c from public.customer_search_history where user_id is distinct from auth.uid();
  if c <> 0 then raise exception 'TEST FAIL: plain user sees other users'' search history'; end if;
end $$;
select 'PASS T2.6 plain user sees no audit rows and no foreign search history';

reset role;

-- ---------------------------------------------------------------------------
-- T3. moderator
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'mod'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'mod'), true);

do $$
begin
  if not public.is_current_user_admin() then raise exception 'TEST FAIL: moderator is not recognised as staff'; end if;
  if not public.admin_has_permission('properties.moderate') then raise exception 'TEST FAIL: moderator lacks properties.moderate'; end if;
  if public.admin_has_permission('payments.review') then raise exception 'TEST FAIL: moderator has payments.review'; end if;
end $$;
select 'PASS T3.1 moderator permissions';

do $$
begin
  perform public.admin_review_payment((select id from t_ids where k = 'pay'), 'approve');
  raise exception 'TEST FAIL: moderator approved a payment';
exception when others then
  if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
end $$;
select 'PASS T3.2 moderator cannot approve payments';

do $$
declare r jsonb; c int;
begin
  r := public.admin_set_property_status(array[(select id from t_ids where k = 'prop')], 'approved', null, 'looks fine');
  if (r ->> 'count')::int <> 1 then raise exception 'TEST FAIL: approve returned %', r; end if;
  if (select status from public.properties where id = (select id from t_ids where k = 'prop')) <> 'approved' then
    raise exception 'TEST FAIL: property not approved';
  end if;
  if (select reviewed_by from public.properties where id = (select id from t_ids where k = 'prop')) <> auth.uid() then
    raise exception 'TEST FAIL: reviewed_by is not the actor';
  end if;
  select count(*) into c from public.admin_audit_log;
  if c <> 0 then raise exception 'TEST FAIL: moderator can read the audit log'; end if;
end $$;
select 'PASS T3.3 moderator approves a listing (audit written, not readable by moderator)';

do $$
begin
  perform public.admin_set_property_status(array[(select id from t_ids where k = 'prop')], 'rejected');
  raise exception 'TEST FAIL: rejection without a reason was accepted';
exception when others then
  if sqlerrm not like 'ADMIN_VALIDATION%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
end $$;
select 'PASS T3.4 rejecting a listing requires a reason';

reset role;

do $$
declare c int;
begin
  select count(*) into c from public.admin_audit_log where action = 'property.set_status' and entity_id = (select id::text from t_ids where k = 'prop');
  if c <> 1 then raise exception 'TEST FAIL: expected 1 property audit row, found %', c; end if;
end $$;
select 'PASS T3.5 exactly one audit row for the approval';

-- ---------------------------------------------------------------------------
-- T4. finance
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'fin'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'fin'), true);

do $$
declare r jsonb; bal int;
begin
  r := public.admin_approve_payment((select id from t_ids where k = 'pay'));
  if (r -> 'row' ->> 'status') <> 'credited' then raise exception 'TEST FAIL: approve result %', r; end if;
  select credits into bal from public.users where id = (select id from t_ids where k = 'plain');
  if bal <> 70 then raise exception 'TEST FAIL: balance after approval is %, expected 70', bal; end if;
  if not exists (select 1 from public.credit_transactions where reference_id = (select id from t_ids where k = 'pay') and transaction_type = 'credit_purchase') then
    raise exception 'TEST FAIL: no ledger row for the approval';
  end if;
  if (r ->> 'audit_id') is null then raise exception 'TEST FAIL: approve returned no audit id'; end if;
  -- idempotent
  r := public.admin_approve_payment((select id from t_ids where k = 'pay'));
  select credits into bal from public.users where id = (select id from t_ids where k = 'plain');
  if bal <> 70 then raise exception 'TEST FAIL: second approval changed the balance to %', bal; end if;
end $$;
select 'PASS T4.1 finance approves a payment once (ledger + audit, idempotent)';

do $$
begin
  perform public.admin_review_payment((select id from t_ids where k = 'pay'), 'reject', 'duplicate');
  raise exception 'TEST FAIL: credited payment was rejected';
exception when others then
  if sqlerrm not like 'ADMIN_INVALID_TRANSITION%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
end $$;
select 'PASS T4.2 credited -> failed is an invalid transition';

do $$
begin
  perform public.admin_set_property_status(array[(select id from t_ids where k = 'prop')], 'pending');
  raise exception 'TEST FAIL: finance changed a listing status';
exception when others then
  if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
end $$;
select 'PASS T4.3 finance cannot moderate listings';

do $$
begin
  perform public.admin_adjust_user_credits((select id from t_ids where k = 'plain'), -1000, 'test overdraft');
  raise exception 'TEST FAIL: overdraft adjustment accepted';
exception when others then
  if sqlerrm not like 'ADMIN_INSUFFICIENT_CREDITS%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
end $$;
select 'PASS T4.4 credit adjustment cannot go negative';

do $$
declare r jsonb; bal int;
begin
  r := public.admin_adjust_user_credits((select id from t_ids where k = 'plain'), 10, 'goodwill bonus', 70);
  select credits into bal from public.users where id = (select id from t_ids where k = 'plain');
  if bal <> 80 then raise exception 'TEST FAIL: balance after adjustment is %, expected 80', bal; end if;
  if not exists (select 1 from public.credit_transactions where transaction_type = 'admin_adjustment' and user_id = (select id from t_ids where k = 'plain')) then
    raise exception 'TEST FAIL: no admin_adjustment ledger row';
  end if;
end $$;
select 'PASS T4.5 credit adjustment writes the ledger';

do $$
begin
  perform public.admin_adjust_user_credits((select id from t_ids where k = 'plain'), 1, 'stale', 70);
  raise exception 'TEST FAIL: stale expected balance accepted';
exception when others then
  if sqlerrm not like 'ADMIN_CONFLICT%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
end $$;
select 'PASS T4.6 stale expected balance is rejected';

do $$
declare r jsonb; v int;
begin
  r := public.admin_update_pricing('{"contact_view": 12}'::jsonb, null, 'rls test');
  select contact_view into v from public.credit_settings where id = true;
  if v <> 12 then raise exception 'TEST FAIL: contact_view is %, expected 12', v; end if;
  if (select count(*) from public.credit_pricing_versions) < 2 then raise exception 'TEST FAIL: expected initial + new pricing versions'; end if;
  r := public.admin_rollback_pricing((select min(id) from public.credit_pricing_versions));
  select contact_view into v from public.credit_settings where id = true;
  if v = 12 then raise exception 'TEST FAIL: rollback did not restore contact_view'; end if;
end $$;
select 'PASS T4.7 pricing publish creates versions and rollback restores';

reset role;

-- ---------------------------------------------------------------------------
-- T5. super admin
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'super'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'super'), true);

do $$
declare c int; p jsonb := public.get_my_admin_profile();
begin
  select count(*) into c from public.admin_audit_log;
  if c < 3 then raise exception 'TEST FAIL: super admin sees % audit rows, expected >= 3', c; end if;
  if not (p -> 'permissions') ? 'audit.view' then raise exception 'TEST FAIL: super profile lacks audit.view: %', p; end if;
  if not (p -> 'capabilities') ? 'admin_review_payment' then raise exception 'TEST FAIL: capabilities missing: %', p -> 'capabilities'; end if;
end $$;
select 'PASS T5.1 super admin reads the audit log and profile';

do $$
declare r jsonb;
begin
  r := public.admin_set_user_roles((select id from t_ids where k = 'mod'), array['moderator', 'support']);
  if (r ->> 'count')::int <> 2 then raise exception 'TEST FAIL: set_user_roles returned %', r; end if;
  if not (select is_admin from public.users where id = (select id from t_ids where k = 'mod')) then
    raise exception 'TEST FAIL: is_admin mirror not set';
  end if;
  r := public.admin_set_user_roles((select id from t_ids where k = 'mod'), '{}');
  if (select is_admin from public.users where id = (select id from t_ids where k = 'mod')) then
    raise exception 'TEST FAIL: is_admin mirror not cleared';
  end if;
end $$;
select 'PASS T5.2 role assignment mirrors users.is_admin';

do $$
declare supers int;
begin
  select count(*) into supers from public.admin_memberships where role = 'super_admin' and is_active;
  if supers = 1 then
    begin
      perform public.admin_set_user_roles(auth.uid(), '{}');
      raise exception 'TEST FAIL: last super admin removed';
    exception when others then
      if sqlerrm not like 'ADMIN_CONFLICT%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
    end;
  end if;
end $$;
select 'PASS T5.3 last super admin guard (skipped when other super admins exist)';

do $$
declare r jsonb;
begin
  r := public.admin_blacklist_user((select id from t_ids where k = 'plain'), 'spam listings', 'rls test');
  if (r -> 'row' ->> 'blacklisted_by')::uuid <> auth.uid() then raise exception 'TEST FAIL: blacklisted_by is not the actor: %', r; end if;
  if (select is_active from public.users where id = (select id from t_ids where k = 'plain')) then raise exception 'TEST FAIL: user still active'; end if;
  begin
    perform public.admin_blacklist_user((select id from t_ids where k = 'plain'), 'again');
    raise exception 'TEST FAIL: duplicate blacklist accepted';
  exception when others then
    if sqlerrm not like 'ADMIN_CONFLICT%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
  end;
  r := public.admin_unblacklist_user((select id from t_ids where k = 'plain'), 'resolved');
  if (r -> 'row' ->> 'lifted_at') is null then raise exception 'TEST FAIL: lifted_at not set'; end if;
  if not (select is_active from public.users where id = (select id from t_ids where k = 'plain')) then raise exception 'TEST FAIL: user not reactivated'; end if;
  if (select count(*) from public.user_blacklist where user_id = (select id from t_ids where k = 'plain')) <> 1 then
    raise exception 'TEST FAIL: blacklist history was deleted';
  end if;
end $$;
select 'PASS T5.4 blacklist records the actor and keeps history';

do $$
declare r jsonb;
begin
  r := public.admin_review_feedback((select id from t_ids where k = 'fb'), 'approved', null, null, true);
  if (r -> 'row' ->> 'status') <> 'approved' or not (r -> 'row' ->> 'is_public')::boolean then raise exception 'TEST FAIL: feedback review %', r; end if;
  r := public.admin_update_site_settings('{"maintenance_mode": true}'::jsonb);
  if not (r -> 'row' ->> 'maintenance_mode')::boolean then raise exception 'TEST FAIL: maintenance_mode not set'; end if;
  r := public.admin_update_site_settings('{"maintenance_mode": false}'::jsonb);
end $$;
select 'PASS T5.5 feedback review and site settings';

reset role;

-- ---------------------------------------------------------------------------
-- T6. legacy admin (is_admin, no membership)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'legacy'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'legacy'), true);

do $$
declare p jsonb := public.get_my_admin_profile();
begin
  if not public.is_current_user_admin() then raise exception 'TEST FAIL: legacy admin not recognised'; end if;
  if not public.admin_has_permission('audit.view') then raise exception 'TEST FAIL: legacy admin lacks full access'; end if;
  if not (p ->> 'legacy_admin')::boolean then raise exception 'TEST FAIL: profile does not flag legacy admin: %', p; end if;
end $$;
select 'PASS T6.1 legacy is_admin user keeps full access until roles are assigned';

reset role;

-- ---------------------------------------------------------------------------
-- T7. audit immutability (even for the owner)
-- ---------------------------------------------------------------------------
do $$
begin
  update public.admin_audit_log set reason = 'tampered' where id = (select max(id) from public.admin_audit_log);
  raise exception 'TEST FAIL: audit row was updated';
exception when others then
  if sqlerrm not like 'ADMIN_CONFLICT%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
end $$;
do $$
begin
  delete from public.admin_audit_log where id = (select max(id) from public.admin_audit_log);
  raise exception 'TEST FAIL: audit row was deleted';
exception when others then
  if sqlerrm not like 'ADMIN_CONFLICT%' then raise exception 'TEST FAIL: unexpected error: %', sqlerrm; end if;
end $$;
select 'PASS T7.1 audit log is append-only';

-- ---------------------------------------------------------------------------
-- T8. service role path for the Edge Function
-- ---------------------------------------------------------------------------
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  -- already credited: must return without error (idempotent) and without auth.uid()
  perform * from public.approve_credit_payment_transaction((select id from t_ids where k = 'pay'), (select id from t_ids where k = 'super'));
end $$;
select 'PASS T8.1 service role can call approve_credit_payment_transaction without a session';
reset role;

-- ---------------------------------------------------------------------------
-- T9. lock-down follow-up (20261101090000): skipped with a notice until that
--     migration is applied or streamed with --dry-run-lockdown.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regproc('public.prevent_direct_property_moderation_changes') is null then
    raise notice 'SKIP T9 lock-down checks: 20261101090000_lock_admin_direct_writes.sql not applied';
  end if;
end $$;

-- T6 stripped the moderator's roles; give them back as super_admin before the checks.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'super'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'super'), true);
do $$
begin
  if to_regproc('public.prevent_direct_property_moderation_changes') is null then return; end if;
  perform public.admin_set_user_roles((select id from t_ids where k = 'mod'), array['moderator']);
end $$;

-- T9.1 moderator cannot moderate a listing with a direct UPDATE (must use the RPC)
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'mod'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'mod'), true);
do $$
declare n int; cur text; trg int;
begin
  if to_regproc('public.prevent_direct_property_moderation_changes') is null then return; end if;
  select status into cur from public.properties where id = (select id from t_ids where k = 'prop');
  select count(*) into trg from pg_trigger where tgrelid = 'public.properties'::regclass and tgname = 'trg_properties_prevent_direct_moderation' and not tgisinternal;
  begin
    -- flip to whichever status differs from the current one so the trigger sees a real change
    update public.properties set status = case when status = 'rejected' then 'approved' else 'rejected' end
      where id = (select id from t_ids where k = 'prop');
    get diagnostics n = row_count;
    raise exception 'TEST FAIL: moderator changed a listing status with a direct update (rows=%, old status=%, admin=%, trigger=%)',
      n, cur, public.is_current_user_admin(), trg;
  exception when others then
    if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error on direct status update: %', sqlerrm; end if;
  end;
  begin
    update public.properties set is_featured = true where id = (select id from t_ids where k = 'prop');
    raise exception 'TEST FAIL: moderator set is_featured with a direct update';
  exception when others then
    if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error on direct featured update: %', sqlerrm; end if;
  end;
end $$;
select case when to_regproc('public.prevent_direct_property_moderation_changes') is null then 'SKIP T9.1' else 'PASS T9.1 moderator cannot moderate listings with direct updates' end;

-- T9.2 the RPC path still works for the same moderator
do $$
declare r jsonb; cur text; tgt text;
begin
  if to_regproc('public.prevent_direct_property_moderation_changes') is null then return; end if;
  select status into cur from public.properties where id = (select id from t_ids where k = 'prop');
  tgt := case when cur = 'rejected' then 'approved' else 'rejected' end;
  r := public.admin_set_property_status(array[(select id from t_ids where k = 'prop')], tgt, 'duplicate listing', null, null);
  if (r->>'count')::int <> 1 then raise exception 'TEST FAIL: RPC rejected % rows, expected 1', r->>'count'; end if;
end $$;
select case when to_regproc('public.prevent_direct_property_moderation_changes') is null then 'SKIP T9.2' else 'PASS T9.2 moderator still moderates through admin_set_property_status' end;

-- T9.3 super_admin direct writes on payments / users hit no rows; blacklist insert is refused
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'super'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'super'), true);
do $$
declare n int;
begin
  if to_regproc('public.prevent_direct_property_moderation_changes') is null then return; end if;
  update public.payment_transactions set review_note = 'direct' where id = (select id from t_ids where k = 'pay');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAIL: super_admin updated a payment row directly (% rows)', n; end if;
  update public.users set name = 'direct rename' where id = (select id from t_ids where k = 'plain');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FAIL: super_admin updated another user''s row directly (% rows)', n; end if;
  begin
    insert into public.user_blacklist (user_id, reason, blacklisted_by) values ((select id from t_ids where k = 'plain'), 'direct', auth.uid());
    raise exception 'TEST FAIL: super_admin inserted a blacklist row directly';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    if sqlerrm not like '%row-level security%' then raise exception 'TEST FAIL: unexpected error on direct blacklist insert: %', sqlerrm; end if;
  end;
end $$;
select case when to_regproc('public.prevent_direct_property_moderation_changes') is null then 'SKIP T9.3' else 'PASS T9.3 super_admin direct writes on payments, users and blacklist are refused' end;

-- T9.4 owner may still resubmit (status back to pending) but nothing else
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'plain'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'plain'), true);
do $$
begin
  if to_regproc('public.prevent_direct_property_moderation_changes') is null then return; end if;
  update public.properties set status = 'pending', reviewed_at = null where id = (select id from t_ids where k = 'prop');
  if not found then raise exception 'TEST FAIL: owner could not resubmit their listing'; end if;
  begin
    update public.properties set status = 'approved' where id = (select id from t_ids where k = 'prop');
    raise exception 'TEST FAIL: owner approved their own listing';
  exception when others then
    if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error on owner self-approval: %', sqlerrm; end if;
  end;
end $$;
select case when to_regproc('public.prevent_direct_property_moderation_changes') is null then 'SKIP T9.4' else 'PASS T9.4 owner can resubmit but not approve their own listing' end;
reset role;

select 'RLS_TESTS_PASSED';
