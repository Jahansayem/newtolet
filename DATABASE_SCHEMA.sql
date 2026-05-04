-- WEBSITE-FOCUSED CANONICAL SUPABASE SCHEMA FOR NEWTOLET.COM
-- Synced against live Supabase MCP on 2026-04-07.
--
-- Intentionally omitted from this website schema:
-- team_tree, points_ledger, bonuses, withdrawals, messages, exchange_rates,
-- invites, favorites, referral_settings, credit_topups, listing_roles,
-- storage_config_note, storage_policies_config, and other app/MLM-only objects.
--
-- Kept as website compatibility additions even though they were not present in
-- the live MCP snapshot: site_settings, payment_transactions, activities,
-- user_blacklist, users.is_employee, users.referred_by,
-- credit_transactions.payment_transaction_id,
-- credit_packages.discount_percentage, credit_packages.is_popular.

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

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND COALESCE(is_admin, false) = true
  );
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'feedback'
      AND column_name = 'message'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'feedback'
      AND column_name = 'feedback'
  ) THEN
    ALTER TABLE public.feedback RENAME COLUMN message TO feedback;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  email TEXT UNIQUE,
  phone TEXT,
  name TEXT,
  credits INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  referral_code TEXT UNIQUE,
  is_employee BOOLEAN DEFAULT false,
  referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  property_type TEXT NOT NULL,
  total_rooms INTEGER,
  total_bathrooms INTEGER,
  balcony INTEGER,
  floor_level TEXT,
  occupancy TEXT,
  room_size_sqft INTEGER,
  rent_amount_bdt INTEGER,
  rent_period TEXT NOT NULL,
  state_district TEXT NOT NULL,
  area TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  short_description TEXT,
  sector TEXT,
  road TEXT,
  house_plot TEXT,
  lat NUMERIC(10, 8),
  lng NUMERIC(11, 8),
  available_from DATE,
  deadline DATE,
  status TEXT DEFAULT 'pending',
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT false,
  sub_area TEXT,
  total_kitchen INTEGER DEFAULT 0,
  property_id_number TEXT,
  dining_rooms INTEGER DEFAULT 0,
  living_rooms INTEGER DEFAULT 0,
  is_rent_negotiable BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.property_images (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_thumbnail BOOLEAN DEFAULT false,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.property_amenities (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  amenity_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_verifications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  id_type TEXT NOT NULL,
  front_image_url TEXT NOT NULL,
  back_image_url TEXT NOT NULL,
  verification_status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  credits_deducted INTEGER,
  transaction_type TEXT,
  property_id UUID REFERENCES public.properties(id),
  created_at TIMESTAMP DEFAULT NOW(),
  credits_amount INTEGER,
  balance_after INTEGER,
  reference_type TEXT,
  reference_id UUID,
  provider TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  payment_transaction_id TEXT
);

CREATE TABLE IF NOT EXISTS public.contact_views (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  credits_spent INTEGER,
  viewed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.photo_views (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  credits_spent INTEGER,
  viewed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_orders (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  inquiry_message TEXT,
  contact_attempted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  package_name TEXT NOT NULL,
  credits_amount INTEGER NOT NULL,
  price_bdt INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  discount_percentage INTEGER DEFAULT 0,
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cover_photos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  image_url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.property_inquiries (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  phone VARCHAR NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  division VARCHAR NOT NULL,
  district VARCHAR NOT NULL,
  area VARCHAR NOT NULL,
  sub_area VARCHAR,
  category VARCHAR NOT NULL,
  rooms INTEGER NOT NULL,
  property_need_from DATE,
  max_budget INTEGER,
  additional_preferences TEXT,
  package VARCHAR DEFAULT '7_days',
  cost INTEGER DEFAULT 1000,
  status VARCHAR DEFAULT 'pending_payment',
  is_job_feed_posted BOOLEAN DEFAULT false,
  job_feed_posted_at TIMESTAMPTZ,
  job_feed_title TEXT,
  job_feed_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  feedback TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  setting_key TEXT UNIQUE,
  setting_value TEXT,
  auto_approve_properties BOOLEAN DEFAULT false,
  property_listing INTEGER DEFAULT 20,
  contact_view INTEGER DEFAULT 10,
  photo_view INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.credit_packages(id) ON DELETE SET NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  description TEXT,
  credits_to_add INTEGER DEFAULT 0,
  provider TEXT,
  invoice_id TEXT,
  customer_phone TEXT,
  sender_number TEXT,
  gateway_payload JSONB DEFAULT '{}'::jsonb,
  reference TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  credited_at TIMESTAMPTZ,
  credited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_blacklist (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  blacklisted_at TIMESTAMPTZ DEFAULT NOW(),
  blacklisted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  is_permanent BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ
);

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS is_employee BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS referred_by UUID;

ALTER TABLE IF EXISTS public.properties
  ADD COLUMN IF NOT EXISTS total_rooms INTEGER,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sub_area TEXT,
  ADD COLUMN IF NOT EXISTS total_kitchen INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS property_id_number TEXT,
  ADD COLUMN IF NOT EXISTS dining_rooms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS living_rooms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_rent_negotiable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.properties
  ALTER COLUMN rent_amount_bdt DROP NOT NULL,
  ALTER COLUMN is_rent_negotiable SET DEFAULT false,
  ALTER COLUMN is_rent_negotiable SET NOT NULL;

ALTER TABLE IF EXISTS public.property_images
  ADD COLUMN IF NOT EXISTS is_thumbnail BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE IF EXISTS public.user_verifications
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

ALTER TABLE IF EXISTS public.credit_transactions
  ADD COLUMN IF NOT EXISTS credits_amount INTEGER,
  ADD COLUMN IF NOT EXISTS balance_after INTEGER,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

ALTER TABLE IF EXISTS public.user_orders
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS inquiry_message TEXT,
  ADD COLUMN IF NOT EXISTS contact_attempted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE IF EXISTS public.credit_packages
  ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS sub_area VARCHAR,
  ADD COLUMN IF NOT EXISTS property_need_from DATE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.feedback
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.cover_photos
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.property_inquiries
  ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.site_settings
  ADD COLUMN IF NOT EXISTS setting_key TEXT,
  ADD COLUMN IF NOT EXISTS setting_value TEXT,
  ADD COLUMN IF NOT EXISTS auto_approve_properties BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS property_listing INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS contact_view INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS photo_view INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.payment_transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS credits_to_add INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS sender_number TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.user_blacklist
  ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.approve_credit_payment_transaction(
  p_payment_transaction_id UUID,
  p_admin_id UUID
)
RETURNS TABLE (
  payment_id UUID,
  transaction_id TEXT,
  user_id UUID,
  credits_added INTEGER,
  balance_after INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
    'uddoktapay',
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

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by);
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_category ON public.properties(category);
CREATE INDEX IF NOT EXISTS idx_properties_is_featured ON public.properties(is_featured);
CREATE INDEX IF NOT EXISTS idx_properties_property_id_number ON public.properties(property_id_number);
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON public.property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_property_amenities_property_id ON public.property_amenities(property_id);
CREATE INDEX IF NOT EXISTS idx_user_verifications_user_id ON public.user_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_payment_txn ON public.credit_transactions(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_contact_views_user_id ON public.contact_views(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_views_user_id ON public.photo_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orders_user_id ON public.user_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_packages_active ON public.credit_packages(active);
CREATE INDEX IF NOT EXISTS idx_cover_photos_order ON public.cover_photos(order_index);
CREATE INDEX IF NOT EXISTS idx_cover_photos_active ON public.cover_photos(is_active);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_property_id ON public.property_inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_status ON public.property_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_created_at ON public.property_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON public.payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice_id ON public.payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_user_blacklist_user_id ON public.user_blacklist(user_id);

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON public.users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_properties_set_updated_at ON public.properties;
CREATE TRIGGER trg_properties_set_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_orders_set_updated_at ON public.user_orders;
CREATE TRIGGER trg_user_orders_set_updated_at
BEFORE UPDATE ON public.user_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_credit_packages_set_updated_at ON public.credit_packages;
CREATE TRIGGER trg_credit_packages_set_updated_at
BEFORE UPDATE ON public.credit_packages
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cover_photos_set_updated_at ON public.cover_photos;
CREATE TRIGGER trg_cover_photos_set_updated_at
BEFORE UPDATE ON public.cover_photos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_property_inquiries_set_updated_at ON public.property_inquiries;
CREATE TRIGGER trg_property_inquiries_set_updated_at
BEFORE UPDATE ON public.property_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_set_updated_at ON public.orders;
CREATE TRIGGER trg_orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_feedback_set_updated_at ON public.feedback;
CREATE TRIGGER trg_feedback_set_updated_at
BEFORE UPDATE ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_site_settings_set_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_set_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payment_transactions_set_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_payment_transactions_set_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blacklist ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_amenities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_views DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_views DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile or admin can read all" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile or admin can update all" ON public.users;
DROP POLICY IF EXISTS "Users can delete own profile or admin can delete all" ON public.users;
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own profile or admin can read all"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_current_user_admin());

CREATE POLICY "Users can update own profile or admin can update all"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_current_user_admin())
WITH CHECK (auth.uid() = id OR public.is_current_user_admin());

CREATE POLICY "Users can delete own profile or admin can delete all"
ON public.users
FOR DELETE
TO authenticated
USING (auth.uid() = id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "Anyone can view cover photos" ON public.cover_photos;
DROP POLICY IF EXISTS "Authenticated users can manage cover photos" ON public.cover_photos;
CREATE POLICY "Anyone can view cover photos"
ON public.cover_photos
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage cover photos"
ON public.cover_photos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can submit property inquiries" ON public.property_inquiries;
DROP POLICY IF EXISTS "Property owners can view their inquiries" ON public.property_inquiries;
DROP POLICY IF EXISTS "Admins can view all property inquiries" ON public.property_inquiries;
DROP POLICY IF EXISTS "Admins can update property inquiries" ON public.property_inquiries;
DROP POLICY IF EXISTS "Admins can delete property inquiries" ON public.property_inquiries;
CREATE POLICY "Anyone can submit property inquiries"
ON public.property_inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Property owners can view their inquiries"
ON public.property_inquiries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties
    WHERE properties.id = property_inquiries.property_id
      AND properties.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all property inquiries"
ON public.property_inquiries
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Admins can update property inquiries"
ON public.property_inquiries
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete property inquiries"
ON public.property_inquiries
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view posted job feed orders" ON public.orders;
CREATE POLICY "Users can create their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Admins can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.is_current_user_admin());

CREATE POLICY "Anyone can view posted job feed orders"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (is_job_feed_posted = true);

DROP POLICY IF EXISTS "Anyone can view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can update feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can delete feedback" ON public.feedback;
CREATE POLICY "Anyone can view feedback"
ON public.feedback
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert feedback"
ON public.feedback
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update feedback"
ON public.feedback
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete feedback"
ON public.feedback
FOR DELETE
USING (true);

DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Anyone can read site settings"
ON public.site_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage site settings"
ON public.site_settings
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can read own payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can insert own payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can update own payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Admins can read all payment transactions" ON public.payment_transactions;
CREATE POLICY "Users can read own payment transactions"
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_current_user_admin());

CREATE POLICY "Users can insert own payment transactions"
ON public.payment_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

CREATE POLICY "Users can update own payment transactions"
ON public.payment_transactions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.is_current_user_admin())
WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

CREATE POLICY "Admins can read all payment transactions"
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can read own blacklist status" ON public.user_blacklist;
DROP POLICY IF EXISTS "Admins can manage blacklist" ON public.user_blacklist;
CREATE POLICY "Users can read own blacklist status"
ON public.user_blacklist
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_current_user_admin());

CREATE POLICY "Admins can manage blacklist"
ON public.user_blacklist
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());
