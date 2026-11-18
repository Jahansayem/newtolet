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
  if c > 7 + (to_regproc('public.track_customer_event') is not null)::int then raise exception 'TEST FAIL: % SECURITY DEFINER functions are executable by anon (allow-list is 7, +1 with track_customer_event)', c; end if;
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

-- ---------------------------------------------------------------------------
-- T10. customer events (20261102090000): skipped with a notice until that
--      migration is applied or streamed with --dry-run-customers.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regproc('public.track_customer_event') is null then
    raise notice 'SKIP T10 customer-event checks: 20261102090000_customer_events.sql not applied';
    return;
  end if;
  insert into t_ids values ('cm', '00000000-0000-4000-8000-000000000006'), ('visitor', '00000000-0000-4000-8000-0000000000d1'), ('sess', '00000000-0000-4000-8000-0000000000d2');
  insert into public.users (id, email, name, is_admin, is_active, credits, role)
  values ((select id from t_ids where k = 'cm'), 'rls-cm@test.local', 'RLS Content', false, true, 0, 'tenant');
  insert into public.admin_memberships (user_id, role, source) values ((select id from t_ids where k = 'cm'), 'content_manager', 'manual');
end $$;

-- T10.1 anonymous visitor: one listing_view row, deduped on repeat, forged types ignored
set local role anon;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if to_regproc('public.track_customer_event') is null then return; end if;
  perform public.track_customer_event('listing_view', (select id from t_ids where k = 'visitor'), (select id from t_ids where k = 'sess'), (select id from t_ids where k = 'prop'), '/listing/x', null, '{"category":"Flat"}');
  perform public.track_customer_event('listing_view', (select id from t_ids where k = 'visitor'), (select id from t_ids where k = 'sess'), (select id from t_ids where k = 'prop'), '/listing/x', null, '{}');
  perform public.track_customer_event('contact_unlock', (select id from t_ids where k = 'visitor'), null, (select id from t_ids where k = 'prop'), null, null, '{}');
  perform public.track_customer_event('order', (select id from t_ids where k = 'visitor'), null, null, null, null, '{}');
end $$;
reset role;
do $$
declare n int; u uuid; s text;
begin
  if to_regproc('public.track_customer_event') is null then return; end if;
  select count(*), max(user_id::text)::uuid, max(source) into n, u, s from public.customer_events where visitor_id = (select id from t_ids where k = 'visitor');
  if n <> 1 then raise exception 'TEST FAIL: expected 1 anonymous event, found % (dedupe or forged types)', n; end if;
  if u is not null then raise exception 'TEST FAIL: anonymous event has a user_id'; end if;
  if s <> 'client' then raise exception 'TEST FAIL: anonymous event source is %', s; end if;
end $$;
select case when to_regproc('public.track_customer_event') is null then 'SKIP T10.1' else 'PASS T10.1 anon tracks one deduped listing view and cannot forge server events' end;

-- T10.2 plain user: no direct read, admin RPCs denied, inquiry trigger attributes the event
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'plain'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'plain'), true);
do $$
declare n int;
begin
  if to_regproc('public.track_customer_event') is null then return; end if;
  select count(*) into n from public.customer_events;
  if n <> 0 then raise exception 'TEST FAIL: plain user can read % customer events', n; end if;
  begin
    perform * from public.admin_customer_daily_stats(now() - interval '7 days', now());
    raise exception 'TEST FAIL: plain user read customer daily stats';
  exception when others then
    if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error on plain stats: %', sqlerrm; end if;
  end;
  insert into public.property_inquiries (property_id, name, email, phone, message)
  values ((select id from t_ids where k = 'prop'), 'RLS Plain', 'rls-plain@test.local', '01711111111', 'Is this still available?');
  perform public.track_customer_event('phone_tap', (select id from t_ids where k = 'visitor'), (select id from t_ids where k = 'sess'), (select id from t_ids where k = 'prop'), '/listing/x', null, '{"placement":"sidebar"}');
end $$;
reset role;
do $$
declare n int;
begin
  if to_regproc('public.track_customer_event') is null then return; end if;
  select count(*) into n from public.customer_events where event_type = 'inquiry' and source = 'trigger' and user_id = (select id from t_ids where k = 'plain');
  if n <> 1 then raise exception 'TEST FAIL: inquiry trigger wrote % events for plain', n; end if;
  select count(*) into n from public.customer_events where event_type = 'phone_tap' and user_id = (select id from t_ids where k = 'plain') and visitor_id = (select id from t_ids where k = 'visitor');
  if n <> 1 then raise exception 'TEST FAIL: signed-in phone tap not stamped with user and visitor (%)', n; end if;
end $$;
select case when to_regproc('public.track_customer_event') is null then 'SKIP T10.2' else 'PASS T10.2 plain user cannot read events; inquiry trigger and signed-in tap are attributed' end;

