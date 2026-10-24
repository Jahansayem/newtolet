-- Full revert of 20261025090000_admin_roles_audit_rpcs.sql, except:
--   * admin_audit_log is KEPT (append-only evidence of what admins did)
--   * added columns are KEPT (dropping them would destroy data; they are
--     nullable or defaulted and harmless to the old client)
--   * the restored policies are the pre-migration ones from the 2026-10-24
--     snapshot, including their permissive USING (true) forms, because that is
--     what the old client expects. Re-apply the migration as soon as possible.
--
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < scripts/deploy/supabase-selfhost/rollback-admin-migration.sql

begin;

-- RPCs and helpers
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'admin\_%' or p.proname in ('assert_admin_permission', 'assert_admin_transition', 'log_admin_action',
           'get_my_admin_profile', 'current_admin_roles', 'admin_has_permission', 'prevent_privileged_user_column_changes'))
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

drop trigger if exists trg_users_prevent_privileged_changes on public.users;

-- Original helper body (DATABASE_SCHEMA.sql:29-42 / deployed snapshot)
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and coalesce(is_admin, false) = true
  );
$$;
grant execute on function public.is_current_user_admin() to anon, authenticated, service_role;

-- Original approve function (20261024120000_approve_credit_payment_rpc.sql) without the auth guard
create or replace function public.approve_credit_payment_transaction(p_payment_transaction_id uuid, p_admin_id uuid)
returns table(payment_id uuid, transaction_id text, user_id uuid, credits_added integer, balance_after integer, status text)
language plpgsql security definer set search_path = public
as $$
declare payment_record public.payment_transactions%rowtype; next_balance integer;
begin
  select * into payment_record from public.payment_transactions where id = p_payment_transaction_id for update;
  if not found then raise exception 'Payment transaction not found'; end if;
  if payment_record.status = 'credited' then
    return query select payment_record.id, payment_record.transaction_id, payment_record.user_id, coalesce(payment_record.credits_to_add,0),
      coalesce((select credits from public.users where id = payment_record.user_id),0), payment_record.status;
    return;
  end if;
  if payment_record.status <> 'awaiting_admin_approval' then raise exception 'Only verified payments can be approved'; end if;
  update public.users set credits = coalesce(credits,0) + coalesce(payment_record.credits_to_add,0), updated_at = now()
  where id = payment_record.user_id returning credits into next_balance;
  insert into public.credit_transactions (user_id, credits_deducted, transaction_type, credits_amount, balance_after, reference_type, reference_id, provider, metadata, payment_transaction_id)
  values (payment_record.user_id, -coalesce(payment_record.credits_to_add,0), 'credit_purchase', coalesce(payment_record.credits_to_add,0), next_balance,
          'payment_transaction', payment_record.id, coalesce(payment_record.provider,'eps'),
          jsonb_build_object('invoice_id', coalesce(payment_record.invoice_id, payment_record.reference), 'approved_by', p_admin_id), payment_record.transaction_id);
  update public.payment_transactions set status='credited', approved_at=coalesce(approved_at,now()), approved_by=coalesce(approved_by,p_admin_id),
    credited_at=now(), credited_by=p_admin_id, updated_at=now() where id = payment_record.id;
  return query select payment_record.id, payment_record.transaction_id, payment_record.user_id, coalesce(payment_record.credits_to_add,0), next_balance, 'credited'::text;
end;
$$;
grant execute on function public.approve_credit_payment_transaction(uuid, uuid) to service_role, authenticated;

-- Tables (audit log kept)
drop table if exists public.credit_pricing_versions;
drop table if exists public.admin_status_transitions;
drop table if exists public.admin_role_permissions;
drop table if exists public.admin_memberships;

-- Policies replaced by the migration -> pre-migration forms
drop policy if exists "Admins can update all users" on public.users;
create policy "Admins can update all users" on public.users for update to authenticated using (true);
drop policy if exists "Admins can view all users" on public.users;
create policy "Admins can view all users" on public.users for select to authenticated using (true);

create policy "Admins can view all properties" on public.properties for select to authenticated using (true);
create policy "Admins can update all properties" on public.properties for update to authenticated using (true);
create policy "Admins can delete all properties" on public.properties for delete to authenticated using (true);

drop policy if exists feedback_public_read on public.feedback;
drop policy if exists feedback_admin_update on public.feedback;
drop policy if exists feedback_admin_delete on public.feedback;
create policy "Anyone can view feedback" on public.feedback for select using (true);
create policy "Anyone can update feedback" on public.feedback for update using (true);
create policy "Anyone can delete feedback" on public.feedback for delete using (true);

drop policy if exists cover_photos_admin_manage on public.cover_photos;
create policy "Authenticated users can manage cover photos" on public.cover_photos for all to authenticated using (true) with check (true);

drop policy if exists payment_transactions_owner_cancel_pending on public.payment_transactions;
drop policy if exists payment_transactions_admin_update on public.payment_transactions;
create policy "Users can update own payment transactions" on public.payment_transactions for update to authenticated
  using (auth.uid() = user_id or public.is_current_user_admin()) with check (auth.uid() = user_id or public.is_current_user_admin());

drop policy if exists customer_search_history_admin_read on public.customer_search_history;
create policy "Authenticated users can view customer search history" on public.customer_search_history for select to authenticated using (true);

-- Policies that referenced admin_has_permission() were dropped by CASCADE above; restore admin forms.
create policy "Admins can update orders" on public.orders for update to authenticated using (public.is_current_user_admin());
create policy "Admins can delete orders" on public.orders for delete to authenticated using (public.is_current_user_admin());
create policy property_inquiries_admin_update on public.property_inquiries for update to authenticated using (public.is_current_user_admin());
create policy property_inquiries_admin_delete on public.property_inquiries for delete to authenticated using (public.is_current_user_admin());
create policy "Admins can manage credit packages" on public.credit_packages for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
create policy "Admins can manage credit settings" on public.credit_settings for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
create policy "Admins can manage site settings" on public.site_settings for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
create policy "Admins can update referral settings" on public.referral_settings for update to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
create policy "Admins can manage blacklist" on public.user_blacklist for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
create policy user_verifications_admin_update on public.user_verifications for update to authenticated using (public.is_current_user_admin());
create policy admin_audit_log_select on public.admin_audit_log for select to authenticated using (public.is_current_user_admin());

-- Function grants: restore PUBLIC execute (pre-migration default)
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef loop
    execute format('grant execute on function %s to public', r.sig);
  end loop;
end $$;

commit;
