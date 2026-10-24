--
-- PostgreSQL database dump
--

\restrict iXrwuje0Ska6XRxhitUkFPO8sB5zrol5naPr5lPKhyceSrLvnz8weocqbqicWXX

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: approve_credit_payment_transaction(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_credit_payment_transaction(p_payment_transaction_id uuid, p_admin_id uuid) RETURNS TABLE(payment_id uuid, transaction_id text, user_id uuid, credits_added integer, balance_after integer, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  payment_record public.payment_transactions%ROWTYPE;
  next_balance INTEGER;
BEGIN
  SELECT *
  INTO payment_record
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  IF payment_record.status = 'credited' THEN
    RETURN QUERY
    SELECT
      payment_record.id,
      payment_record.transaction_id,
      payment_record.user_id,
      COALESCE(payment_record.credits_to_add, 0),
      COALESCE((SELECT credits FROM public.users WHERE id = payment_record.user_id), 0),
      payment_record.status;
    RETURN;
  END IF;

  IF payment_record.status <> 'awaiting_admin_approval' THEN
    RAISE EXCEPTION 'Only verified payments can be approved';
  END IF;

  UPDATE public.users
  SET
    credits = COALESCE(credits, 0) + COALESCE(payment_record.credits_to_add, 0),
    updated_at = NOW()
  WHERE id = payment_record.user_id
  RETURNING credits INTO next_balance;

  INSERT INTO public.credit_transactions (
    user_id,
    credits_deducted,
    transaction_type,
    credits_amount,
    balance_after,
    reference_type,
    reference_id,
    provider,
    metadata,
    payment_transaction_id
  )
  VALUES (
    payment_record.user_id,
    -COALESCE(payment_record.credits_to_add, 0),
    'credit_purchase',
    COALESCE(payment_record.credits_to_add, 0),
    next_balance,
    'payment_transaction',
    payment_record.id,
    COALESCE(payment_record.provider, 'eps'),
    jsonb_build_object(
      'invoice_id', COALESCE(payment_record.invoice_id, payment_record.reference),
      'approved_by', p_admin_id
    ),
    payment_record.transaction_id
  );

  UPDATE public.payment_transactions
  SET
    status = 'credited',
    approved_at = COALESCE(approved_at, NOW()),
    approved_by = COALESCE(approved_by, p_admin_id),
    credited_at = NOW(),
    credited_by = p_admin_id,
    updated_at = NOW()
  WHERE id = payment_record.id;

  RETURN QUERY
  SELECT
    payment_record.id,
    payment_record.transaction_id,
    payment_record.user_id,
    COALESCE(payment_record.credits_to_add, 0),
    next_balance,
    'credited'::TEXT;
END;
$$;


--
-- Name: assign_property_id_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_property_id_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    new.property_id_number := nextval('public.property_id_number_seq')::text;
  elsif tg_op = 'UPDATE' then
    new.property_id_number := old.property_id_number;
  end if;

  return new;
end;
$$;


--
-- Name: award_completed_referral_points_for_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_completed_referral_points_for_user(p_inviter_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_invite_id uuid;
  v_awarded integer := 0;
begin
  if not public.is_referral_bonus_eligible(p_inviter_id) then
    return 0;
  end if;

  for v_invite_id in
    select id
    from public.invites
    where inviter_id = p_inviter_id
      and status = 'completed'
      and coalesce(points_awarded, 0) = 0
    order by created_at asc
  loop
    v_awarded := v_awarded + public.process_referral_bonus_for_invite(v_invite_id);
  end loop;

  return v_awarded;
end;
$$;


--
-- Name: award_listing_points_on_approval(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_listing_points_on_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_role text;
  v_points integer;
  v_usd numeric(12, 6);
begin
  if new.status = 'approved'
     and coalesce(old.status, '') <> 'approved'
     and new.listing_points_awarded_at is null then
    select role
    into v_role
    from public.users
    where id = new.user_id;

    v_points := public.resolve_listing_points_for_role(v_role);
    v_usd := round((v_points::numeric / 3500.0), 6);

    if v_points > 0 then
      insert into public.points_ledger (
        user_id,
        action,
        points,
        usd_value,
        created_at
      )
      values (
        new.user_id,
        'listing',
        v_points,
        v_usd,
        timezone('utc', now())
      );

      update public.users
      set
        ppv = coalesce(ppv, 0) + v_points,
        balance_usd = coalesce(balance_usd, 0) + v_usd
      where id = new.user_id;

      perform public.award_completed_referral_points_for_user(new.user_id);
    end if;

    new.listing_points_awarded = v_points;
    new.listing_points_awarded_at = timezone('utc', now());
  end if;

  return new;
end;
$$;


--
-- Name: award_points(uuid, text, integer, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_points(p_user_id uuid, p_action text, p_points integer, p_reference_id uuid DEFAULT NULL::uuid, p_reference_type text DEFAULT NULL::text, p_description text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.points_ledger (user_id, action, points, usd_value, reference_id, reference_type, description)
  VALUES (p_user_id, p_action, p_points, ROUND(p_points / 3500.0, 6), p_reference_id, p_reference_type, p_description);

  UPDATE public.users
  SET
    ppv = ppv + p_points,
    balance_usd = balance_usd + ROUND(p_points / 3500.0, 6),
    last_active_at = now(),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;


--
-- Name: award_referral_points_on_invite_completion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_referral_points_on_invite_completion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.status = 'completed'
     and coalesce(old.status, '') <> 'completed' then
    perform public.process_referral_bonus_for_invite(new.id);
  end if;

  return new;
end;
$$;


--
-- Name: backfill_referral_tree(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backfill_referral_tree() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_root uuid;
  r record;
begin
  v_root := public.get_root_sponsor_user_id();

  update public.users
  set
    sponsor_id = null,
    placement_parent_id = null,
    referral_code = coalesce(referral_code, public.generate_unique_referral_code()),
    updated_at = now()
  where id = v_root;

  perform public.upsert_team_tree_entry(
    v_root,
    null,
    null,
    (
      select coalesce(u.created_at at time zone 'utc', now())
      from public.users u
      where u.id = v_root
    )
  );

  delete from public.team_tree
  where user_id <> v_root;

  for r in
    select
      u.id,
      coalesce(u.sponsor_id, v_root) as sponsor_id,
      coalesce(u.placement_parent_id, u.sponsor_id, v_root) as placement_parent_id,
      u.created_at
    from public.users u
    where u.id <> v_root
    order by u.created_at asc nulls last, u.id asc
  loop
    if not exists (
      select 1
      from public.team_tree tt
      where tt.user_id = r.sponsor_id
    ) then
      r.sponsor_id := v_root;
    end if;

    if not exists (
      select 1
      from public.team_tree tt
      where tt.user_id = r.placement_parent_id
    ) then
      r.placement_parent_id := r.sponsor_id;
    end if;

    update public.users
    set
      sponsor_id = r.sponsor_id,
      placement_parent_id = r.placement_parent_id,
      role = case
        when coalesce(role, 'tenant') = 'tenant' then 'agent'
        else role
      end,
      referral_code = coalesce(referral_code, public.generate_unique_referral_code()),
      updated_at = now()
    where id = r.id;

    perform public.upsert_team_tree_entry(
      r.id,
      r.sponsor_id,
      r.placement_parent_id,
      coalesce(r.created_at at time zone 'utc', now())
    );
  end loop;

  delete from public.team_tree tt
  where not exists (
    select 1
    from public.users u
    where u.id = tt.user_id
  );

  perform public.rebuild_team_tree_metrics();
end;
$$;


--
-- Name: check_quality_bonus(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_quality_bonus(p_property_id uuid, p_agent_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  photo_count integer;
  has_full_details boolean;
BEGIN
  SELECT COUNT(*) INTO photo_count
  FROM public.property_images WHERE property_id = p_property_id;

  SELECT (
    short_description IS NOT NULL AND
    total_rooms IS NOT NULL AND
    total_bathrooms IS NOT NULL AND
    room_size_sqft IS NOT NULL AND
    lat IS NOT NULL AND
    lng IS NOT NULL
  ) INTO has_full_details
  FROM public.properties WHERE id = p_property_id;

  IF photo_count >= 5 AND has_full_details THEN
    PERFORM award_points(p_agent_id, 'quality_bonus', 30, p_property_id, 'property', 'Listing quality bonus');
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


--
-- Name: claim_referral_username(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_referral_username(p_username text) RETURNS TABLE(id uuid, referral_username text, referral_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_username TEXT;
BEGIN
  v_user_id := auth.uid();
  v_username := public.normalize_referral_username(p_username);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF LENGTH(v_username) < 4 THEN
    RAISE EXCEPTION 'Referral username must be at least 4 characters.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE referral_username = v_username
      AND id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'Referral username is already taken.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = v_user_id
      AND referral_username IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Referral username has already been created and cannot be changed.';
  END IF;

  UPDATE public.users
  SET
    referral_username = v_username,
    referral_code = COALESCE(NULLIF(referral_code, ''), CONCAT('REF', UPPER(REPLACE(LEFT(id::TEXT, 8), '-', '')))),
    updated_at = NOW()
  WHERE id = v_user_id
  RETURNING users.id, users.referral_username, users.referral_code
  INTO id, referral_username, referral_code;

  RETURN NEXT;
END;
$$;


--
-- Name: complete_credit_topup(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_credit_topup(p_transaction_id text) RETURNS TABLE(topup_id uuid, transaction_id text, credits_added integer, balance_after integer, status text, credited_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_topup public.credit_topups%rowtype;
  v_is_admin boolean := false;
  v_balance_after integer := 0;
begin
  if auth.uid() is not null then
    select coalesce(is_admin, false)
    into v_is_admin
    from public.users
    where id = auth.uid();
  end if;

  select *
  into v_topup
  from public.credit_topups
  where credit_topups.transaction_id = p_transaction_id
  for update;

  if not found then
    raise exception 'Credit topup not found for transaction %', p_transaction_id using errcode = 'P0002';
  end if;

  if auth.uid() is not null and auth.uid() <> v_topup.user_id and not v_is_admin then
    raise exception 'Not authorized to complete this topup' using errcode = '42501';
  end if;

  if v_topup.credited_at is not null then
    select coalesce(credits, 0)
    into v_balance_after
    from public.users
    where id = v_topup.user_id;

    return query
    select v_topup.id, v_topup.transaction_id, v_topup.credits_to_add, v_balance_after, v_topup.status, v_topup.credited_at;
    return;
  end if;

  update public.users
  set credits = coalesce(credits, 0) + v_topup.credits_to_add,
      updated_at = now()
  where id = v_topup.user_id
  returning credits into v_balance_after;

  insert into public.credit_transactions (
    user_id,
    credits_deducted,
    credits_amount,
    balance_after,
    transaction_type,
    reference_type,
    reference_id,
    provider,
    metadata
  )
  values (
    v_topup.user_id,
    -v_topup.credits_to_add,
    v_topup.credits_to_add,
    v_balance_after,
    'credit_purchase',
    'credit_topup',
    v_topup.id,
    v_topup.provider,
    jsonb_build_object(
      'transaction_id', v_topup.transaction_id,
      'payment_method', v_topup.payment_method,
      'amount_bdt', v_topup.amount_bdt
    )
  )
  on conflict (reference_type, reference_id) where reference_type is not null and reference_id is not null do nothing;

  update public.credit_topups
  set status = 'paid',
      credited_at = now(),
      updated_at = now()
  where id = v_topup.id
  returning credit_topups.credited_at, credit_topups.status into v_topup.credited_at, v_topup.status;

  return query
  select v_topup.id, v_topup.transaction_id, v_topup.credits_to_add, v_balance_after, v_topup.status, v_topup.credited_at;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawal_requests (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    wallet_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    admin_note text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: create_withdrawal_request(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_withdrawal_request(p_wallet_id uuid, p_amount numeric) RETURNS SETOF public.withdrawal_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_available_balance NUMERIC(10,2);
  v_min_withdrawal NUMERIC(10,2);
  v_request public.withdrawal_requests;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_wallets
    WHERE id = p_wallet_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Wallet not found.';
  END IF;

  SELECT COALESCE(min_withdrawal_amount, 100)
  INTO v_min_withdrawal
  FROM public.site_settings
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT GREATEST(
    0,
    COALESCE((
      SELECT SUM(commission_amount)
      FROM public.referral_earnings
      WHERE referrer_user_id = v_user_id
        AND status <> 'reversed'
    ), 0)
    - COALESCE((
      SELECT SUM(amount)
      FROM public.withdrawal_requests
      WHERE user_id = v_user_id
        AND status IN ('requested', 'approved', 'paid')
    ), 0)
  )
  INTO v_available_balance;

  IF p_amount < v_min_withdrawal THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is % BDT.', v_min_withdrawal;
  END IF;

  IF p_amount > v_available_balance THEN
    RAISE EXCEPTION 'Requested amount exceeds your withdrawable balance.';
  END IF;

  INSERT INTO public.withdrawal_requests (
    user_id,
    wallet_id,
    amount,
    status,
    requested_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_wallet_id,
    p_amount,
    'requested',
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING * INTO v_request;

  RETURN NEXT v_request;
END;
$$;


--
-- Name: ensure_current_user_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_current_user_profile() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'extensions'
    AS $$
begin
  return public.ensure_user_profile_for_user(auth.uid());
end;
$$;


--
-- Name: ensure_user_profile_for_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_user_profile_for_user(p_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'extensions'
    AS $$
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


--
-- Name: find_public_property_id_by_number(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_public_property_id_by_number(p_number text) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_number text := btrim(coalesce(p_number, ''));
  v_id uuid;
begin
  if v_number !~ '^\d+$' then
    return null;
  end if;

  select p.id
  into v_id
  from public.properties p
  where p.property_id_number = v_number
    and p.status = 'approved'
    and coalesce(p.is_active, true) = true
  limit 1;

  return v_id;
end;
$_$;


--
-- Name: generate_unique_referral_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_unique_referral_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_code text;
begin
  loop
    v_code := 'NT' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 6));
    exit when not exists (
      select 1
      from public.users
      where referral_code = v_code
    );
  end loop;

  return v_code;
end;
$$;


--
-- Name: get_approved_listing_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_approved_listing_count(p_user_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::integer
  from public.properties
  where user_id = p_user_id
    and status = 'approved';
$$;


--
-- Name: get_direct_referrals(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_direct_referrals(p_user_id uuid) RETURNS TABLE(user_id uuid, name text, star_level integer, activity_status text, ppv integer, profile_image_url text, joined_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    tt.user_id,
    u.name,
    u.star_level,
    u.activity_status,
    u.ppv,
    u.profile_image_url,
    tt.joined_at
  FROM public.team_tree tt
  JOIN public.users u ON u.id = tt.user_id
  WHERE tt.sponsor_id = p_user_id
  ORDER BY tt.joined_at DESC;
END;
$$;


--
-- Name: get_employee_listing_streak(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_employee_listing_streak(p_user_id uuid DEFAULT auth.uid()) RETURNS TABLE(current_streak integer, longest_streak integer, last_qualified_date date, completed_today boolean, today_qualifying_count integer, timezone_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with context as (
    select
      p_user_id as user_id,
      public.get_listing_streak_timezone() as timezone_name,
      timezone(public.get_listing_streak_timezone(), now())::date as today_date
  )
  select
    coalesce(s.current_streak, 0) as current_streak,
    coalesce(s.longest_streak, 0) as longest_streak,
    s.last_qualified_date,
    coalesce(d.qualifying_listing_count, 0) > 0 as completed_today,
    coalesce(d.qualifying_listing_count, 0) as today_qualifying_count,
    c.timezone_name
  from context c
  left join public.employee_listing_streaks s
    on s.user_id = c.user_id
  left join public.employee_listing_streak_days d
    on d.user_id = c.user_id
   and d.activity_date = c.today_date;
$$;


--
-- Name: get_gpv(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_gpv(p_user_id uuid, p_month date DEFAULT (date_trunc('month'::text, now()))::date) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT COALESCE(SUM(pl.points), 0)::integer
  FROM public.points_ledger pl
  WHERE pl.user_id IN (
    SELECT tt.user_id FROM public.team_tree tt
    WHERE tt.sponsor_path <@ (
      SELECT t2.sponsor_path FROM public.team_tree t2 WHERE t2.user_id = p_user_id
    )
    AND tt.user_id != p_user_id
  )
  AND pl.points > 0
  AND pl.created_at >= p_month
  AND pl.created_at < (p_month + interval '1 month');
$$;


--
-- Name: get_listing_streak_timezone(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_listing_streak_timezone() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (
      select nullif(trim(timezone_name), '')
      from public.employee_listing_streak_settings
      where id = true
      limit 1
    ),
    'Asia/Dhaka'
  );
$$;


--
-- Name: get_property_detail_for_viewer(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_property_detail_for_viewer(p_property_id uuid) RETURNS TABLE(id uuid, user_id uuid, property_id_number text, category text, property_type text, total_rooms integer, total_bathrooms integer, balcony integer, floor_level text, occupancy text, room_size_sqft integer, rent_amount_bdt integer, rent_period text, state_district text, area text, sub_area text, contact_number text, short_description text, sector text, road text, house_plot text, lat numeric, lng numeric, available_from date, deadline date, status text, created_at timestamp without time zone, updated_at timestamp without time zone, reviewed_at timestamp with time zone, is_featured boolean, is_active boolean, is_pinned boolean, total_kitchen integer, dining_rooms integer, living_rooms integer, is_rent_negotiable boolean, protected_contact_unlocked boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_property public.properties%rowtype;
  v_viewer_id uuid := auth.uid();
  v_can_reveal boolean := false;
begin
  if p_property_id is null then
    raise exception 'Property is required.';
  end if;

  select *
  into v_property
  from public.properties
  where properties.id = p_property_id
  limit 1;

  if not found then
    raise exception 'Property not found.';
  end if;

  if coalesce(v_property.is_active, true) = false
     and v_property.user_id is distinct from v_viewer_id
     and not public.is_current_user_admin() then
    raise exception 'Property not found.';
  end if;

  if v_property.status <> 'approved'
     and v_property.user_id is distinct from v_viewer_id
     and not public.is_current_user_admin() then
    raise exception 'Property not found.';
  end if;

  v_can_reveal :=
    public.is_current_user_admin()
    or (v_viewer_id is not null and v_property.user_id = v_viewer_id)
    or exists (
      select 1
      from public.contact_views cv
      where cv.user_id = v_viewer_id
        and cv.property_id = v_property.id
    );

  return query
  select
    v_property.id,
    v_property.user_id,
    v_property.property_id_number,
    v_property.category,
    v_property.property_type,
    v_property.total_rooms,
    v_property.total_bathrooms,
    v_property.balcony,
    v_property.floor_level,
    v_property.occupancy,
    v_property.room_size_sqft,
    v_property.rent_amount_bdt,
    v_property.rent_period,
    v_property.state_district,
    v_property.area,
    v_property.sub_area,
    case when v_can_reveal then v_property.contact_number else null end,
    v_property.short_description,
    case when v_can_reveal then v_property.sector else null end,
    case when v_can_reveal then v_property.road else null end,
    case when v_can_reveal then v_property.house_plot else null end,
    v_property.lat::numeric,
    v_property.lng::numeric,
    v_property.available_from,
    v_property.deadline,
    v_property.status,
    v_property.created_at,
    v_property.updated_at,
    v_property.reviewed_at,
    v_property.is_featured,
    coalesce(v_property.is_active, true),
    coalesce(v_property.is_pinned, false),
    v_property.total_kitchen,
    v_property.dining_rooms,
    v_property.living_rooms,
    coalesce(v_property.is_rent_negotiable, false),
    v_can_reveal;
end;
$$;


--
-- Name: get_referral_candidate(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_referral_candidate(p_referral_input text) RETURNS TABLE(id uuid, name text, email text, phone text, referral_username text, referral_code text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := public.resolve_referral_user_id(p_referral_input);

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.name, ''),
    COALESCE(u.email, ''),
    COALESCE(u.phone, ''),
    COALESCE(u.referral_username, ''),
    COALESCE(u.referral_code, '')
  FROM public.users u
  WHERE u.id = v_user_id
  LIMIT 1;
END;
$$;


--
-- Name: get_root_sponsor_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_root_sponsor_user_id() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_root uuid;
begin
  select rs.root_sponsor_user_id
  into v_root
  from public.referral_settings rs
  where rs.id = true;

  if v_root is null then
    raise exception 'Root sponsor is not configured';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = v_root
      and coalesce(u.is_admin, false) = true
  ) then
    raise exception 'Root sponsor must reference an admin user';
  end if;

  return v_root;
end;
$$;


--
-- Name: get_sponsor_downline(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_sponsor_downline(p_user_id uuid) RETURNS TABLE(user_id uuid, sponsor_id uuid, depth integer, name text, star_level integer, activity_status text, ppv integer, profile_image_url text, joined_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    tt.user_id,
    tt.sponsor_id,
    tt.sponsor_depth,
    u.name,
    u.star_level,
    u.activity_status,
    u.ppv,
    u.profile_image_url,
    tt.joined_at
  FROM public.team_tree tt
  JOIN public.users u ON u.id = tt.user_id
  WHERE tt.sponsor_path <@ (
    SELECT t2.sponsor_path FROM public.team_tree t2 WHERE t2.user_id = p_user_id
  )
  AND tt.user_id != p_user_id
  ORDER BY tt.sponsor_depth, tt.joined_at;
END;
$$;


--
-- Name: get_team_size(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_size(p_user_id uuid) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT COUNT(*)::integer
  FROM public.team_tree
  WHERE sponsor_path <@ (
    SELECT sponsor_path FROM public.team_tree WHERE user_id = p_user_id
  )
  AND user_id != p_user_id;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'extensions'
    AS $$
begin
  perform public.ensure_user_profile_for_user(new.id);
  return new;
end;
$$;


--
-- Name: increment_user_credits(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_user_credits(p_user_id uuid, p_amount integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_new_balance integer;
begin
  update public.users
  set credits = coalesce(credits, 0) + p_amount
  where id = p_user_id
  returning credits into v_new_balance;

  return coalesce(v_new_balance, 0);
end;
$$;


--
-- Name: is_current_user_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_current_user_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and coalesce(is_admin, false) = true
  );
$$;


--
-- Name: is_referral_bonus_eligible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_referral_bonus_eligible(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.get_approved_listing_count(p_user_id) >= 5;
$$;


--
-- Name: listing_streak_business_date(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.listing_streak_business_date(p_timestamp timestamp with time zone) RETURNS date
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select (p_timestamp at time zone public.get_listing_streak_timezone())::date;
$$;


--
-- Name: normalize_referral_username(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_referral_username(p_value text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
  v_value TEXT;
BEGIN
  v_value := LOWER(TRIM(COALESCE(p_value, '')));
  v_value := REGEXP_REPLACE(v_value, '[^a-z0-9]+', '_', 'g');
  v_value := REGEXP_REPLACE(v_value, '^_+|_+$', '', 'g');
  v_value := REGEXP_REPLACE(v_value, '_{2,}', '_', 'g');
  RETURN LEFT(v_value, 24);
END;
$_$;


--
-- Name: on_listing_approved(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_listing_approved() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    PERFORM public.award_points(
      NEW.user_id, 'listing_approved', 100, NEW.id, 'property', 'Points for approved listing'
    );

    IF NOT (SELECT first_listing_completed FROM public.users WHERE id = NEW.user_id) THEN
      PERFORM public.award_points(
        NEW.user_id, 'first_listing_bonus', 50, NEW.id, 'property', 'First listing bonus'
      );
      UPDATE public.users SET first_listing_completed = true WHERE id = NEW.user_id;
    END IF;

    PERFORM public.check_quality_bonus(NEW.id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: pin_property_for_24h(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pin_property_for_24h(p_property_id uuid) RETURNS TABLE(success boolean, property_id uuid, pinned_at timestamp with time zone, pinned_until timestamp with time zone, credits_spent integer, remaining_credits integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_property public.properties%rowtype;
  v_current_credits integer;
  v_remaining_credits integer;
  v_pin_cost integer := 50;
  v_pinned_at timestamptz := now();
  v_pinned_until timestamptz := now() + interval '24 hours';
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_property_id is null then
    raise exception 'Property is required.';
  end if;

  select *
  into v_property
  from public.properties
  where id = p_property_id
  for update;

  if not found then
    raise exception 'Property not found.';
  end if;

  if v_property.user_id is distinct from v_user_id then
    raise exception 'You can only pin your own property.';
  end if;

  if v_property.pinned_until is not null and v_property.pinned_until > now() then
    raise exception 'Property is already pinned.';
  end if;

  select credits
  into v_current_credits
  from public.users
  where id = v_user_id
  for update;

  if v_current_credits is null then
    raise exception 'User profile not found.';
  end if;

  if v_current_credits < v_pin_cost then
    raise exception 'You need 50 credits to pin this property.';
  end if;

  update public.users
  set
    credits = v_current_credits - v_pin_cost,
    updated_at = now()
  where id = v_user_id
    and credits >= v_pin_cost
  returning credits into v_remaining_credits;

  if v_remaining_credits is null then
    raise exception 'You need 50 credits to pin this property.';
  end if;

  update public.properties
  set
    is_pinned = true,
    pinned_at = v_pinned_at,
    pinned_until = v_pinned_until,
    updated_at = now()
  where id = p_property_id;

  insert into public.credit_transactions (
    user_id,
    credits_deducted,
    transaction_type,
    property_id,
    created_at,
    credits_amount,
    balance_after,
    reference_type,
    reference_id,
    metadata
  )
  values (
    v_user_id,
    v_pin_cost,
    'property_pin',
    p_property_id,
    now(),
    v_pin_cost,
    v_remaining_credits,
    'property_pin',
    p_property_id,
    jsonb_build_object(
      'property_id', p_property_id,
      'pinned_at', v_pinned_at,
      'pinned_until', v_pinned_until,
      'duration_hours', 24
    )
  );

  return query
  select
    true,
    p_property_id,
    v_pinned_at,
    v_pinned_until,
    v_pin_cost,
    v_remaining_credits;
end;
$$;


--
-- Name: process_referral_bonus_for_invite(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_referral_bonus_for_invite(p_invite_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_inviter_id uuid;
  v_points_awarded integer;
  v_points integer := 150;
  v_usd numeric(12, 6) := round((150::numeric / 3500.0), 6);
begin
  select inviter_id,
         coalesce(points_awarded, 0)
  into v_inviter_id,
       v_points_awarded
  from public.invites
  where id = p_invite_id
    and status = 'completed'
  limit 1;

  if v_inviter_id is null or v_points_awarded > 0 then
    return 0;
  end if;

  if not public.is_referral_bonus_eligible(v_inviter_id) then
    return 0;
  end if;

  insert into public.points_ledger (
    user_id,
    action,
    points,
    usd_value,
    created_at
  )
  values (
    v_inviter_id,
    'referral',
    v_points,
    v_usd,
    timezone('utc', now())
  );

  update public.users
  set
    ppv = coalesce(ppv, 0) + v_points,
    balance_usd = coalesce(balance_usd, 0) + v_usd
  where id = v_inviter_id;

  update public.invites
  set
    points_awarded = v_points,
    points_awarded_at = timezone('utc', now())
  where id = p_invite_id
    and coalesce(points_awarded, 0) = 0;

  return v_points;
end;
$$;


--
-- Name: rebuild_team_tree_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rebuild_team_tree_metrics() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.team_tree tt
  set
    direct_referral_count = coalesce((
      select count(*)
      from public.team_tree child
      where child.sponsor_id = tt.user_id
    ), 0),
    total_team_size = coalesce((
      select count(*)
      from public.team_tree child
      where child.sponsor_path <@ tt.sponsor_path
        and child.user_id <> tt.user_id
    ), 0),
    sponsor_depth = greatest(nlevel(tt.sponsor_path) - 1, 0),
    placement_depth = greatest(nlevel(tt.placement_path) - 1, 0),
    updated_at = now();
$$;


--
-- Name: recalculate_employee_listing_streaks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_employee_listing_streaks(p_user_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_target_user_id uuid;
begin
  if p_user_id is not null then
    delete from public.employee_listing_streak_events
    where user_id = p_user_id;

    insert into public.employee_listing_streak_events (
      property_id,
      user_id,
      source,
      qualified_at,
      activity_date,
      created_at,
      updated_at
    )
    select
      p.id,
      p.user_id,
      'submission',
      coalesce(p.submission_completed_at, p.created_at),
      public.listing_streak_business_date(
        coalesce(p.submission_completed_at, p.created_at)
      ),
      timezone('utc', now()),
      timezone('utc', now())
    from public.properties p
    where p.user_id = p_user_id
      and coalesce(p.submission_completed_at, p.created_at) is not null;

    perform public.refresh_employee_listing_streak_days(p_user_id);
    perform public.refresh_employee_listing_streak_summary(p_user_id);
    return;
  end if;

  truncate table public.employee_listing_streak_events;
  truncate table public.employee_listing_streak_days;
  truncate table public.employee_listing_streaks;

  insert into public.employee_listing_streak_events (
    property_id,
    user_id,
    source,
    qualified_at,
    activity_date,
    created_at,
    updated_at
  )
  select
    p.id,
    p.user_id,
    'submission',
    coalesce(p.submission_completed_at, p.created_at),
    public.listing_streak_business_date(
      coalesce(p.submission_completed_at, p.created_at)
    ),
    timezone('utc', now()),
    timezone('utc', now())
  from public.properties p
  where coalesce(p.submission_completed_at, p.created_at) is not null;

  for v_target_user_id in
    select distinct e.user_id
    from public.employee_listing_streak_events e
  loop
    perform public.refresh_employee_listing_streak_days(v_target_user_id);
    perform public.refresh_employee_listing_streak_summary(v_target_user_id);
  end loop;
end;
$$;


--
-- Name: record_listing_submission_completion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_listing_submission_completion(p_property_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_submission_completed_at timestamptz;
begin
  update public.properties
  set submission_completed_at = coalesce(
    submission_completed_at,
    timezone('utc', now())
  )
  where id = p_property_id
    and (
      user_id = auth.uid()
      or (select public.is_current_user_admin())
    )
  returning user_id, submission_completed_at
  into v_user_id, v_submission_completed_at;

  if v_user_id is null then
    raise exception 'Listing submission could not be recorded for property %', p_property_id;
  end if;

  insert into public.employee_listing_streak_events (
    property_id,
    user_id,
    source,
    qualified_at,
    activity_date,
    created_at,
    updated_at
  )
  values (
    p_property_id,
    v_user_id,
    'submission',
    v_submission_completed_at,
    public.listing_streak_business_date(v_submission_completed_at),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (property_id) do nothing;

  perform public.refresh_employee_listing_streak_days(v_user_id);
  perform public.refresh_employee_listing_streak_summary(v_user_id);
end;
$$;


--
-- Name: record_property_view(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_property_view(p_property_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_property_id is null then
    return;
  end if;

  insert into public.property_view_history (
    user_id,
    property_id,
    view_count,
    first_viewed_at,
    last_viewed_at,
    updated_at
  )
  values (
    v_user_id,
    p_property_id,
    1,
    now(),
    now(),
    now()
  )
  on conflict (user_id, property_id)
  do update set
    view_count = public.property_view_history.view_count + 1,
    last_viewed_at = now(),
    updated_at = now();
end;
$$;


--
-- Name: refresh_employee_listing_streak_days(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_employee_listing_streak_days(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.employee_listing_streak_days (
    user_id,
    activity_date,
    source,
    first_qualified_at,
    last_qualified_at,
    qualifying_listing_count,
    created_at,
    updated_at
  )
  select
    e.user_id,
    e.activity_date,
    min(e.source) as source,
    min(e.qualified_at) as first_qualified_at,
    max(e.qualified_at) as last_qualified_at,
    count(*)::integer as qualifying_listing_count,
    timezone('utc', now()),
    timezone('utc', now())
  from public.employee_listing_streak_events e
  where e.user_id = p_user_id
  group by e.user_id, e.activity_date
  on conflict (user_id, activity_date) do update
  set
    source = excluded.source,
    first_qualified_at = excluded.first_qualified_at,
    last_qualified_at = excluded.last_qualified_at,
    qualifying_listing_count = excluded.qualifying_listing_count,
    updated_at = timezone('utc', now());

  delete from public.employee_listing_streak_days d
  where d.user_id = p_user_id
    and not exists (
      select 1
      from public.employee_listing_streak_events e
      where e.user_id = d.user_id
        and e.activity_date = d.activity_date
    );
end;
$$;


--
-- Name: refresh_employee_listing_streak_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_employee_listing_streak_summary(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_today date := timezone(public.get_listing_streak_timezone(), now())::date;
  v_last_qualified_date date;
  v_current_streak integer := 0;
  v_longest_streak integer := 0;
begin
  select max(activity_date)
  into v_last_qualified_date
  from public.employee_listing_streak_days
  where user_id = p_user_id;

  select coalesce(max(streak_length), 0)
  into v_longest_streak
  from (
    select count(*)::integer as streak_length
    from (
      select
        activity_date,
        activity_date - (row_number() over (order by activity_date asc))::integer
          as streak_group
      from public.employee_listing_streak_days
      where user_id = p_user_id
    ) grouped_days
    group by streak_group
  ) streak_lengths;

  if v_last_qualified_date is not null
     and v_last_qualified_date >= (v_today - 1) then
    select count(*)::integer
    into v_current_streak
    from (
      select
        activity_date,
        row_number() over (order by activity_date desc) as streak_position
      from public.employee_listing_streak_days
      where user_id = p_user_id
        and activity_date <= v_last_qualified_date
      order by activity_date desc
    ) ordered_days
    where (v_last_qualified_date - activity_date) = (streak_position - 1);
  else
    v_current_streak := 0;
  end if;

  insert into public.employee_listing_streaks (
    user_id,
    current_streak,
    longest_streak,
    last_qualified_date,
    updated_at
  )
  values (
    p_user_id,
    coalesce(v_current_streak, 0),
    coalesce(v_longest_streak, 0),
    v_last_qualified_date,
    timezone('utc', now())
  )
  on conflict (user_id) do update
  set
    current_streak = excluded.current_streak,
    longest_streak = excluded.longest_streak,
    last_qualified_date = excluded.last_qualified_date,
    updated_at = timezone('utc', now());
end;
$$;


--
-- Name: resolve_listing_points_for_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_listing_points_for_role(p_role text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (
      select lr.points_per_listing
      from public.listing_roles lr
      where lr.role_key = lower(coalesce(p_role, ''))
        and lr.is_active = true
      limit 1
    ),
    (
      select lr.points_per_listing
      from public.listing_roles lr
      where lr.role_key = 'agent'
        and lr.is_active = true
      limit 1
    ),
    100
  );
$$;


--
-- Name: resolve_referral_user_id(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_referral_user_id(p_referral_input text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_input TEXT;
  v_username TEXT;
  v_user_id UUID;
BEGIN
  v_input := TRIM(COALESCE(p_referral_input, ''));

  IF v_input = '' THEN
    RETURN NULL;
  END IF;

  v_username := public.normalize_referral_username(v_input);

  IF v_username <> '' THEN
    SELECT id
    INTO v_user_id
    FROM public.users
    WHERE referral_username = v_username
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT id
    INTO v_user_id
    FROM public.users
    WHERE referral_code = UPPER(v_input)
    LIMIT 1;
  END IF;

  RETURN v_user_id;
END;
$$;


--
-- Name: resolve_signup_sponsor_id(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_signup_sponsor_id(p_referral_code text, p_legacy_sponsor_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_code text := upper(trim(coalesce(p_referral_code, '')));
  v_sponsor_id uuid;
begin
  if v_code <> '' then
    select u.id
    into v_sponsor_id
    from public.users u
    where upper(coalesce(u.referral_code, '')) = v_code
      and coalesce(u.is_active, true) = true
    limit 1;

    if v_sponsor_id is null then
      raise exception 'Invalid referral code';
    end if;

    return v_sponsor_id;
  end if;

  if p_legacy_sponsor_id is not null
     and exists (
       select 1
       from public.users u
       where u.id = p_legacy_sponsor_id
         and coalesce(u.is_active, true) = true
     ) then
    return p_legacy_sponsor_id;
  end if;

  return public.get_root_sponsor_user_id();
end;
$$;


--
-- Name: set_credit_topups_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_credit_topups_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_employee_listing_streak_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_employee_listing_streak_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_listing_roles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_listing_roles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


--
-- Name: set_referral_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_referral_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: unlock_property_contact(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unlock_property_contact(p_property_id uuid) RETURNS TABLE(success boolean, already_unlocked boolean, credits_spent integer, remaining_credits integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_existing_contact_view public.contact_views;
  v_current_credits integer;
  v_unlock_cost integer := 20;
  v_remaining_credits integer;
  v_new_contact_view public.contact_views;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_property_id is null then
    raise exception 'Property is required.';
  end if;

  perform 1
  from public.properties
  where id = p_property_id;

  if not found then
    raise exception 'Property not found.';
  end if;

  select credits
  into v_current_credits
  from public.users
  where id = v_user_id
  for update;

  if v_current_credits is null then
    raise exception 'User profile not found.';
  end if;

  select *
  into v_existing_contact_view
  from public.contact_views
  where user_id = v_user_id
    and property_id = p_property_id
  limit 1;

  if found then
    return query
    select
      true,
      true,
      coalesce(v_existing_contact_view.credits_spent, 0),
      v_current_credits;
    return;
  end if;

  select greatest(coalesce(property_listing, contact_view, photo_view, 20), 0)
  into v_unlock_cost
  from public.credit_settings
  where id = true;

  v_unlock_cost := greatest(coalesce(v_unlock_cost, 20), 0);

  if v_current_credits < v_unlock_cost then
    raise exception 'Insufficient credits';
  end if;

  update public.users
  set
    credits = v_current_credits - v_unlock_cost,
    updated_at = now()
  where id = v_user_id
  returning credits into v_remaining_credits;

  insert into public.contact_views (
    user_id,
    property_id,
    credits_spent,
    viewed_at
  )
  values (
    v_user_id,
    p_property_id,
    v_unlock_cost,
    now()
  )
  returning *
  into v_new_contact_view;

  insert into public.credit_transactions (
    user_id,
    credits_deducted,
    transaction_type,
    property_id,
    created_at,
    balance_after,
    reference_type,
    reference_id,
    metadata
  )
  values (
    v_user_id,
    v_unlock_cost,
    'contact_view',
    p_property_id,
    now(),
    v_remaining_credits,
    'contact_view',
    v_new_contact_view.id,
    jsonb_build_object(
      'contact_view_id', v_new_contact_view.id,
      'property_id', p_property_id
    )
  )
  on conflict do nothing;

  return query
  select
    true,
    false,
    v_unlock_cost,
    v_remaining_credits;
end;
$$;


--
-- Name: upsert_team_tree_entry(uuid, uuid, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_team_tree_entry(p_user_id uuid, p_sponsor_id uuid, p_placement_parent_id uuid, p_joined_at timestamp with time zone DEFAULT now()) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_label text := replace(p_user_id::text, '-', '_');
  v_sponsor_path ltree;
  v_placement_path ltree;
begin
  if p_sponsor_id is null then
    v_sponsor_path := v_user_label::ltree;
  else
    select tt.sponsor_path
    into v_sponsor_path
    from public.team_tree tt
    where tt.user_id = p_sponsor_id;

    if v_sponsor_path is null then
      raise exception 'Sponsor tree entry missing for %', p_sponsor_id;
    end if;

    v_sponsor_path := v_sponsor_path || v_user_label::ltree;
  end if;

  if p_placement_parent_id is null then
    v_placement_path := v_sponsor_path;
  else
    select tt.placement_path
    into v_placement_path
    from public.team_tree tt
    where tt.user_id = p_placement_parent_id;

    if v_placement_path is null then
      raise exception 'Placement parent tree entry missing for %', p_placement_parent_id;
    end if;

    v_placement_path := v_placement_path || v_user_label::ltree;
  end if;

  insert into public.team_tree (
    user_id,
    sponsor_id,
    placement_parent_id,
    sponsor_path,
    placement_path,
    sponsor_depth,
    placement_depth,
    joined_at,
    updated_at
  )
  values (
    p_user_id,
    p_sponsor_id,
    p_placement_parent_id,
    v_sponsor_path,
    v_placement_path,
    greatest(nlevel(v_sponsor_path) - 1, 0),
    greatest(nlevel(v_placement_path) - 1, 0),
    coalesce(p_joined_at, now()),
    now()
  )
  on conflict (user_id) do update
  set
    sponsor_id = excluded.sponsor_id,
    placement_parent_id = excluded.placement_parent_id,
    sponsor_path = excluded.sponsor_path,
    placement_path = excluded.placement_path,
    sponsor_depth = excluded.sponsor_depth,
    placement_depth = excluded.placement_depth,
    joined_at = coalesce(public.team_tree.joined_at, excluded.joined_at),
    updated_at = now();
end;
$$;


--
-- Name: uuid_to_ltree_label(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.uuid_to_ltree_label(uid uuid) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT replace(uid::text, '-', '_');
$$;


--
-- Name: bonuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bonuses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    amount_usd numeric(10,2) DEFAULT 0.00 NOT NULL,
    amount_bdt numeric(12,2),
    exchange_rate numeric(8,2),
    period text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    status text DEFAULT 'calculated'::text NOT NULL,
    payout_method text,
    payout_reference text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_views (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    property_id uuid NOT NULL,
    credits_spent integer DEFAULT 0 NOT NULL,
    viewed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cover_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cover_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    image_url text NOT NULL,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_packages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    package_name text NOT NULL,
    credits_amount integer NOT NULL,
    price_bdt integer NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    discount_percentage integer DEFAULT 0 NOT NULL,
    is_popular boolean DEFAULT false NOT NULL
);


--
-- Name: credit_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_settings (
    id boolean DEFAULT true NOT NULL,
    property_listing integer DEFAULT 20 NOT NULL,
    contact_view integer DEFAULT 10 NOT NULL,
    photo_view integer DEFAULT 10 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT credit_settings_id_check CHECK (id)
);


--
-- Name: credit_topups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_topups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text DEFAULT 'uddoktapay'::text NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    amount_bdt integer NOT NULL,
    credits_to_add integer NOT NULL,
    invoice_id text,
    transaction_id text,
    payment_method text,
    checkout_url text,
    redirect_url text,
    cancel_url text,
    webhook_url text,
    provider_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    verified_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    credited_at timestamp with time zone,
    refunded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT credit_topups_amount_bdt_check CHECK ((amount_bdt > 0)),
    CONSTRAINT credit_topups_credits_to_add_check CHECK ((credits_to_add > 0)),
    CONSTRAINT credit_topups_status_check CHECK ((status = ANY (ARRAY['created'::text, 'pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text])))
);


--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    credits_deducted integer,
    transaction_type text,
    property_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    credits_amount integer,
    balance_after integer,
    reference_type text,
    reference_id uuid,
    provider text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    payment_transaction_id text
);


--
-- Name: customer_search_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_search_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    search_query text,
    selected_location jsonb,
    selected_category text,
    selected_price_range text,
    result_count integer DEFAULT 0,
    page_path text DEFAULT '/propertylist2'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT customer_search_history_result_count_check CHECK ((result_count >= 0))
);


--
-- Name: employee_listing_streak_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_listing_streak_days (
    user_id uuid NOT NULL,
    activity_date date NOT NULL,
    source text DEFAULT 'submission'::text NOT NULL,
    first_qualified_at timestamp with time zone NOT NULL,
    last_qualified_at timestamp with time zone NOT NULL,
    qualifying_listing_count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT employee_listing_streak_days_qualifying_listing_count_check CHECK ((qualifying_listing_count >= 1)),
    CONSTRAINT employee_listing_streak_days_source_nonempty CHECK ((length(TRIM(BOTH FROM source)) > 0))
);


--
-- Name: employee_listing_streak_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_listing_streak_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    user_id uuid NOT NULL,
    source text DEFAULT 'submission'::text NOT NULL,
    qualified_at timestamp with time zone NOT NULL,
    activity_date date NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT employee_listing_streak_events_source_nonempty CHECK ((length(TRIM(BOTH FROM source)) > 0))
);


--
-- Name: employee_listing_streak_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_listing_streak_settings (
    id boolean DEFAULT true NOT NULL,
    timezone_name text DEFAULT 'Asia/Dhaka'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT employee_listing_streak_settings_id_check CHECK (id),
    CONSTRAINT employee_listing_streak_settings_timezone_name_nonempty CHECK ((length(TRIM(BOTH FROM timezone_name)) > 0))
);


--
-- Name: employee_listing_streaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_listing_streaks (
    user_id uuid NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    last_qualified_date date,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT employee_listing_streaks_current_streak_check CHECK ((current_streak >= 0)),
    CONSTRAINT employee_listing_streaks_longest_streak_check CHECK ((longest_streak >= 0))
);


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    usd_to_bdt numeric(8,2) NOT NULL,
    set_by uuid,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    property_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    feedback text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid
);


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    inviter_id uuid NOT NULL,
    invited_phone text,
    invited_email text,
    invited_user_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    points_awarded integer DEFAULT 0 NOT NULL,
    registered_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    points_awarded_at timestamp with time zone
);


--
-- Name: job_participations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_participations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    property_id uuid,
    specific_address text NOT NULL,
    contact_details text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: listing_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_key text NOT NULL,
    display_name text NOT NULL,
    points_per_listing integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT listing_roles_points_per_listing_check CHECK ((points_per_listing >= 0)),
    CONSTRAINT listing_roles_role_key_format CHECK ((role_key ~ '^[a-z0-9_]+$'::text))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    property_id uuid,
    content text,
    message_type text DEFAULT 'text'::text NOT NULL,
    media_url text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    division character varying(100) NOT NULL,
    district character varying(100) NOT NULL,
    area character varying(255) NOT NULL,
    sub_area character varying(255),
    category character varying(100) NOT NULL,
    rooms integer NOT NULL,
    property_need_from date,
    max_budget integer,
    additional_preferences text,
    package character varying(50) DEFAULT '7_days'::character varying,
    cost integer DEFAULT 1000,
    status character varying(50) DEFAULT 'pending_payment'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_job_feed_posted boolean DEFAULT false,
    job_feed_posted_at timestamp with time zone,
    job_feed_title text,
    job_feed_description text
);


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    order_id uuid,
    package_id uuid,
    transaction_id text NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text,
    payment_method text,
    description text,
    credits_to_add integer DEFAULT 0,
    provider text,
    invoice_id text,
    customer_phone text,
    sender_number text,
    gateway_payload jsonb DEFAULT '{}'::jsonb,
    reference text,
    approved_at timestamp with time zone,
    approved_by uuid,
    credited_at timestamp with time zone,
    credited_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: photo_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.photo_views (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    property_id uuid,
    credits_spent integer,
    viewed_at timestamp without time zone DEFAULT now()
);


--
-- Name: points_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.points_ledger (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    points integer NOT NULL,
    usd_value numeric(10,2) DEFAULT 0.00 NOT NULL,
    reference_id uuid,
    reference_type text,
    description text,
    period_start date,
    period_end date,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    category text NOT NULL,
    property_type text NOT NULL,
    total_rooms integer,
    total_bathrooms integer,
    balcony integer,
    floor_level text,
    occupancy text,
    room_size_sqft integer,
    rent_amount_bdt integer,
    rent_period text NOT NULL,
    state_district text NOT NULL,
    area text NOT NULL,
    contact_number text NOT NULL,
    short_description text,
    sector text,
    road text,
    house_plot text,
    lat numeric(10,8),
    lng numeric(11,8),
    available_from date,
    deadline date,
    status text DEFAULT 'pending'::text,
    views integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    is_featured boolean DEFAULT false,
    sub_area text,
    total_kitchen integer DEFAULT 0,
    listing_points_awarded integer DEFAULT 0 NOT NULL,
    listing_points_awarded_at timestamp with time zone,
    property_id_number text NOT NULL,
    dining_rooms integer DEFAULT 0,
    living_rooms integer DEFAULT 0,
    is_rent_negotiable boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true,
    deactivated_at timestamp with time zone,
    is_pinned boolean DEFAULT false,
    pinned_at timestamp with time zone,
    submission_completed_at timestamp with time zone,
    pinned_until timestamp with time zone,
    CONSTRAINT properties_negotiable_or_priced_chk CHECK ((is_rent_negotiable OR (rent_amount_bdt IS NOT NULL))),
    CONSTRAINT properties_rent_amount_positive_chk CHECK (((rent_amount_bdt IS NULL) OR (rent_amount_bdt > 0)))
);


--
-- Name: COLUMN properties.property_id_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.properties.property_id_number IS 'Public display ID. Sequential number from 100000, assigned by trg_properties_assign_property_id_number. Never set by clients.';


--
-- Name: property_amenities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_amenities (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    property_id uuid,
    amenity_type text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: property_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    property_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: property_id_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.property_id_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: property_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_images (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    property_id uuid,
    image_url text NOT NULL,
    is_thumbnail boolean DEFAULT false,
    display_order integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: property_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50) NOT NULL,
    message text NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: property_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_reports (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    property_id uuid,
    user_id uuid,
    reason character varying NOT NULL,
    message text,
    status character varying DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: property_view_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_view_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    property_id uuid NOT NULL,
    view_count integer DEFAULT 1 NOT NULL,
    first_viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    last_viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: public_property_catalog; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_property_catalog WITH (security_invoker='true') AS
 SELECT id,
    property_id_number,
    category,
    property_type,
    total_rooms,
    total_bathrooms,
    balcony,
    floor_level,
    occupancy,
    room_size_sqft,
    rent_amount_bdt,
    rent_period,
    state_district,
    area,
    sub_area,
    short_description,
    available_from,
    deadline,
    status,
    created_at,
    updated_at,
    reviewed_at,
    is_featured,
    is_active,
    is_pinned,
    total_kitchen,
    dining_rooms,
    living_rooms,
    is_rent_negotiable,
    lat,
    lng
   FROM public.properties p
  WHERE ((status = 'approved'::text) AND (COALESCE(is_active, true) = true));


--
-- Name: referral_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_earnings (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    referrer_user_id uuid NOT NULL,
    referred_user_id uuid NOT NULL,
    credit_topup_id uuid,
    payment_transaction_id text NOT NULL,
    purchase_amount_bdt numeric(10,2) DEFAULT 0 NOT NULL,
    commission_amount numeric(10,2) DEFAULT 0 NOT NULL,
    commission_mode text DEFAULT 'percentage'::text NOT NULL,
    commission_value numeric(10,2) DEFAULT 0 NOT NULL,
    bonus_percent numeric(10,2) DEFAULT 0 NOT NULL,
    bonus_credits_awarded integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: referral_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_settings (
    id boolean DEFAULT true NOT NULL,
    root_sponsor_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referral_settings_id_check CHECK (id)
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text,
    setting_value text,
    auto_approve_properties boolean DEFAULT false,
    property_listing integer DEFAULT 20,
    contact_view integer DEFAULT 10,
    photo_view integer DEFAULT 10,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    referral_enabled boolean DEFAULT true,
    referral_commission_type text DEFAULT 'percentage'::text,
    referral_commission_value numeric(10,2) DEFAULT 20,
    referral_bonus_percent numeric(10,2) DEFAULT 20,
    referral_bonus_frequency text DEFAULT 'every_purchase'::text,
    min_withdrawal_amount numeric(10,2) DEFAULT 100,
    site_theme text DEFAULT 'light'::text
);


--
-- Name: storage_config_note; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storage_config_note (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    bucket_name text NOT NULL,
    rls_status text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: storage_policies_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storage_policies_config (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    bucket_name text NOT NULL,
    policy_instructions text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: team_tree; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_tree (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    sponsor_id uuid,
    placement_parent_id uuid,
    sponsor_path public.ltree DEFAULT ''::public.ltree NOT NULL,
    placement_path public.ltree DEFAULT ''::public.ltree NOT NULL,
    sponsor_depth integer DEFAULT 0 NOT NULL,
    placement_depth integer DEFAULT 0 NOT NULL,
    direct_referral_count integer DEFAULT 0 NOT NULL,
    total_team_size integer DEFAULT 0 NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_blacklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_blacklist (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    reason text NOT NULL,
    blacklisted_at timestamp with time zone DEFAULT now(),
    blacklisted_by uuid,
    notes text,
    is_permanent boolean DEFAULT true,
    expires_at timestamp with time zone
);


--
-- Name: user_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_orders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    property_id uuid,
    status text DEFAULT 'pending'::text,
    inquiry_message text,
    contact_attempted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_verifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    id_type text NOT NULL,
    front_image_url text NOT NULL,
    back_image_url text NOT NULL,
    verification_status text DEFAULT 'pending'::text,
    admin_notes text,
    submitted_at timestamp without time zone DEFAULT now(),
    reviewed_at timestamp without time zone
);


--
-- Name: user_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_wallets (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    banking_type text NOT NULL,
    bank_name text NOT NULL,
    account_number text NOT NULL,
    account_name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email text,
    phone text,
    name text,
    credits integer DEFAULT 0,
    verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_admin boolean DEFAULT false,
    is_active boolean DEFAULT true,
    role text DEFAULT 'tenant'::text NOT NULL,
    sponsor_id uuid,
    placement_parent_id uuid,
    referral_code text,
    star_level integer DEFAULT 0 NOT NULL,
    ppv integer DEFAULT 0 NOT NULL,
    balance_usd numeric(12,2) DEFAULT 0.00 NOT NULL,
    activity_status text DEFAULT 'active'::text NOT NULL,
    profile_image_url text,
    division text,
    district text,
    bkash_number text,
    nagad_number text,
    last_active_at timestamp with time zone DEFAULT now(),
    first_listing_completed boolean DEFAULT false NOT NULL,
    placement_locked_at timestamp with time zone,
    referral_username text,
    referred_by uuid,
    full_name text,
    avatar_url text,
    google_id text,
    provider text DEFAULT 'email'::text
);


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    amount_usd numeric(10,2) NOT NULL,
    amount_bdt numeric(12,2) NOT NULL,
    exchange_rate numeric(8,2) NOT NULL,
    method text NOT NULL,
    account_number text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bonuses bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonuses
    ADD CONSTRAINT bonuses_pkey PRIMARY KEY (id);


--
-- Name: contact_views contact_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_views
    ADD CONSTRAINT contact_views_pkey PRIMARY KEY (id);


--
-- Name: cover_photos cover_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cover_photos
    ADD CONSTRAINT cover_photos_pkey PRIMARY KEY (id);


--
-- Name: credit_packages credit_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_packages
    ADD CONSTRAINT credit_packages_pkey PRIMARY KEY (id);


--
-- Name: credit_settings credit_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_settings
    ADD CONSTRAINT credit_settings_pkey PRIMARY KEY (id);


--
-- Name: credit_topups credit_topups_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topups
    ADD CONSTRAINT credit_topups_invoice_id_key UNIQUE (invoice_id);


--
-- Name: credit_topups credit_topups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topups
    ADD CONSTRAINT credit_topups_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: customer_search_history customer_search_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_search_history
    ADD CONSTRAINT customer_search_history_pkey PRIMARY KEY (id);


--
-- Name: employee_listing_streak_days employee_listing_streak_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_listing_streak_days
    ADD CONSTRAINT employee_listing_streak_days_pkey PRIMARY KEY (user_id, activity_date);


--
-- Name: employee_listing_streak_events employee_listing_streak_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_listing_streak_events
    ADD CONSTRAINT employee_listing_streak_events_pkey PRIMARY KEY (id);


--
-- Name: employee_listing_streak_events employee_listing_streak_events_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_listing_streak_events
    ADD CONSTRAINT employee_listing_streak_events_property_id_key UNIQUE (property_id);


--
-- Name: employee_listing_streak_settings employee_listing_streak_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_listing_streak_settings
    ADD CONSTRAINT employee_listing_streak_settings_pkey PRIMARY KEY (id);


--
-- Name: employee_listing_streaks employee_listing_streaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_listing_streaks
    ADD CONSTRAINT employee_listing_streaks_pkey PRIMARY KEY (user_id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_user_id_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_property_id_key UNIQUE (user_id, property_id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: job_participations job_participations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_participations
    ADD CONSTRAINT job_participations_pkey PRIMARY KEY (id);


--
-- Name: listing_roles listing_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_roles
    ADD CONSTRAINT listing_roles_pkey PRIMARY KEY (id);


--
-- Name: listing_roles listing_roles_role_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_roles
    ADD CONSTRAINT listing_roles_role_key_key UNIQUE (role_key);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_transaction_id_key UNIQUE (transaction_id);


--
-- Name: photo_views photo_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photo_views
    ADD CONSTRAINT photo_views_pkey PRIMARY KEY (id);


--
-- Name: points_ledger points_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_ledger
    ADD CONSTRAINT points_ledger_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: property_amenities property_amenities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_amenities
    ADD CONSTRAINT property_amenities_pkey PRIMARY KEY (id);


--
-- Name: property_favorites property_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_favorites
    ADD CONSTRAINT property_favorites_pkey PRIMARY KEY (id);


--
-- Name: property_favorites property_favorites_user_id_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_favorites
    ADD CONSTRAINT property_favorites_user_id_property_id_key UNIQUE (user_id, property_id);


--
-- Name: property_images property_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_pkey PRIMARY KEY (id);


--
-- Name: property_inquiries property_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_inquiries
    ADD CONSTRAINT property_inquiries_pkey PRIMARY KEY (id);


--
-- Name: property_reports property_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_reports
    ADD CONSTRAINT property_reports_pkey PRIMARY KEY (id);


--
-- Name: property_view_history property_view_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_view_history
    ADD CONSTRAINT property_view_history_pkey PRIMARY KEY (id);


--
-- Name: property_view_history property_view_history_user_id_property_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_view_history
    ADD CONSTRAINT property_view_history_user_id_property_id_key UNIQUE (user_id, property_id);


--
-- Name: referral_earnings referral_earnings_payment_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_earnings
    ADD CONSTRAINT referral_earnings_payment_transaction_id_key UNIQUE (payment_transaction_id);


--
-- Name: referral_earnings referral_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_earnings
    ADD CONSTRAINT referral_earnings_pkey PRIMARY KEY (id);


--
-- Name: referral_settings referral_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_settings
    ADD CONSTRAINT referral_settings_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: storage_config_note storage_config_note_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_config_note
    ADD CONSTRAINT storage_config_note_pkey PRIMARY KEY (id);


--
-- Name: storage_policies_config storage_policies_config_bucket_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_policies_config
    ADD CONSTRAINT storage_policies_config_bucket_name_key UNIQUE (bucket_name);


--
-- Name: storage_policies_config storage_policies_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_policies_config
    ADD CONSTRAINT storage_policies_config_pkey PRIMARY KEY (id);


--
-- Name: team_tree team_tree_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tree
    ADD CONSTRAINT team_tree_pkey PRIMARY KEY (id);


--
-- Name: team_tree team_tree_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tree
    ADD CONSTRAINT team_tree_user_id_key UNIQUE (user_id);


--
-- Name: user_blacklist user_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blacklist
    ADD CONSTRAINT user_blacklist_pkey PRIMARY KEY (id);


--
-- Name: user_orders user_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_orders
    ADD CONSTRAINT user_orders_pkey PRIMARY KEY (id);


--
-- Name: user_verifications user_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_verifications
    ADD CONSTRAINT user_verifications_pkey PRIMARY KEY (id);


--
-- Name: user_verifications user_verifications_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_verifications
    ADD CONSTRAINT user_verifications_user_id_key UNIQUE (user_id);


--
-- Name: user_wallets user_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_wallets
    ADD CONSTRAINT user_wallets_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions_reference_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX credit_transactions_reference_unique_idx ON public.credit_transactions USING btree (reference_type, reference_id) WHERE ((reference_type IS NOT NULL) AND (reference_id IS NOT NULL));


--
-- Name: idx_bonuses_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonuses_period ON public.bonuses USING btree (period_start, period_end);


--
-- Name: idx_bonuses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonuses_status ON public.bonuses USING btree (status);


--
-- Name: idx_bonuses_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonuses_type ON public.bonuses USING btree (type);


--
-- Name: idx_bonuses_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonuses_user_id ON public.bonuses USING btree (user_id);


--
-- Name: idx_contact_views_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_views_property_id ON public.contact_views USING btree (property_id);


--
-- Name: idx_contact_views_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_views_user_id ON public.contact_views USING btree (user_id);


--
-- Name: idx_contact_views_user_property_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contact_views_user_property_unique ON public.contact_views USING btree (user_id, property_id);


--
-- Name: idx_contact_views_user_viewed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_views_user_viewed_at ON public.contact_views USING btree (user_id, viewed_at DESC);


--
-- Name: idx_cover_photos_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_photos_active ON public.cover_photos USING btree (is_active);


--
-- Name: idx_cover_photos_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_photos_order ON public.cover_photos USING btree (order_index);


--
-- Name: idx_credit_topups_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_topups_status ON public.credit_topups USING btree (status);


--
-- Name: idx_credit_topups_user_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_topups_user_created_at ON public.credit_topups USING btree (user_id, created_at DESC);


--
-- Name: idx_credit_transactions_payment_txn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_payment_txn ON public.credit_transactions USING btree (payment_transaction_id);


--
-- Name: idx_credit_transactions_reference_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_credit_transactions_reference_unique ON public.credit_transactions USING btree (reference_type, reference_id, transaction_type) WHERE ((reference_type IS NOT NULL) AND (reference_id IS NOT NULL));


--
-- Name: idx_credit_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions USING btree (user_id);


--
-- Name: idx_customer_search_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_search_history_created_at ON public.customer_search_history USING btree (created_at DESC);


--
-- Name: idx_customer_search_history_search_query; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_search_history_search_query ON public.customer_search_history USING btree (search_query);


--
-- Name: idx_customer_search_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_search_history_user_id ON public.customer_search_history USING btree (user_id);


--
-- Name: idx_employee_listing_streak_events_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_listing_streak_events_user_date ON public.employee_listing_streak_events USING btree (user_id, activity_date DESC);


--
-- Name: idx_exchange_rates_effective; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_rates_effective ON public.exchange_rates USING btree (effective_from DESC);


--
-- Name: idx_favorites_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_user ON public.favorites USING btree (user_id);


--
-- Name: idx_invites_invited_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_invited_user ON public.invites USING btree (invited_user_id);


--
-- Name: idx_invites_inviter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_inviter ON public.invites USING btree (inviter_id);


--
-- Name: idx_invites_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invites_status ON public.invites USING btree (status);


--
-- Name: idx_job_participations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_participations_user_id ON public.job_participations USING btree (user_id, created_at DESC);


--
-- Name: idx_listing_roles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_listing_roles_active ON public.listing_roles USING btree (is_active);


--
-- Name: idx_listing_roles_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_listing_roles_role_key ON public.listing_roles USING btree (role_key);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_property ON public.messages USING btree (property_id);


--
-- Name: idx_messages_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_receiver ON public.messages USING btree (receiver_id);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);


--
-- Name: idx_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_unread ON public.messages USING btree (receiver_id, is_read) WHERE (is_read = false);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_job_feed_posted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_job_feed_posted ON public.orders USING btree (is_job_feed_posted, job_feed_posted_at DESC);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);


--
-- Name: idx_payment_transactions_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_invoice_id ON public.payment_transactions USING btree (invoice_id);


--
-- Name: idx_payment_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_status ON public.payment_transactions USING btree (status);


--
-- Name: idx_payment_transactions_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_transaction_id ON public.payment_transactions USING btree (transaction_id);


--
-- Name: idx_payment_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_user_id ON public.payment_transactions USING btree (user_id);


--
-- Name: idx_points_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_points_action ON public.points_ledger USING btree (action);


--
-- Name: idx_points_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_points_created_at ON public.points_ledger USING btree (created_at DESC);


--
-- Name: idx_points_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_points_period ON public.points_ledger USING btree (user_id, period_start, period_end);


--
-- Name: idx_points_user_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_points_user_action ON public.points_ledger USING btree (user_id, action);


--
-- Name: idx_points_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_points_user_id ON public.points_ledger USING btree (user_id);


--
-- Name: idx_properties_active_pin_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_active_pin_sort ON public.properties USING btree (pinned_until DESC, created_at DESC) WHERE (pinned_until IS NOT NULL);


--
-- Name: idx_properties_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_category ON public.properties USING btree (category);


--
-- Name: idx_properties_is_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_is_featured ON public.properties USING btree (is_featured);


--
-- Name: idx_properties_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_status ON public.properties USING btree (status);


--
-- Name: idx_properties_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_properties_user_id ON public.properties USING btree (user_id);


--
-- Name: idx_property_amenities_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_amenities_property_id ON public.property_amenities USING btree (property_id);


--
-- Name: idx_property_favorites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_favorites_user_id ON public.property_favorites USING btree (user_id, created_at DESC);


--
-- Name: idx_property_images_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_images_property_id ON public.property_images USING btree (property_id);


--
-- Name: idx_property_inquiries_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_inquiries_created_at ON public.property_inquiries USING btree (created_at DESC);


--
-- Name: idx_property_inquiries_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_inquiries_property_id ON public.property_inquiries USING btree (property_id);


--
-- Name: idx_property_inquiries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_inquiries_status ON public.property_inquiries USING btree (status);


--
-- Name: idx_property_reports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_reports_created_at ON public.property_reports USING btree (created_at DESC);


--
-- Name: idx_property_reports_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_reports_property_id ON public.property_reports USING btree (property_id);


--
-- Name: idx_property_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_reports_status ON public.property_reports USING btree (status);


--
-- Name: idx_property_view_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_view_history_user_id ON public.property_view_history USING btree (user_id, last_viewed_at DESC);


--
-- Name: idx_referral_earnings_referred_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_earnings_referred_user ON public.referral_earnings USING btree (referred_user_id, created_at DESC);


--
-- Name: idx_referral_earnings_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_earnings_referrer ON public.referral_earnings USING btree (referrer_user_id, created_at DESC);


--
-- Name: idx_site_settings_setting_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_site_settings_setting_key ON public.site_settings USING btree (setting_key) WHERE (setting_key IS NOT NULL);


--
-- Name: idx_team_tree_placement_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tree_placement_parent_id ON public.team_tree USING btree (placement_parent_id);


--
-- Name: idx_team_tree_placement_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tree_placement_path ON public.team_tree USING gist (placement_path);


--
-- Name: idx_team_tree_sponsor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tree_sponsor_id ON public.team_tree USING btree (sponsor_id);


--
-- Name: idx_team_tree_sponsor_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tree_sponsor_path ON public.team_tree USING gist (sponsor_path);


--
-- Name: idx_team_tree_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tree_user_id ON public.team_tree USING btree (user_id);


--
-- Name: idx_user_blacklist_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_blacklist_user_id ON public.user_blacklist USING btree (user_id);


--
-- Name: idx_user_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_orders_user_id ON public.user_orders USING btree (user_id);


--
-- Name: idx_user_wallets_single_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_wallets_single_default ON public.user_wallets USING btree (user_id) WHERE (is_default = true);


--
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_google_id ON public.users USING btree (google_id) WHERE (google_id IS NOT NULL);


--
-- Name: idx_users_is_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_admin ON public.users USING btree (is_admin);


--
-- Name: idx_users_placement_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_placement_parent_id ON public.users USING btree (placement_parent_id);


--
-- Name: idx_users_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);


--
-- Name: idx_users_referral_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_referral_code_unique ON public.users USING btree (referral_code) WHERE (referral_code IS NOT NULL);


--
-- Name: idx_users_referral_username_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_referral_username_unique ON public.users USING btree (referral_username) WHERE (referral_username IS NOT NULL);


--
-- Name: idx_users_referred_by_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_referred_by_lookup ON public.users USING btree (referred_by);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_sponsor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_sponsor_id ON public.users USING btree (sponsor_id);


--
-- Name: idx_users_star_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_star_level ON public.users USING btree (star_level);


--
-- Name: idx_withdrawal_requests_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_user ON public.withdrawal_requests USING btree (user_id, created_at DESC);


--
-- Name: idx_withdrawals_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawals_created_at ON public.withdrawals USING btree (created_at DESC);


--
-- Name: idx_withdrawals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawals_status ON public.withdrawals USING btree (status);


--
-- Name: idx_withdrawals_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawals_user_id ON public.withdrawals USING btree (user_id);


--
-- Name: properties_property_id_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX properties_property_id_number_key ON public.properties USING btree (property_id_number);


--
-- Name: properties award_listing_points_on_approval; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER award_listing_points_on_approval BEFORE UPDATE OF status ON public.properties FOR EACH ROW EXECUTE FUNCTION public.award_listing_points_on_approval();


--
-- Name: invites award_referral_points_on_invite_completion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER award_referral_points_on_invite_completion AFTER UPDATE OF status ON public.invites FOR EACH ROW EXECUTE FUNCTION public.award_referral_points_on_invite_completion();


--
-- Name: properties on_property_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_property_status_change AFTER UPDATE OF status ON public.properties FOR EACH ROW EXECUTE FUNCTION public.on_listing_approved();


--
-- Name: credit_topups set_credit_topups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_credit_topups_updated_at BEFORE UPDATE ON public.credit_topups FOR EACH ROW EXECUTE FUNCTION public.set_credit_topups_updated_at();


--
-- Name: employee_listing_streak_days set_employee_listing_streak_days_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_employee_listing_streak_days_updated_at BEFORE UPDATE ON public.employee_listing_streak_days FOR EACH ROW EXECUTE FUNCTION public.set_employee_listing_streak_updated_at();


--
-- Name: employee_listing_streak_events set_employee_listing_streak_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_employee_listing_streak_events_updated_at BEFORE UPDATE ON public.employee_listing_streak_events FOR EACH ROW EXECUTE FUNCTION public.set_employee_listing_streak_updated_at();


--
-- Name: employee_listing_streak_settings set_employee_listing_streak_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_employee_listing_streak_settings_updated_at BEFORE UPDATE ON public.employee_listing_streak_settings FOR EACH ROW EXECUTE FUNCTION public.set_employee_listing_streak_updated_at();


--
-- Name: employee_listing_streaks set_employee_listing_streaks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_employee_listing_streaks_updated_at BEFORE UPDATE ON public.employee_listing_streaks FOR EACH ROW EXECUTE FUNCTION public.set_employee_listing_streak_updated_at();


--
-- Name: listing_roles set_listing_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_listing_roles_updated_at BEFORE UPDATE ON public.listing_roles FOR EACH ROW EXECUTE FUNCTION public.set_listing_roles_updated_at();


--
-- Name: referral_settings set_referral_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_referral_settings_updated_at BEFORE UPDATE ON public.referral_settings FOR EACH ROW EXECUTE FUNCTION public.set_referral_settings_updated_at();


--
-- Name: job_participations trg_job_participations_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_job_participations_set_updated_at BEFORE UPDATE ON public.job_participations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payment_transactions trg_payment_transactions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_transactions_set_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: properties trg_properties_assign_property_id_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_properties_assign_property_id_number BEFORE INSERT OR UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.assign_property_id_number();


--
-- Name: property_reports trg_property_reports_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_property_reports_set_updated_at BEFORE UPDATE ON public.property_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: property_view_history trg_property_view_history_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_property_view_history_set_updated_at BEFORE UPDATE ON public.property_view_history FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: referral_earnings trg_referral_earnings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_referral_earnings_set_updated_at BEFORE UPDATE ON public.referral_earnings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_wallets trg_user_wallets_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_wallets_set_updated_at BEFORE UPDATE ON public.user_wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: withdrawal_requests trg_withdrawal_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_withdrawal_requests_set_updated_at BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: bonuses bonuses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonuses
    ADD CONSTRAINT bonuses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: contact_views contact_views_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_views
    ADD CONSTRAINT contact_views_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: contact_views contact_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_views
    ADD CONSTRAINT contact_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: credit_topups credit_topups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topups
    ADD CONSTRAINT credit_topups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: credit_transactions credit_transactions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: credit_transactions credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: customer_search_history customer_search_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_search_history
    ADD CONSTRAINT customer_search_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: exchange_rates exchange_rates_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_set_by_fkey FOREIGN KEY (set_by) REFERENCES public.users(id);


--
-- Name: favorites favorites_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: invites invites_invited_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES public.users(id);


--
-- Name: invites invites_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: job_participations job_participations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_participations
    ADD CONSTRAINT job_participations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: job_participations job_participations_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_participations
    ADD CONSTRAINT job_participations_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: job_participations job_participations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_participations
    ADD CONSTRAINT job_participations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: messages messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_credited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_credited_by_fkey FOREIGN KEY (credited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.credit_packages(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: photo_views photo_views_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photo_views
    ADD CONSTRAINT photo_views_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: photo_views photo_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.photo_views
    ADD CONSTRAINT photo_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: points_ledger points_ledger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.points_ledger
    ADD CONSTRAINT points_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: property_amenities property_amenities_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_amenities
    ADD CONSTRAINT property_amenities_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_favorites property_favorites_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_favorites
    ADD CONSTRAINT property_favorites_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_favorites property_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_favorites
    ADD CONSTRAINT property_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: property_images property_images_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_images
    ADD CONSTRAINT property_images_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_inquiries property_inquiries_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_inquiries
    ADD CONSTRAINT property_inquiries_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_reports property_reports_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_reports
    ADD CONSTRAINT property_reports_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_reports property_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_reports
    ADD CONSTRAINT property_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: property_view_history property_view_history_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_view_history
    ADD CONSTRAINT property_view_history_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: property_view_history property_view_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_view_history
    ADD CONSTRAINT property_view_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referral_earnings referral_earnings_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_earnings
    ADD CONSTRAINT referral_earnings_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referral_earnings referral_earnings_referrer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_earnings
    ADD CONSTRAINT referral_earnings_referrer_user_id_fkey FOREIGN KEY (referrer_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referral_settings referral_settings_root_sponsor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_settings
    ADD CONSTRAINT referral_settings_root_sponsor_user_id_fkey FOREIGN KEY (root_sponsor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: team_tree team_tree_placement_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tree
    ADD CONSTRAINT team_tree_placement_parent_id_fkey FOREIGN KEY (placement_parent_id) REFERENCES public.users(id);


--
-- Name: team_tree team_tree_sponsor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tree
    ADD CONSTRAINT team_tree_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.users(id);


--
-- Name: team_tree team_tree_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tree
    ADD CONSTRAINT team_tree_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_blacklist user_blacklist_blacklisted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blacklist
    ADD CONSTRAINT user_blacklist_blacklisted_by_fkey FOREIGN KEY (blacklisted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_blacklist user_blacklist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blacklist
    ADD CONSTRAINT user_blacklist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_orders user_orders_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_orders
    ADD CONSTRAINT user_orders_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: user_orders user_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_orders
    ADD CONSTRAINT user_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_verifications user_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_verifications
    ADD CONSTRAINT user_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_wallets user_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_wallets
    ADD CONSTRAINT user_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_placement_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_placement_parent_id_fkey FOREIGN KEY (placement_parent_id) REFERENCES public.users(id);


--
-- Name: users users_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_sponsor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.users(id);


--
-- Name: withdrawal_requests withdrawal_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: withdrawal_requests withdrawal_requests_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.user_wallets(id) ON DELETE RESTRICT;


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: properties Admins can delete all properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete all properties" ON public.properties FOR DELETE TO authenticated USING (true);


--
-- Name: orders Admins can delete orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: property_inquiries Admins can delete property    inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete property
  inquiries" ON public.property_inquiries FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: property_reports Admins can delete property reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete property reports" ON public.property_reports FOR DELETE USING (public.is_current_user_admin());


--
-- Name: listing_roles Admins can insert listing roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert listing roles" ON public.listing_roles FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_current_user_admin() AS is_current_user_admin));


--
-- Name: user_blacklist Admins can manage blacklist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage blacklist" ON public.user_blacklist TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());


--
-- Name: credit_packages Admins can manage credit packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage credit packages" ON public.credit_packages USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: credit_settings Admins can manage credit settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage credit settings" ON public.credit_settings TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());


--
-- Name: referral_earnings Admins can manage referral earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage referral earnings" ON public.referral_earnings TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());


--
-- Name: site_settings Admins can manage site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage site settings" ON public.site_settings TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());


--
-- Name: payment_transactions Admins can read all payment transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all payment transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (public.is_current_user_admin());


--
-- Name: listing_roles Admins can read listing roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read listing roles" ON public.listing_roles FOR SELECT TO authenticated USING (( SELECT public.is_current_user_admin() AS is_current_user_admin));


--
-- Name: referral_settings Admins can read referral settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read referral settings" ON public.referral_settings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (COALESCE(u.is_admin, false) = true)))));


--
-- Name: properties Admins can update all properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all properties" ON public.properties FOR UPDATE TO authenticated USING (true);


--
-- Name: users Admins can update all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all users" ON public.users FOR UPDATE TO authenticated USING (true);


--
-- Name: listing_roles Admins can update listing roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update listing roles" ON public.listing_roles FOR UPDATE TO authenticated USING (( SELECT public.is_current_user_admin() AS is_current_user_admin)) WITH CHECK (( SELECT public.is_current_user_admin() AS is_current_user_admin));


--
-- Name: employee_listing_streak_settings Admins can update listing streak settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update listing streak settings" ON public.employee_listing_streak_settings FOR UPDATE TO authenticated USING (( SELECT public.is_current_user_admin() AS is_current_user_admin)) WITH CHECK (( SELECT public.is_current_user_admin() AS is_current_user_admin));


--
-- Name: orders Admins can update orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: property_inquiries Admins can update property    inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update property
  inquiries" ON public.property_inquiries FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: property_reports Admins can update property reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update property reports" ON public.property_reports FOR UPDATE USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());


--
-- Name: referral_settings Admins can update referral settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update referral settings" ON public.referral_settings FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (COALESCE(u.is_admin, false) = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND (COALESCE(u.is_admin, false) = true)))));


--
-- Name: withdrawal_requests Admins can update withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update withdrawals" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());


--
-- Name: property_inquiries Admins can view all    property inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all
  property inquiries" ON public.property_inquiries FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: orders Admins can view all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: properties Admins can view all properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all properties" ON public.properties FOR SELECT TO authenticated USING (true);


--
-- Name: users Admins can view all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all users" ON public.users FOR SELECT TO authenticated USING (true);


--
-- Name: property_reports Admins can view property reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view property reports" ON public.property_reports FOR SELECT USING (public.is_current_user_admin());


--
-- Name: feedback Anyone can delete feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete feedback" ON public.feedback FOR DELETE USING (true);


--
-- Name: credit_settings Anyone can read credit settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read credit settings" ON public.credit_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: site_settings Anyone can read site settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);


--
-- Name: property_inquiries Anyone can submit property    inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit property
  inquiries" ON public.property_inquiries FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: feedback Anyone can update feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update feedback" ON public.feedback FOR UPDATE USING (true);


--
-- Name: properties Anyone can view approved properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view approved properties" ON public.properties FOR SELECT USING (((status = 'approved'::text) OR (status IS NULL)));


--
-- Name: cover_photos Anyone can view cover photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view cover photos" ON public.cover_photos FOR SELECT USING (true);


--
-- Name: exchange_rates Anyone can view exchange rates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates FOR SELECT USING (true);


--
-- Name: feedback Anyone can view feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view feedback" ON public.feedback FOR SELECT USING (true);


--
-- Name: orders Anyone can view posted job feed orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view posted job feed orders" ON public.orders FOR SELECT TO authenticated, anon USING ((is_job_feed_posted = true));


--
-- Name: cover_photos Authenticated users can manage cover photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage cover photos" ON public.cover_photos TO authenticated USING (true) WITH CHECK (true);


--
-- Name: listing_roles Authenticated users can read active listing roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read active listing roles" ON public.listing_roles FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: employee_listing_streak_settings Authenticated users can read listing streak settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read listing streak settings" ON public.employee_listing_streak_settings FOR SELECT TO authenticated USING (true);


--
-- Name: customer_search_history Authenticated users can view customer search history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view customer search history" ON public.customer_search_history FOR SELECT TO authenticated USING (true);


--
-- Name: property_inquiries Property owners can view    their inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Property owners can view
  their inquiries" ON public.property_inquiries FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.properties
  WHERE ((properties.id = property_inquiries.property_id) AND (properties.user_id = auth.uid())))));


--
-- Name: property_inquiries Public can create property inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can create property inquiries" ON public.property_inquiries FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: customer_search_history Public can insert customer search history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert customer search history" ON public.customer_search_history FOR INSERT TO authenticated, anon WITH CHECK (((user_id IS NULL) OR (( SELECT auth.uid() AS uid) = user_id)));


--
-- Name: property_amenities Public can read approved property amenities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read approved property amenities" ON public.property_amenities FOR SELECT TO authenticated, anon USING (((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_amenities.property_id) AND (p.status = 'approved'::text) AND (p.is_active IS NOT FALSE)))) OR (EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_amenities.property_id) AND ((p.user_id = ( SELECT auth.uid() AS uid)) OR public.is_current_user_admin()))))));


--
-- Name: property_images Public can read approved property images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read approved property images" ON public.property_images FOR SELECT TO authenticated, anon USING (((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_images.property_id) AND (p.status = 'approved'::text) AND (p.is_active IS NOT FALSE)))) OR (EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_images.property_id) AND ((p.user_id = ( SELECT auth.uid() AS uid)) OR public.is_current_user_admin()))))));


--
-- Name: credit_packages Public can read credit packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read credit packages" ON public.credit_packages FOR SELECT USING (((active = true) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));


--
-- Name: feedback Public can submit feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can submit feedback" ON public.feedback FOR INSERT TO authenticated, anon WITH CHECK (((user_id IS NULL) OR (( SELECT auth.uid() AS uid) = user_id)));


--
-- Name: property_reports Public can submit property reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can submit property reports" ON public.property_reports FOR INSERT TO authenticated, anon WITH CHECK (((user_id IS NULL) OR (( SELECT auth.uid() AS uid) = user_id)));


--
-- Name: favorites Users can add favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: invites Users can create invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create invites" ON public.invites FOR INSERT TO authenticated WITH CHECK ((inviter_id = auth.uid()));


--
-- Name: orders Users can create own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: withdrawal_requests Users can create own withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own withdrawals" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: orders Users can create their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: withdrawals Users can create their own withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own withdrawals" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: properties Users can delete own properties or admin can delete all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own properties or admin can delete all" ON public.properties FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR public.is_current_user_admin()));


--
-- Name: payment_transactions Users can insert own payment transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own payment transactions" ON public.payment_transactions FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.is_current_user_admin()));


--
-- Name: properties Users can insert own properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own properties" ON public.properties FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.is_current_user_admin()));


--
-- Name: user_verifications Users can insert own verification documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own verification documents" ON public.user_verifications FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: credit_topups Users can insert their own credit topups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own credit topups" ON public.credit_topups FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: property_amenities Users can manage amenities for own properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage amenities for own properties" ON public.property_amenities TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_amenities.property_id) AND ((p.user_id = ( SELECT auth.uid() AS uid)) OR public.is_current_user_admin()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_amenities.property_id) AND ((p.user_id = ( SELECT auth.uid() AS uid)) OR public.is_current_user_admin())))));


--
-- Name: property_images Users can manage images for own properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage images for own properties" ON public.property_images TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_images.property_id) AND ((p.user_id = ( SELECT auth.uid() AS uid)) OR public.is_current_user_admin()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.properties p
  WHERE ((p.id = property_images.property_id) AND ((p.user_id = ( SELECT auth.uid() AS uid)) OR public.is_current_user_admin())))));


--
-- Name: contact_views Users can manage own contact views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own contact views" ON public.contact_views TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: job_participations Users can manage own job participations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own job participations" ON public.job_participations USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: property_favorites Users can manage own property favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own property favorites" ON public.property_favorites USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: property_view_history Users can manage own property view history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own property view history" ON public.property_view_history USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_wallets Users can manage own wallets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own wallets" ON public.user_wallets TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: messages Users can mark messages as read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark messages as read" ON public.messages FOR UPDATE TO authenticated USING ((receiver_id = auth.uid())) WITH CHECK ((receiver_id = auth.uid()));


--
-- Name: user_blacklist Users can read own blacklist status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own blacklist status" ON public.user_blacklist FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: employee_listing_streak_days Users can read own listing streak days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own listing streak days" ON public.employee_listing_streak_days FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR ( SELECT public.is_current_user_admin() AS is_current_user_admin)));


--
-- Name: employee_listing_streak_events Users can read own listing streak events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own listing streak events" ON public.employee_listing_streak_events FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR ( SELECT public.is_current_user_admin() AS is_current_user_admin)));


--
-- Name: employee_listing_streaks Users can read own listing streak summary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own listing streak summary" ON public.employee_listing_streaks FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR ( SELECT public.is_current_user_admin() AS is_current_user_admin)));


--
-- Name: payment_transactions Users can read own payment transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own payment transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_current_user_admin()));


--
-- Name: properties Users can read own properties or admin can read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own properties or admin can read all" ON public.properties FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_current_user_admin()));


--
-- Name: referral_earnings Users can read own referral earnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own referral earnings" ON public.referral_earnings FOR SELECT TO authenticated USING ((referrer_user_id = auth.uid()));


--
-- Name: withdrawal_requests Users can read own withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: credit_topups Users can read their own credit topups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own credit topups" ON public.credit_topups FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: favorites Users can remove favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove favorites" ON public.favorites FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: messages Users can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK ((sender_id = auth.uid()));


--
-- Name: payment_transactions Users can update own payment transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own payment transactions" ON public.payment_transactions FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR public.is_current_user_admin())) WITH CHECK (((auth.uid() = user_id) OR public.is_current_user_admin()));


--
-- Name: properties Users can update own properties or admin can update all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own properties or admin can update all" ON public.properties FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR public.is_current_user_admin())) WITH CHECK (((auth.uid() = user_id) OR public.is_current_user_admin()));


--
-- Name: credit_topups Users can update their own pending credit topups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own pending credit topups" ON public.credit_topups FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND (status = ANY (ARRAY['created'::text, 'pending'::text])))) WITH CHECK ((user_id = auth.uid()));


--
-- Name: team_tree Users can view their downline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their downline" ON public.team_tree FOR SELECT TO authenticated USING ((sponsor_path OPERATOR(public.<@) ( SELECT team_tree_1.sponsor_path
   FROM public.team_tree team_tree_1
  WHERE (team_tree_1.user_id = auth.uid()))));


--
-- Name: bonuses Users can view their own bonuses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own bonuses" ON public.bonuses FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: favorites Users can view their own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own favorites" ON public.favorites FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: invites Users can view their own invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own invites" ON public.invites FOR SELECT TO authenticated USING ((inviter_id = auth.uid()));


--
-- Name: messages Users can view their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT TO authenticated USING (((sender_id = auth.uid()) OR (receiver_id = auth.uid())));


--
-- Name: orders Users can view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: points_ledger Users can view their own points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own points" ON public.points_ledger FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: team_tree Users can view their own tree entry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own tree entry" ON public.team_tree FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: withdrawals Users can view their own withdrawals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: users allow_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_delete_own ON public.users FOR DELETE TO authenticated USING ((auth.uid() = id));


--
-- Name: users allow_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_insert_own ON public.users FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: users allow_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_read_all ON public.users FOR SELECT TO authenticated USING (true);


--
-- Name: users allow_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_update_own ON public.users FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: bonuses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bonuses ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_views ENABLE ROW LEVEL SECURITY;

--
-- Name: cover_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cover_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_topups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_topups ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_search_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_search_history ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_listing_streak_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_listing_streak_days ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_listing_streak_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_listing_streak_events ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_listing_streak_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_listing_streak_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_listing_streaks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_listing_streaks ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

--
-- Name: job_participations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_participations ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.listing_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: points_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: property_amenities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_amenities ENABLE ROW LEVEL SECURITY;

--
-- Name: property_favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: property_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;

--
-- Name: property_inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: property_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: property_view_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_view_history ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_earnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: team_tree; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_tree ENABLE ROW LEVEL SECURITY;

--
-- Name: user_blacklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_blacklist ENABLE ROW LEVEL SECURITY;

--
-- Name: user_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: user_wallets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawal_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict iXrwuje0Ska6XRxhitUkFPO8sB5zrol5naPr5lPKhyceSrLvnz8weocqbqicWXX