-- T10.3 finance (users.view): stats, list, timeline (stitched anonymous view), top listings
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'fin'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'fin'), true);
set local role authenticated;
do $$
declare n int; r record;
begin
  if to_regproc('public.track_customer_event') is null then return; end if;
  select count(*) into n from public.admin_customer_daily_stats(now() - interval '1 day', now() + interval '1 day');
  if n < 1 then raise exception 'TEST FAIL: finance got no daily stats rows'; end if;
  select * into r from public.admin_customer_range_totals(now() - interval '1 day', now() + interval '1 day');
  if r.listing_views < 1 or r.inquiries < 1 or r.phone_taps < 1 then raise exception 'TEST FAIL: range totals missing events: %', to_jsonb(r); end if;
  if r.anonymous_visitors < 1 then raise exception 'TEST FAIL: anonymous visitor not counted: %', to_jsonb(r); end if;
  select count(*) into n from public.admin_customer_list(null, now() - interval '1 day', now() + interval '1 day', true, 'last_seen', 'desc', 50, 0) l where l.id = (select id from t_ids where k = 'plain') and l.inquiries = 1 and l.phone_taps = 1;
  if n <> 1 then raise exception 'TEST FAIL: customer list does not show plain with 1 inquiry and 1 tap'; end if;
  select count(*) into n from public.admin_customer_list('rls-plain', null, null, false, 'name', 'asc', 50, 0);
  if n <> 1 then raise exception 'TEST FAIL: customer search by email returned % rows', n; end if;
  select count(*) into n from public.admin_customer_timeline((select id from t_ids where k = 'plain'), null, 100, 0) t where t.event_type = 'listing_view' and t.user_id is null;
  if n <> 1 then raise exception 'TEST FAIL: anonymous listing view not stitched into the timeline (%)', n; end if;
  select count(*) into n from public.admin_top_viewed_listings(now() - interval '1 day', now() + interval '1 day', 10) t where t.property_id = (select id from t_ids where k = 'prop') and t.views = 1 and t.phone_taps = 1;
  if n <> 1 then raise exception 'TEST FAIL: top listings missing the fixture listing'; end if;
end $$;
select case when to_regproc('public.track_customer_event') is null then 'SKIP T10.3' else 'PASS T10.3 finance reads stats, list, stitched timeline and top listings' end;

-- T10.4 content_manager (no users.view) is denied
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'cm'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'cm'), true);
do $$
begin
  if to_regproc('public.track_customer_event') is null then return; end if;
  begin
    perform * from public.admin_customer_list(null, null, null, true, 'last_seen', 'desc', 10, 0);
    raise exception 'TEST FAIL: content_manager read the customer list';
  exception when others then
    if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error for content_manager: %', sqlerrm; end if;
  end;
end $$;
select case when to_regproc('public.track_customer_event') is null then 'SKIP T10.4' else 'PASS T10.4 content_manager is denied customer data' end;
reset role;

-- ---------------------------------------------------------------------------
-- T11. customer orders (20261116090000_customer_orders.sql). Skipped until the
--      migration is applied. Core co_* functions are called as the table owner
--      (what the Edge Function does with the service role); the admin wrappers
--      are called as authenticated users.
-- ---------------------------------------------------------------------------
create temp table t_co (k text primary key, id uuid not null);
grant select, insert on t_co to public;

