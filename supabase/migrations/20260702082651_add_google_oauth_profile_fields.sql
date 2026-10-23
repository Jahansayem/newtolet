alter table if exists public.users
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists google_id text,
  add column if not exists provider text default 'email';

create unique index if not exists idx_users_google_id
on public.users (google_id)
where google_id is not null;

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
  v_provider text;
  v_full_name text;
  v_avatar_url text;
  v_google_id text;
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

  v_provider := coalesce(
    nullif(v_auth_user.raw_app_meta_data->>'provider', ''),
    nullif(v_auth_user.raw_user_meta_data->>'provider', ''),
    'email'
  );

  v_full_name := coalesce(
    nullif(v_auth_user.raw_user_meta_data->>'full_name', ''),
    nullif(v_auth_user.raw_user_meta_data->>'name', ''),
    split_part(v_auth_user.email, '@', 1)
  );

  v_avatar_url := coalesce(
    nullif(v_auth_user.raw_user_meta_data->>'avatar_url', ''),
    nullif(v_auth_user.raw_user_meta_data->>'picture', '')
  );

  v_google_id := case
    when v_provider = 'google' then coalesce(
      nullif(v_auth_user.raw_user_meta_data->>'sub', ''),
      nullif(v_auth_user.raw_user_meta_data->>'provider_id', '')
    )
    else null
  end;

  select id
  into v_existing_user_id
  from public.users
  where id = p_user_id;

  v_referral_code := upper(trim(coalesce(
    v_auth_user.raw_user_meta_data->>'referral_code',
    v_auth_user.raw_user_meta_data->>'referral_input',
    ''
  )));

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
    full_name,
    avatar_url,
    google_id,
    provider,
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
    coalesce(nullif(v_auth_user.raw_user_meta_data->>'name', ''), v_full_name),
    v_full_name,
    v_avatar_url,
    v_google_id,
    v_provider,
    0,
    false,
    false,
    true,
    'agent',
    public.generate_unique_referral_code(),
    v_sponsor_id,
    v_sponsor_id,
    coalesce(v_auth_user.created_at, now()),
    now()
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.users.email),
    phone = coalesce(excluded.phone, public.users.phone),
    name = coalesce(excluded.name, public.users.name),
    full_name = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    google_id = coalesce(public.users.google_id, excluded.google_id),
    provider = case
      when excluded.provider = 'google' then 'google'
      else coalesce(public.users.provider, excluded.provider, 'email')
    end,
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

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.ensure_user_profile_for_user(uuid) from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.ensure_current_user_profile() from public;
grant execute on function public.ensure_current_user_profile() to authenticated;
