-- ============================================================================
-- NewTolet Referral System v2
-- TheTolet-style referrals with wallet withdrawals and SQL-backed reward logic
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_username TEXT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS referral_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS referral_commission_type TEXT DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS referral_commission_value NUMERIC(10, 2) DEFAULT 20,
  ADD COLUMN IF NOT EXISTS referral_bonus_percent NUMERIC(10, 2) DEFAULT 20,
  ADD COLUMN IF NOT EXISTS referral_bonus_frequency TEXT DEFAULT 'every_purchase',
  ADD COLUMN IF NOT EXISTS min_withdrawal_amount NUMERIC(10, 2) DEFAULT 100;

UPDATE public.users
SET referral_code = CONCAT('REF', UPPER(REPLACE(LEFT(id::TEXT, 8), '-', '')))
WHERE COALESCE(referral_code, '') = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_username_unique
ON public.users (referral_username)
WHERE referral_username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_unique
ON public.users (referral_code)
WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by_lookup
ON public.users (referred_by);

CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credit_topup_id UUID,
  payment_transaction_id TEXT NOT NULL,
  purchase_amount_bdt NUMERIC(10, 2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  commission_mode TEXT NOT NULL DEFAULT 'percentage',
  commission_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bonus_percent NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bonus_credits_awarded INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_transaction_id)
);