create function pg_temp.co_expect(p_sql text, p_prefix text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like p_prefix || '%' then return; end if;
    raise exception 'TEST FAIL: expected % but got "%" from: %', p_prefix, sqlerrm, p_sql;
  end;
  raise exception 'TEST FAIL: expected % but the statement succeeded: %', p_prefix, p_sql;
end $$;

-- T11.1 create: server-side charge, derived fields, idempotency, duplicate warning, validation
do $$
declare r jsonb; o jsonb; r2 jsonb;
begin
  if to_regclass('public.customer_orders') is null then return; end if;
  r := public.co_create_order('api_agent', null, 'agent-1',
    '{"type":"HOUSE_SEARCH","customer_name":"Rahim Uddin","customer_phone":"+8801712345678","source":"messenger","area":"Mirpur 10,  Kazipara","rooms":2,"budget_min":10000,"budget_max":15000,"move_in_date":"2026-12-01","tenant_type":"Family"}',
    'thread-1-20261116', false);
  o := r -> 'order';
  if not (r ->> 'created')::boolean then raise exception 'TEST FAIL: first create not flagged created'; end if;
  if o ->> 'order_no' !~ '^NT-[0-9]{4}-[0-9]{4}$' then raise exception 'TEST FAIL: order_no is %', o ->> 'order_no'; end if;
  if o ->> 'status' <> 'PENDING' or (o ->> 'service_charge_bdt')::int <> 500 then raise exception 'TEST FAIL: new order status/charge: %', o; end if;
  if o ->> 'payment_status' <> 'PENDING' or (o ->> 'amount_paid')::int <> 0 or (o ->> 'amount_due')::int <> 500
     or o ->> 'payment_verification' <> 'UNVERIFIED' or (o ->> 'listings_found_count')::int <> 0 then
    raise exception 'TEST FAIL: new order derived fields: %', o;
  end if;
  if o ->> 'customer_phone' <> '01712345678' or o ->> 'created_via' <> 'ai_agent' or o ->> 'tenant_type' <> 'family' then
    raise exception 'TEST FAIL: normalisation / created_via: %', o;
  end if;
  insert into t_co values ('a', (o ->> 'id')::uuid);

  r2 := public.co_create_order('api_agent', null, 'agent-1', '{"customer_name":"Someone Else","customer_phone":"01812345678"}', 'thread-1-20261116', false);
  if (r2 ->> 'created')::boolean or r2 -> 'order' ->> 'id' <> o ->> 'id' then raise exception 'TEST FAIL: idempotent retry created a second order'; end if;
end $$;
do $$
begin
  if to_regclass('public.customer_orders') is null then return; end if;
  perform pg_temp.co_expect($q$select public.co_create_order('api_agent', null, 'agent-2', '{"customer_name":"Rahim","customer_phone":"01712345678","area":"mirpur 10, kazipara"}', null, false)$q$, 'ADMIN_CONFLICT');
  perform pg_temp.co_expect($q$select public.co_create_order('api_agent', null, 'agent-1', '{"customer_name":"X","customer_phone":"01712345679","service_charge_bdt":50}', null, false)$q$, 'ADMIN_VALIDATION');
  perform pg_temp.co_expect($q$select public.co_create_order('api_agent', null, 'agent-1', '{"customer_name":"X","customer_phone":"01712345679","amount_paid":500}', null, false)$q$, 'ADMIN_VALIDATION');
  perform pg_temp.co_expect($q$select public.co_create_order('api_agent', null, 'agent-1', '{"customer_name":"X","customer_phone":"01712345679","type":"PAID_AD"}', null, false)$q$, 'ADMIN_VALIDATION');
  perform pg_temp.co_expect($q$select public.co_create_order('api_agent', null, 'agent-1', '{"customer_name":"No Contact"}', null, false)$q$, 'ADMIN_VALIDATION');
  perform pg_temp.co_expect($q$select public.co_create_order('api_agent', null, 'agent-1', '{"customer_phone":"01712345679"}', null, false)$q$, 'ADMIN_VALIDATION');
  perform pg_temp.co_expect($q$select public.co_create_order('api_agent', null, 'agent-1', '{"customer_name":"X","customer_phone":"0171234"}', null, false)$q$, 'ADMIN_VALIDATION');
  perform pg_temp.co_expect($q$select public.co_create_order('api_agent', null, 'agent-1', '{"customer_name":"X","customer_phone":"01712345679","move_in_date":"2026-02-31"}', null, false)$q$, 'ADMIN_VALIDATION');
  perform pg_temp.co_expect($q$select public.co_create_order('api_agent', null, 'agent-1', '{"customer_name":"X","customer_phone":"01712345679","budget_min":20000,"budget_max":10000}', null, false)$q$, 'ADMIN_VALIDATION');
  -- "Create anyway" is allowed (warn, not hard-block).
  insert into t_co select 'dup', (public.co_create_order('api_agent', null, 'agent-2', '{"customer_name":"Rahim","customer_phone":"01712345678","area":"Mirpur 10, Kazipara"}', null, true) -> 'order' ->> 'id')::uuid;
end $$;
select case when to_regclass('public.customer_orders') is null then 'SKIP T11.1' else 'PASS T11.1 create: 500 BDT server charge, derived fields, idempotent retry, duplicate warning, validation' end;

-- T11.2 status machine incl. AI <-> human handover
do $$
declare a uuid; o jsonb; n int;
begin
  if to_regclass('public.customer_orders') is null then return; end if;
  select id into a from t_co where k = 'a';
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'PAYMENT_VERIFIED', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_admin', null, 'admin-1', %L, 'PAYMENT_VERIFIED', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'PAYMENT_CLAIMED', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'COMPLETED', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'PENDING', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'SEARCHING_BY_AI', '  ')$q$, a), 'ADMIN_VALIDATION');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'NOT_A_STATUS', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');

  o := public.co_set_status('api_agent', null, 'agent-1', a, 'searching_by_ai', 'AI search started') -> 'order';
  if o ->> 'status' <> 'SEARCHING_BY_AI' or o ->> 'search_mode' <> 'AI' then raise exception 'TEST FAIL: AI search state: %', o; end if;
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_admin', null, 'admin-1', %L, 'SEARCHING_BY_HUMAN', 'escalated')$q$, a), 'ADMIN_VALIDATION');
  o := public.co_set_status('api_admin', null, 'admin-1', a, 'SEARCHING_BY_HUMAN', 'Customer asked for a human', 'Mosiur') -> 'order';
  if o ->> 'search_mode' <> 'HUMAN' or o ->> 'search_taken_over_by' <> 'Mosiur' then raise exception 'TEST FAIL: human handover state: %', o; end if;
  o := public.co_set_status('api_admin', null, 'admin-1', a, 'SEARCHING_BY_AI', 'Handing a stalled search back to AI') -> 'order';
  if o ->> 'search_mode' <> 'AI' or o ->> 'search_taken_over_by' is not null then raise exception 'TEST FAIL: hand-back state: %', o; end if;

  select count(*) into n from public.customer_order_status_history where order_id = a;
  if n <> 4 then raise exception 'TEST FAIL: expected 4 history rows (create + 3 handovers), found %', n; end if;
  select count(*) into n from public.customer_order_status_history where order_id = a and to_status = 'SEARCHING_BY_HUMAN' and taken_over_by = 'Mosiur' and actor_label = 'admin-1';
  if n <> 1 then raise exception 'TEST FAIL: handover row does not record who took over'; end if;
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'MATCHED', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'REFUND_REQUESTED', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
end $$;
select case when to_regclass('public.customer_orders') is null then 'SKIP T11.2' else 'PASS T11.2 status machine rejects illegal moves; AI <-> human handover is recorded' end;

