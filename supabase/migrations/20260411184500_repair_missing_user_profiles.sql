create or replace function public.ensure_user_profile_for_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_auth_user auth.users%rowtype;
  v_existing_user_id uuid;
  v_referral_code text := '';
  v_legacy_sponsor_id uuid;
  v_sponsor_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = p_user_id;

  if not found then
    return null;
  end if;

  select id
  into v_existing_user_id
  from public.users
  where id = p_user_id;

  if v_existing_user_id is not null then
    return v_existing_user_id;
  end if;

  v_referral_code := upper(trim(coalesce(v_auth_user.raw_user_meta_data->>'referral_code', '')));

  begin
    v_legacy_sponsor_id := (v_auth_user.raw_user_meta_data->>'sponsor_id')::uuid;
  exception
    when others then
      v_legacy_sponsor_id := null;
  end;

  v_sponsor_id := public.resolve_signup_sponsor_id(
    v_referral_code,
    v_legacy_sponsor_id
  );

  insert into public.users (
    id,
    email,
    phone,
    name,
    credits,
    verified,
    is_admin,
    is_active,
    role,
    referral_code,
    sponsor_id,
    placement_parent_id,
    created_at,
    updated_at
  )
  values (
    v_auth_user.id,
    v_auth_user.email,
    coalesce(v_auth_user.phone, v_auth_user.raw_user_meta_data->>'phone'),
    coalesce(v_auth_user.raw_user_meta_data->>'name', split_part(v_auth_user.email, '@', 1)),
    0,
    false,
    false,
    true,
    'agent',
    public.generate_unique_referral_code(),
    v_sponsor_id,
    v_sponsor_id,
    now(),
    now()
  )
  on conflict (id) do update
  set
    phone = coalesce(excluded.phone, public.users.phone),
    name = coalesce(excluded.name, public.users.name),
    sponsor_id = coalesce(public.users.sponsor_id, excluded.sponsor_id),
    placement_parent_id = coalesce(public.users.placement_parent_id, excluded.placement_parent_id),
    referral_code = coalesce(public.users.referral_code, excluded.referral_code),
    role = case
      when coalesce(public.users.role, 'tenant') = 'tenant' then 'agent'
      else public.users.role
    end,
    updated_at = now();

  perform public.upsert_team_tree_entry(
    v_auth_user.id,
    v_sponsor_id,
    v_sponsor_id,
    coalesce(v_auth_user.created_at, now())
  );

  perform public.rebuild_team_tree_metrics();

  return v_auth_user.id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.ensure_user_profile_for_user(new.id);
  return new;
end;
$$;

create or replace function public.ensure_current_user_profile()
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  return public.ensure_user_profile_for_user(auth.uid());
end;
$$;

revoke all on function public.ensure_current_user_profile() from public;
grant execute on function public.ensure_current_user_profile() to authenticated;

do $$
declare
  v_missing_user record;
begin
  for v_missing_user in
    select au.id
    from auth.users au
    left join public.users pu on pu.id = au.id
    where pu.id is null
  loop
    perform public.ensure_user_profile_for_user(v_missing_user.id);
  end loop;
end;
$$;