CREATE TABLE IF NOT EXISTS public.user_wallets (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  banking_type TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_single_default
ON public.user_wallets (user_id)
WHERE is_default = true;

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.user_wallets(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  admin_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer
ON public.referral_earnings (referrer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_earnings_referred_user
ON public.referral_earnings (referred_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user
ON public.withdrawal_requests (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_referral_earnings_set_updated_at ON public.referral_earnings;
CREATE TRIGGER trg_referral_earnings_set_updated_at
BEFORE UPDATE ON public.referral_earnings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_wallets_set_updated_at ON public.user_wallets;
CREATE TRIGGER trg_user_wallets_set_updated_at
BEFORE UPDATE ON public.user_wallets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_withdrawal_requests_set_updated_at ON public.withdrawal_requests;
CREATE TRIGGER trg_withdrawal_requests_set_updated_at
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_referral_username(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_value TEXT;
BEGIN
  v_value := LOWER(TRIM(COALESCE(p_value, '')));
  v_value := REGEXP_REPLACE(v_value, '[^a-z0-9]+', '_', 'g');
  v_value := REGEXP_REPLACE(v_value, '^_+|_+$', '', 'g');
  v_value := REGEXP_REPLACE(v_value, '_{2,}', '_', 'g');
  RETURN LEFT(v_value, 24);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_referral_user_id(p_referral_input TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

CREATE OR REPLACE FUNCTION public.get_referral_candidate(p_referral_input TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  referral_username TEXT,
  referral_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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

CREATE OR REPLACE FUNCTION public.claim_referral_username(p_username TEXT)
RETURNS TABLE (
  id UUID,
  referral_username TEXT,
  referral_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
    referral_code = COALESCE(referral_code, CONCAT('REF', UPPER(REPLACE(LEFT(id::TEXT, 8), '-', '')))),
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN QUERY
  SELECT
    u.id,
    u.referral_username,
    u.referral_code
  FROM public.users u
  WHERE u.id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_referral_settings_row()
RETURNS public.site_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_settings public.site_settings;
BEGIN
  SELECT *
  INTO v_settings
  FROM public.site_settings
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN v_settings;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_referred_by UUID;
BEGIN
  v_referred_by := public.resolve_referral_user_id(NEW.raw_user_meta_data->>'referral_input');

  IF v_referred_by = NEW.id THEN
    v_referred_by := NULL;
  END IF;

  INSERT INTO public.users (
    id,
    email,
    phone,
    name,
    credits,
    verified,
    is_admin,
    is_active,
    referral_code,
    referred_by,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    0,
    false,
    false,
    true,
    CONCAT('REF', UPPER(REPLACE(LEFT(NEW.id::TEXT, 8), '-', ''))),
    v_referred_by,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    name = COALESCE(EXCLUDED.name, public.users.name),
    referred_by = COALESCE(public.users.referred_by, EXCLUDED.referred_by),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.get_available_referral_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_total_earnings NUMERIC(10, 2);
  v_reserved_withdrawals NUMERIC(10, 2);
BEGIN
  SELECT COALESCE(SUM(commission_amount), 0)
  INTO v_total_earnings
  FROM public.referral_earnings
  WHERE referrer_user_id = p_user_id
    AND status <> 'reversed';

  SELECT COALESCE(SUM(amount), 0)
  INTO v_reserved_withdrawals
  FROM public.withdrawal_requests
  WHERE user_id = p_user_id
    AND status IN ('requested', 'approved', 'paid');

  RETURN GREATEST(0, COALESCE(v_total_earnings, 0) - COALESCE(v_reserved_withdrawals, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_credit_topup_with_referral_effects(p_transaction_id TEXT)
RETURNS TABLE (
  transaction_id TEXT,
  credits_added INTEGER,
  bonus_credits INTEGER,
  referral_commission NUMERIC,
  balance_after INTEGER,
  status TEXT,
  credited_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_topup RECORD;
  v_buyer RECORD;
  v_settings RECORD;
  v_existing_earning RECORD;
  v_commission NUMERIC(10, 2) := 0;
  v_bonus_credits INTEGER := 0;
  v_balance_after INTEGER := 0;
BEGIN
  SELECT *
  INTO v_topup
  FROM public.credit_topups
  WHERE transaction_id = p_transaction_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit top-up not found for transaction %.', p_transaction_id;
  END IF;

  SELECT *
  INTO v_buyer
  FROM public.users
  WHERE id = v_topup.user_id
  LIMIT 1
  FOR UPDATE;

  IF v_buyer.id IS NULL THEN
    RAISE EXCEPTION 'Buyer profile not found.';
  END IF;

  IF COALESCE(v_topup.status, '') = 'paid' THEN
    SELECT *
    INTO v_existing_earning
    FROM public.referral_earnings
    WHERE payment_transaction_id = p_transaction_id
    LIMIT 1;

    RETURN QUERY
    SELECT
      p_transaction_id,
      COALESCE(v_topup.credits_to_add, 0)::INTEGER,
      COALESCE(v_existing_earning.bonus_credits_awarded, 0)::INTEGER,
      COALESCE(v_existing_earning.commission_amount, 0)::NUMERIC,
      COALESCE(v_buyer.credits, 0)::INTEGER,
      'paid'::TEXT,
      COALESCE(v_topup.updated_at, v_topup.created_at, NOW());
    RETURN;
  END IF;

  UPDATE public.credit_topups
  SET
    status = 'paid',
    updated_at = NOW()
  WHERE id = v_topup.id;

  UPDATE public.users
  SET
    credits = COALESCE(credits, 0) + COALESCE(v_topup.credits_to_add, 0),
    updated_at = NOW()
  WHERE id = v_buyer.id
  RETURNING credits INTO v_balance_after;

  SELECT *
  INTO v_settings
  FROM public.site_settings
  ORDER BY created_at ASC
  LIMIT 1;

  IF COALESCE(v_settings.referral_enabled, true) AND v_buyer.referred_by IS NOT NULL THEN
    SELECT *
    INTO v_existing_earning
    FROM public.referral_earnings
    WHERE payment_transaction_id = p_transaction_id
    LIMIT 1;

    IF v_existing_earning.id IS NULL THEN
      v_bonus_credits := GREATEST(
        0,
        FLOOR(COALESCE(v_topup.credits_to_add, 0) * COALESCE(v_settings.referral_bonus_percent, 20) / 100.0)
      )::INTEGER;

      IF v_bonus_credits > 0 THEN
        UPDATE public.users
        SET
          credits = COALESCE(credits, 0) + v_bonus_credits,
          updated_at = NOW()
        WHERE id = v_buyer.id
        RETURNING credits INTO v_balance_after;
      END IF;

      IF COALESCE(v_settings.referral_commission_type, 'percentage') = 'fixed' THEN
        v_commission := COALESCE(v_settings.referral_commission_value, 0);
      ELSE
        v_commission := ROUND(
          COALESCE(v_topup.amount_bdt, 0)::NUMERIC * COALESCE(v_settings.referral_commission_value, 20)::NUMERIC / 100.0,
          2
        );
      END IF;

      INSERT INTO public.referral_earnings (
        referrer_user_id,
        referred_user_id,
        credit_topup_id,
        payment_transaction_id,
        purchase_amount_bdt,
        commission_amount,
        commission_mode,
        commission_value,
        bonus_percent,
        bonus_credits_awarded,
        status,
        metadata
      )
      VALUES (
        v_buyer.referred_by,
        v_buyer.id,
        v_topup.id,
        p_transaction_id,
        COALESCE(v_topup.amount_bdt, 0),
        COALESCE(v_commission, 0),
        COALESCE(v_settings.referral_commission_type, 'percentage'),
        COALESCE(v_settings.referral_commission_value, 20),
        COALESCE(v_settings.referral_bonus_percent, 20),
        COALESCE(v_bonus_credits, 0),
        'available',
        jsonb_build_object(
          'payment_method', v_topup.payment_method,
          'provider', v_topup.provider,
          'bonus_frequency', COALESCE(v_settings.referral_bonus_frequency, 'every_purchase')
        )
      );
    ELSE
      v_commission := COALESCE(v_existing_earning.commission_amount, 0);
      v_bonus_credits := COALESCE(v_existing_earning.bonus_credits_awarded, 0);
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p_transaction_id,
    COALESCE(v_topup.credits_to_add, 0)::INTEGER,
    COALESCE(v_bonus_credits, 0)::INTEGER,
    COALESCE(v_commission, 0)::NUMERIC,
    COALESCE(v_balance_after, 0)::INTEGER,
    'paid'::TEXT,
    NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_withdrawal_request(p_wallet_id UUID, p_amount NUMERIC)
RETURNS SETOF public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id UUID;
  v_wallet RECORD;
  v_settings RECORD;
  v_available_balance NUMERIC(10, 2);
  v_request public.withdrawal_requests;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT *
  INTO v_wallet
  FROM public.user_wallets
  WHERE id = p_wallet_id
    AND user_id = v_user_id
    AND is_active = true
  LIMIT 1;

  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found.';
  END IF;

  SELECT *
  INTO v_settings
  FROM public.site_settings
  ORDER BY created_at ASC
  LIMIT 1;

  v_available_balance := public.get_available_referral_balance(v_user_id);

  IF COALESCE(p_amount, 0) < COALESCE(v_settings.min_withdrawal_amount, 100) THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is %.', COALESCE(v_settings.min_withdrawal_amount, 100);
  END IF;

  IF COALESCE(p_amount, 0) > COALESCE(v_available_balance, 0) THEN
    RAISE EXCEPTION 'Requested amount exceeds available referral balance.';
  END IF;

  INSERT INTO public.withdrawal_requests (
    user_id,
    wallet_id,
    amount,
    status,
    requested_at
  )
  VALUES (
    v_user_id,
    p_wallet_id,
    p_amount,
    'requested',
    NOW()
  )
  RETURNING * INTO v_request;

  RETURN NEXT v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_withdrawal_request(
  p_request_id UUID,
  p_status TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS SETOF public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_request public.withdrawal_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  IF p_status NOT IN ('requested', 'approved', 'rejected', 'paid') THEN
    RAISE EXCEPTION 'Unsupported withdrawal status.';
  END IF;

  UPDATE public.withdrawal_requests
  SET
    status = p_status,
    admin_note = COALESCE(p_admin_note, admin_note),
    completed_at = CASE WHEN p_status = 'paid' THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found.';
  END IF;

  RETURN NEXT v_request;
END;
$$;

ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view referred profiles" ON public.users;
CREATE POLICY "Users can view referred profiles"
ON public.users
FOR SELECT
TO authenticated
USING (referred_by = auth.uid());

DROP POLICY IF EXISTS "Users can read own referral earnings" ON public.referral_earnings;
CREATE POLICY "Users can read own referral earnings"
ON public.referral_earnings
FOR SELECT
TO authenticated
USING (referrer_user_id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can manage referral earnings" ON public.referral_earnings;
CREATE POLICY "Admins can manage referral earnings"
ON public.referral_earnings
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can manage own wallets" ON public.user_wallets;
CREATE POLICY "Users can manage own wallets"
ON public.user_wallets
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.is_current_user_admin())
WITH CHECK (user_id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can read own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users can read own withdrawals"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can create own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users can create own withdrawals"
ON public.withdrawal_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admins can update withdrawals"
ON public.withdrawal_requests
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

GRANT EXECUTE ON FUNCTION public.get_referral_candidate(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_credit_topup_with_referral_effects(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_withdrawal_request(UUID, TEXT, TEXT) TO authenticated;