-- T11.3 payment claims: amount required, partial maths, claim never verifies, human-only verify
do $$
declare a uuid; o jsonb; c1 uuid; c2 uuid; c3 uuid;
begin
  if to_regclass('public.customer_orders') is null then return; end if;
  select id into a from t_co where k = 'a';
  perform pg_temp.co_expect(format($q$select public.co_record_payment_claim('api_agent', null, 'agent-1', %L, null, '9HX7K2M4P1')$q$, a), 'ADMIN_VALIDATION');
  perform pg_temp.co_expect(format($q$select public.co_record_payment_claim('api_agent', null, 'agent-1', %L, 0, '9HX7K2M4P1')$q$, a), 'ADMIN_VALIDATION');
  perform pg_temp.co_expect(format($q$select public.co_record_payment_claim('api_agent', null, 'agent-1', %L, 500)$q$, a), 'ADMIN_VALIDATION');
  perform pg_temp.co_expect(format($q$select public.co_record_payment_claim('api_agent', null, 'agent-1', %L, 500, null, '12a4')$q$, a), 'ADMIN_VALIDATION');

  o := public.co_record_payment_claim('api_agent', null, 'agent-1', a, 200, null, '3456');
  c1 := (o ->> 'claim_id')::uuid; o := o -> 'order';
  if o ->> 'payment_status' <> 'PARTIAL_PAID' or (o ->> 'amount_paid')::int <> 200 or (o ->> 'amount_due')::int <> 300
     or o ->> 'status' <> 'PAYMENT_CLAIMED' or o ->> 'payment_verification' <> 'CLAIMED' then
    raise exception 'TEST FAIL: partial payment state: %', o;
  end if;
  o := public.co_record_payment_claim('api_agent', null, 'agent-1', a, 300, '9hx7k2m4p1', null);
  c2 := (o ->> 'claim_id')::uuid; o := o -> 'order';
  if o ->> 'payment_status' <> 'PAID' or (o ->> 'amount_paid')::int <> 500 or (o ->> 'amount_due')::int <> 0
     or o ->> 'payment_verification' <> 'CLAIMED' or (o ->> 'contact_unlocked')::boolean or (o ->> 'overpaid')::boolean then
    raise exception 'TEST FAIL: fully claimed (unverified) state: %', o;
  end if;
  perform pg_temp.co_expect(format($q$select public.co_record_payment_claim('api_agent', null, 'agent-1', %L, 100, '9HX7K2M4P1')$q$, a), 'ADMIN_CONFLICT');

  -- claim vs verify separation
  perform pg_temp.co_expect(format($q$select public.co_review_payment_claim('api_agent', null, 'agent-1', %L, 'verify')$q$, c1), 'ADMIN_PERMISSION_DENIED');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'COMPLETED', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
  perform pg_temp.co_expect(format($q$select public.co_review_payment_claim('api_admin', null, 'admin-1', %L, 'reject')$q$, c1), 'ADMIN_VALIDATION');

  o := public.co_review_payment_claim('api_admin', null, 'admin-1', c1, 'verify') -> 'order';
  if o ->> 'status' <> 'PAYMENT_CLAIMED' or o ->> 'payment_verification' <> 'CLAIMED' or (o ->> 'contact_unlocked')::boolean
     or (o ->> 'amount_paid')::int <> 500 or (o ->> 'amount_verified')::int <> 200 then
    raise exception 'TEST FAIL: a verified PARTIAL payment must not verify or unlock the order: %', o;
  end if;
  o := public.co_review_payment_claim('api_admin', null, 'admin-1', c2, 'verify') -> 'order';
  if o ->> 'status' <> 'PAYMENT_VERIFIED' or o ->> 'payment_verification' <> 'VERIFIED' or not (o ->> 'contact_unlocked')::boolean
     or (o ->> 'amount_paid')::int <> 500 or o ->> 'payment_verified_at' is null then
    raise exception 'TEST FAIL: fully verified state: %', o;
  end if;
  perform pg_temp.co_expect(format($q$select public.co_review_payment_claim('api_admin', null, 'admin-1', %L, 'verify')$q$, c2), 'ADMIN_CONFLICT');

  -- overpayment is accepted and flagged, and does not move a verified order back
  o := public.co_record_payment_claim('api_agent', null, 'agent-1', a, 100, null, '9999');
  c3 := (o ->> 'claim_id')::uuid; o := o -> 'order';
  if not (o ->> 'overpaid')::boolean or o ->> 'status' <> 'PAYMENT_VERIFIED' or (o ->> 'amount_due')::int <> 0 then
    raise exception 'TEST FAIL: overpayment state: %', o;
  end if;
  o := public.co_review_payment_claim('api_admin', null, 'admin-1', c3, 'reject', 'Not received') -> 'order';
  if (o ->> 'overpaid')::boolean or (o ->> 'amount_paid')::int <> 500 or o ->> 'status' <> 'PAYMENT_VERIFIED' then
    raise exception 'TEST FAIL: rejected claim still counted: %', o;
  end if;
end $$;
do $$
declare b uuid; o jsonb; c uuid;
begin
  if to_regclass('public.customer_orders') is null then return; end if;
  o := public.co_create_order('api_agent', null, 'agent-1', '{"customer_name":"Karim","facebook_thread_url":"https://www.facebook.com/messages/t/123"}', null, false) -> 'order';
  b := (o ->> 'id')::uuid;
  insert into t_co values ('b', b);
  perform public.co_set_status('api_agent', null, 'agent-1', b, 'REQUIREMENTS_COLLECTED', 'Requirements complete');
  perform public.co_set_status('api_agent', null, 'agent-1', b, 'PAYMENT_INTERESTED', 'Customer said: bKash number din');
  o := public.co_record_payment_claim('api_agent', null, 'agent-1', b, 500, 'ABC1234567');
  c := (o ->> 'claim_id')::uuid;
  o := public.co_review_payment_claim('api_admin', null, 'admin-1', c, 'reject', 'TrxID not found in bKash') -> 'order';
  if o ->> 'status' <> 'PAYMENT_FAILED' or o ->> 'payment_status' <> 'PENDING' or (o ->> 'amount_due')::int <> 500
     or o ->> 'payment_verification' <> 'UNVERIFIED' then
    raise exception 'TEST FAIL: rejected sole claim state: %', o;
  end if;
  perform public.co_set_status('api_agent', null, 'agent-1', b, 'CANCELLED', 'Customer stopped replying');
  perform pg_temp.co_expect(format($q$select public.co_record_payment_claim('api_agent', null, 'agent-1', %L, 500, 'ZZZ1234567')$q$, b), 'ADMIN_INVALID_TRANSITION');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'PENDING', 'reopen')$q$, b), 'ADMIN_PERMISSION_DENIED');
end $$;
select case when to_regclass('public.customer_orders') is null then 'SKIP T11.3' else 'PASS T11.3 payments: amount required, partial maths, claim never verifies, verified partial stays locked, reject -> PAYMENT_FAILED' end;

-- T11.4 matches drive the listings-found counts; refund path; agent limits
do $$
declare a uuid; o jsonb; m1 uuid;
begin
  if to_regclass('public.customer_orders') is null then return; end if;
  select id into a from t_co where k = 'a';
  perform pg_temp.co_expect(format($q$select public.co_add_match('api_agent', null, 'agent-1', %L, '{"general_location":"Mirpur 10"}')$q$, a), 'ADMIN_VALIDATION');
  perform pg_temp.co_expect(format($q$select public.co_add_match('api_agent', null, 'agent-1', %L, '{"reference_id":"R-1","listings_found_count":9}')$q$, a), 'ADMIN_VALIDATION');
  o := public.co_add_match('api_agent', null, 'agent-1', a, '{"reference_id":"R-1","general_location":"Mirpur 10","rent":14000,"verification_status":"unverified","owner_contact_phone":"01911111111","exact_address":"House 5, Road 2"}');
  m1 := (o ->> 'match_id')::uuid;
  o := public.co_add_match('api_agent', null, 'agent-1', a, '{"reference_id":"R-2","general_location":"Kazipara","rent":13000,"verification_status":"verified"}') -> 'order';
  if (o ->> 'listings_found_count')::int <> 2 or (o ->> 'listings_verified_count')::int <> 1 or (o ->> 'listings_unverified_count')::int <> 1 then
    raise exception 'TEST FAIL: listings counts after 2 matches: %', o;
  end if;
  perform pg_temp.co_expect(format($q$select public.co_add_match('api_agent', null, 'agent-1', %L, '{"reference_id":"r-1"}')$q$, a), 'ADMIN_CONFLICT');
  o := public.co_update_match('api_admin', null, 'admin-1', m1, '{"owner_permission":true,"verification_status":"verified"}') -> 'order';
  if (o ->> 'listings_verified_count')::int <> 2 then raise exception 'TEST FAIL: verified count after update: %', o; end if;
  if not exists (select 1 from public.customer_order_matches where id = m1 and owner_permission and owner_permission_recorded_by = 'admin-1') then
    raise exception 'TEST FAIL: owner permission not recorded with its actor';
  end if;
  o := public.co_update_match('api_admin', null, 'admin-1', m1, '{"removed":true}') -> 'order';
  if (o ->> 'listings_found_count')::int <> 1 then raise exception 'TEST FAIL: removed match still counted: %', o; end if;

  -- paid + verified order: search continues, then refund path
  o := public.co_set_status('api_admin', null, 'admin-1', a, 'SEARCHING_BY_HUMAN', 'Search continues after payment', 'Mosiur') -> 'order';
  if o ->> 'status' <> 'SEARCHING_BY_HUMAN' or o ->> 'payment_verification' <> 'VERIFIED' or not (o ->> 'contact_unlocked')::boolean then
    raise exception 'TEST FAIL: paid + verified + searching by human state: %', o;
  end if;
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'CANCELLED', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
  perform public.co_set_status('api_agent', null, 'agent-1', a, 'REFUND_REQUESTED', 'No suitable property within 7 days');
  if (public.co_enriched(a) ->> 'contact_unlocked')::boolean then raise exception 'TEST FAIL: contact still unlocked during a refund'; end if;
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_agent', null, 'agent-1', %L, 'REFUNDED', 'x')$q$, a), 'ADMIN_PERMISSION_DENIED');
  perform public.co_set_status('api_admin', null, 'admin-1', a, 'REFUNDED', 'bKash returned by staff');
  perform pg_temp.co_expect(format($q$select public.co_set_status('api_admin', null, 'admin-1', %L, 'SEARCHING_BY_AI', 'x')$q$, a), 'ADMIN_INVALID_TRANSITION');
  if jsonb_array_length(public.co_timeline(a)) < 10 then raise exception 'TEST FAIL: timeline is missing entries'; end if;
end $$;
select case when to_regclass('public.customer_orders') is null then 'SKIP T11.4' else 'PASS T11.4 listings counts derive from matches; refund path; agent cannot refund or reopen' end;

-- T11.5 append-only logs, no hard delete, soft delete only for admin scope
do $$
declare a uuid; d uuid;
begin
  if to_regclass('public.customer_orders') is null then return; end if;
  select id into a from t_co where k = 'a';
  select id into d from t_co where k = 'dup';
  perform public.co_add_note('api_agent', null, 'agent-1', a, 'Customer asked not to be messaged unless a verified match is found');
  perform pg_temp.co_expect($q$update public.customer_order_status_history set reason = 'tampered'$q$, 'ADMIN_CONFLICT');
  perform pg_temp.co_expect($q$delete from public.customer_order_notes$q$, 'ADMIN_CONFLICT');
  perform pg_temp.co_expect($q$delete from public.customer_order_activity$q$, 'ADMIN_CONFLICT');
  perform pg_temp.co_expect($q$delete from public.customer_orders$q$, 'ADMIN_CONFLICT');
  perform pg_temp.co_expect(format($q$select public.co_soft_delete('api_agent', null, 'agent-1', %L, 'x')$q$, d), 'ADMIN_PERMISSION_DENIED');
  perform public.co_soft_delete('api_admin', null, 'admin-1', d, 'Created by mistake');
  if not exists (select 1 from public.customer_orders where id = d and deleted_at is not null and deleted_by_label = 'admin-1') then
    raise exception 'TEST FAIL: soft delete did not mark the row';
  end if;
  perform pg_temp.co_expect(format($q$select public.co_add_note('api_agent', null, 'agent-1', %L, 'x')$q$, d), 'ADMIN_NOT_FOUND');
  if not public.co_rate_limit_hit('rls-test-key', 2) or not public.co_rate_limit_hit('rls-test-key', 2) or public.co_rate_limit_hit('rls-test-key', 2) then
    raise exception 'TEST FAIL: rate limiter did not stop the third hit';
  end if;
end $$;
select case when to_regclass('public.customer_orders') is null then 'SKIP T11.5' else 'PASS T11.5 logs are append-only, orders are soft-deleted only, rate limit trips' end;

-- T11.6 website orders are mirrored as customer-created
do $$
declare l uuid := gen_random_uuid(); o public.customer_orders%rowtype;
begin
  if to_regclass('public.customer_orders') is null then return; end if;
  insert into public.orders (id, user_id, division, district, area, category, rooms, max_budget, cost, status)
  values (l, (select id from t_ids where k = 'plain'), 'Dhaka', 'Dhaka', 'Uttara', 'Family', 3, 20000, 1000, 'pending_payment');
  select * into o from public.customer_orders where legacy_order_id = l;
  if not found then raise exception 'TEST FAIL: website order was not mirrored'; end if;
  if o.created_via <> 'customer' or o.source <> 'website' or o.status <> 'PENDING' or o.service_charge_bdt <> 1000
     or o.customer_user_id <> (select id from t_ids where k = 'plain') or o.rooms <> 3 then
    raise exception 'TEST FAIL: mirrored order fields: %', to_jsonb(o);
  end if;
  if public.co_mirror_legacy_order(l) <> o.id then raise exception 'TEST FAIL: mirror is not idempotent'; end if;
end $$;
select case when to_regclass('public.customer_orders') is null then 'SKIP T11.6' else 'PASS T11.6 website order mirrored as created_via = customer with the website charge' end;

-- T11.7 clients: anon and plain users get nothing; core functions are not client-executable
set local role anon;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if to_regclass('public.customer_order_transitions') is null then return; end if;
  begin
    perform count(*) from public.customer_orders;
    raise exception 'TEST FAIL: anon can read customer_orders';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.co_create_order('api_admin', null, 'x', '{"customer_name":"X","customer_phone":"01712345670"}');
    raise exception 'TEST FAIL: anon executed co_create_order';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_customer_order_counts();
    raise exception 'TEST FAIL: anon executed admin_customer_order_counts';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'plain'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'plain'), true);
do $$
declare n int;
begin
  if to_regclass('public.customer_order_transitions') is null then return; end if;
  select count(*) into n from public.customer_orders;
  if n <> 0 then raise exception 'TEST FAIL: plain user can read % customer orders', n; end if;
  select count(*) into n from public.customer_orders_enriched;
  if n <> 0 then raise exception 'TEST FAIL: plain user can read % enriched orders', n; end if;
  begin
    perform public.co_review_payment_claim('api_admin', null, 'x', gen_random_uuid(), 'verify');
    raise exception 'TEST FAIL: authenticated executed co_review_payment_claim';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_customer_order_create('{"customer_name":"X","customer_phone":"01712345670"}');
    raise exception 'TEST FAIL: plain user created an order';
  exception when others then
    if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error for plain create: %', sqlerrm; end if;
  end;
  begin
    insert into public.customer_order_notes (order_id, body, actor_type, actor_label) values ((select id from t_co where k = 'a'), 'x', 'admin', 'x');
    raise exception 'TEST FAIL: authenticated inserted a note directly';
  exception when insufficient_privilege then null;
  end;
end $$;
select case when to_regclass('public.customer_orders') is null then 'SKIP T11.7' else 'PASS T11.7 anon and plain users cannot read or write customer orders' end;

-- T11.8 moderator (orders.manage, no payments.review): manages orders, cannot verify; finance verifies
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'mod'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'mod'), true);
do $$
declare r jsonb; o jsonb; n int; cid uuid;
begin
  if to_regclass('public.customer_order_transitions') is null then return; end if;
  r := public.admin_customer_order_create('{"customer_name":"Dashboard Customer","customer_phone":"01612345678","area":"Uttara","rooms":3}');
  o := r -> 'row';
  if o ->> 'created_via' <> 'human_agent' or o ->> 'source' <> 'manual' or o ->> 'created_by_label' <> 'RLS Mod' or r ->> 'audit_id' is null then
    raise exception 'TEST FAIL: dashboard create: %', r;
  end if;
  insert into t_co values ('c', (o ->> 'id')::uuid);
  select count(*) into n from public.customer_orders_enriched where deleted_at is null;
  if n < 3 then raise exception 'TEST FAIL: moderator sees only % orders', n; end if;
  perform public.admin_customer_order_set_status((o ->> 'id')::uuid, 'REQUIREMENTS_COLLECTED', 'Requirements confirmed by phone');
  perform public.admin_customer_order_set_status((o ->> 'id')::uuid, 'PAYMENT_INTERESTED', 'Customer agreed to pay');
  perform public.admin_customer_order_assign((o ->> 'id')::uuid, (select id from t_ids where k = 'mod'));
  begin
    perform public.admin_customer_order_assign((o ->> 'id')::uuid, (select id from t_ids where k = 'plain'));
    raise exception 'TEST FAIL: order assigned to a non-admin';
  exception when others then
    if sqlerrm not like 'ADMIN_VALIDATION%' then raise exception 'TEST FAIL: unexpected error assigning to plain: %', sqlerrm; end if;
  end;
  r := public.admin_customer_order_record_claim((o ->> 'id')::uuid, 500, 'MODTRX1234');
  if r -> 'row' ->> 'status' <> 'PAYMENT_CLAIMED' or r -> 'row' ->> 'payment_verification' <> 'CLAIMED' then
    raise exception 'TEST FAIL: dashboard claim state: %', r;
  end if;
  select id into cid from public.customer_order_payment_claims where order_id = (o ->> 'id')::uuid;
  begin
    perform public.admin_customer_order_review_claim(cid, 'verify');
    raise exception 'TEST FAIL: moderator verified a payment';
  exception when others then
    if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error for moderator verify: %', sqlerrm; end if;
  end;
  begin
    perform public.admin_customer_order_delete((o ->> 'id')::uuid, 'x');
    raise exception 'TEST FAIL: moderator deleted an order';
  exception when others then
    if sqlerrm not like 'ADMIN_PERMISSION_DENIED%' then raise exception 'TEST FAIL: unexpected error for moderator delete: %', sqlerrm; end if;
  end;
  if (public.admin_customer_order_counts() ->> 'awaiting_verification')::int < 1 then raise exception 'TEST FAIL: counts miss the open claim'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'fin'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'fin'), true);
do $$
declare r jsonb; d jsonb; cid uuid; c uuid;
begin
  if to_regclass('public.customer_order_transitions') is null then return; end if;
  select id into c from t_co where k = 'c';
  select id into cid from public.customer_order_payment_claims where order_id = c;
  r := public.admin_customer_order_review_claim(cid, 'verify');
  if r -> 'row' ->> 'status' <> 'PAYMENT_VERIFIED' or r -> 'row' ->> 'payment_verification' <> 'VERIFIED' or r ->> 'audit_id' is null then
    raise exception 'TEST FAIL: finance verify: %', r;
  end if;
  d := public.admin_customer_order_detail(c);
  if jsonb_array_length(d -> 'claims') <> 1 or d -> 'claims' -> 0 ->> 'reviewed_by_label' <> 'RLS Fin' or jsonb_array_length(d -> 'timeline') < 5 then
    raise exception 'TEST FAIL: order detail: %', d;
  end if;
end $$;
reset role;
do $$
declare n int;
begin
  if to_regclass('public.customer_order_transitions') is null then return; end if;
  select count(*) into n from public.admin_audit_log where entity_type = 'customer_order' and action = 'customer_order.payment_verify'
    and actor_id = (select id from t_ids where k = 'fin');
  if n <> 1 then raise exception 'TEST FAIL: verify not in the admin audit log (%)', n; end if;
  select count(*) into n from public.customer_order_activity where actor_type = 'api_agent' and actor_label = 'agent-1';
  if n < 5 then raise exception 'TEST FAIL: API writes do not record the key label (%)', n; end if;
end $$;
select case when to_regclass('public.customer_orders') is null then 'SKIP T11.8' else 'PASS T11.8 moderator manages orders but cannot verify or delete; finance verifies; every write records its actor' end;

-- ---------------------------------------------------------------------------
-- T12. EPS payment for website orders (20261118100000_order_eps_payment.sql).
--      Skipped until the migration is applied.
-- ---------------------------------------------------------------------------
create temp table t_op (k text primary key, id uuid not null);
grant select, insert on t_op to public;

-- T12.1 price constant and grants
do $$
begin
  if to_regproc('public.mark_order_paid_from_gateway') is null then return; end if;
  if public.order_home_pricing() <> '{"regular_bdt":1000,"discount_percent":50,"payable_bdt":500}'::jsonb then
    raise exception 'TEST FAIL: order_home_pricing: %', public.order_home_pricing();
  end if;
  if has_function_privilege('anon', 'public.mark_order_paid_from_gateway(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.mark_order_paid_from_gateway(uuid,uuid)', 'execute') then
    raise exception 'TEST FAIL: mark_order_paid_from_gateway is client-executable';
  end if;
end $$;
select case when to_regproc('public.mark_order_paid_from_gateway') is null then 'SKIP T12.1' else 'PASS T12.1 order price is 500 (1000 less 50%) and the paid-marker is server-only' end;

-- T12.2 a browser insert cannot choose its cost or status, and cannot mark itself paid
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'plain'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'plain'), true);
do $$
declare l uuid := gen_random_uuid(); o public.orders%rowtype;
begin
  if to_regproc('public.mark_order_paid_from_gateway') is null then return; end if;
  insert into public.orders (id, user_id, division, district, area, category, rooms, max_budget, cost, status)
  values (l, (select id from t_ids where k = 'plain'), 'Dhaka', 'Dhaka', 'Banani', 'Family', 2, 18000, 1, 'confirmed');
  select * into o from public.orders where id = l;
  if o.cost <> 500 or o.status <> 'pending_payment' then
    raise exception 'TEST FAIL: tampered insert stored cost % status %', o.cost, o.status;
  end if;
  insert into t_op values ('order', l);
  begin
    perform public.mark_order_paid_from_gateway(gen_random_uuid());
    raise exception 'TEST FAIL: authenticated executed mark_order_paid_from_gateway';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.orders set status = 'pending' where id = l;
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.orders where id = l and status <> 'pending_payment') then
    raise exception 'TEST FAIL: a customer moved their own order out of pending_payment';
  end if;
end $$;
reset role;
select case when to_regproc('public.mark_order_paid_from_gateway') is null then 'SKIP T12.2' else 'PASS T12.2 browser inserts are forced to the offer price and pending_payment' end;

-- T12.3 gateway success: payment credited, order pending, mirror verified, idempotent
do $$
declare l uuid; p uuid := gen_random_uuid(); r jsonb; e record; n int; c_before int; c_after int;
begin
  if to_regproc('public.mark_order_paid_from_gateway') is null then return; end if;
  select id into l from t_op where k = 'order';
  if (select service_charge_bdt from public.customer_orders where legacy_order_id = l) <> 500 then
    raise exception 'TEST FAIL: mirrored order does not carry the 500 BDT charge';
  end if;
  select credits into c_before from public.users where id = (select id from t_ids where k = 'plain');
  insert into public.payment_transactions (id, user_id, order_id, transaction_id, amount, status, credits_to_add, provider, reference)
  values (p, (select id from t_ids where k = 'plain'), l, 'RLS-TEST-ORDER-PAY-1', 500, 'pending', 0, 'eps', '176350000000012345');
  perform pg_temp.co_expect(format('select public.mark_order_paid_from_gateway(%L)', p), 'ADMIN_INVALID_TRANSITION');
  perform pg_temp.co_expect(format('select public.mark_order_paid_from_gateway(%L)', (select id from t_ids where k = 'pay')), 'ADMIN_VALIDATION');
  update public.payment_transactions set status = 'awaiting_admin_approval' where id = p;

  r := public.mark_order_paid_from_gateway(p);
  if r ->> 'mirror' <> 'verified' or r ->> 'order_status' <> 'pending' or (r ->> 'already_paid')::boolean then
    raise exception 'TEST FAIL: mark paid result: %', r;
  end if;
  if (select status from public.payment_transactions where id = p) <> 'credited' then
    raise exception 'TEST FAIL: order payment is not credited';
  end if;
  select status, payment_status, payment_verification, amount_verified, payment_verified_at into e
  from public.customer_orders_enriched where legacy_order_id = l;
  if e.status <> 'PAYMENT_VERIFIED' or e.payment_status <> 'PAID' or e.payment_verification <> 'VERIFIED'
     or e.amount_verified <> 500 or e.payment_verified_at is null then
    raise exception 'TEST FAIL: mirrored order after payment: %', to_jsonb(e);
  end if;

  r := public.mark_order_paid_from_gateway(p);
  if not (r ->> 'already_paid')::boolean then raise exception 'TEST FAIL: second call was not a no-op: %', r; end if;
  select count(*) into n from public.customer_order_payment_claims c
    join public.customer_orders o on o.id = c.order_id where o.legacy_order_id = l;
  if n <> 1 then raise exception 'TEST FAIL: % claims after a repeated call, expected 1', n; end if;
  select credits into c_after from public.users where id = (select id from t_ids where k = 'plain');
  if c_after <> c_before then raise exception 'TEST FAIL: an order payment changed the credit balance'; end if;
end $$;
select case when to_regproc('public.mark_order_paid_from_gateway') is null then 'SKIP T12.3' else 'PASS T12.3 gateway payment marks the order paid once, verifies the mirror, grants no credits' end;

-- T12.4 a held order payment approved by finance takes the order path, not the credit path
do $$
declare l uuid := gen_random_uuid(); p uuid := gen_random_uuid();
begin
  if to_regproc('public.mark_order_paid_from_gateway') is null then return; end if;
  insert into public.orders (id, user_id, division, district, area, category, rooms, max_budget, cost, status)
  values (l, (select id from t_ids where k = 'plain'), 'Dhaka', 'Dhaka', 'Dhanmondi', 'Family', 3, 30000, 500, 'pending_payment');
  insert into public.payment_transactions (id, user_id, order_id, transaction_id, amount, status, credits_to_add, provider, reference)
  values (p, (select id from t_ids where k = 'plain'), l, 'RLS-TEST-ORDER-PAY-2', 450, 'awaiting_admin_approval', 0, 'eps', '176350000000054321');
  insert into t_op values ('held_order', l), ('held_pay', p);
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from t_ids where k = 'fin'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'fin'), true);
do $$
declare r jsonb;
begin
  if to_regproc('public.mark_order_paid_from_gateway') is null then return; end if;
  r := public.admin_approve_payment((select id from t_op where k = 'held_pay'));
  if r -> 'row' ->> 'status' <> 'credited' or (r ->> 'credits_added')::int <> 0 then
    raise exception 'TEST FAIL: finance approval of an order payment: %', r;
  end if;
end $$;
reset role;
do $$
declare e record;
begin
  if to_regproc('public.mark_order_paid_from_gateway') is null then return; end if;
  if (select status from public.orders where id = (select id from t_op where k = 'held_order')) <> 'pending' then
    raise exception 'TEST FAIL: approved order payment did not move the order to pending';
  end if;
  -- 450 of 500: recorded and verified, but the order is not fully paid.
  select status, payment_status, amount_verified into e
  from public.customer_orders_enriched where legacy_order_id = (select id from t_op where k = 'held_order');
  if e.amount_verified <> 450 or e.payment_status <> 'PARTIAL_PAID' or e.status = 'PAYMENT_VERIFIED' then
    raise exception 'TEST FAIL: mirrored order after a short payment: %', to_jsonb(e);
  end if;
end $$;
select case when to_regproc('public.mark_order_paid_from_gateway') is null then 'SKIP T12.4' else 'PASS T12.4 admin approval of an order payment marks the order, adds no credits, keeps a short payment partial' end;

select 'RLS_TESTS_PASSED';
