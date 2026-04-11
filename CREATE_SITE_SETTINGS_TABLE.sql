-- Create the shared site_settings table used by:
-- - auto_approve_properties
-- - site theme
-- - future global admin settings
--
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_theme TEXT DEFAULT 'light',
  setting_key TEXT UNIQUE,
  setting_value TEXT,
  auto_approve_properties BOOLEAN DEFAULT false,
  property_listing INTEGER DEFAULT 20,
  contact_view INTEGER DEFAULT 10,
  photo_view INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.site_settings
  ADD COLUMN IF NOT EXISTS site_theme TEXT DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS setting_key TEXT,
  ADD COLUMN IF NOT EXISTS setting_value TEXT,
  ADD COLUMN IF NOT EXISTS auto_approve_properties BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS property_listing INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS contact_view INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS photo_view INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_settings_setting_key
ON public.site_settings (setting_key)
WHERE setting_key IS NOT NULL;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

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

INSERT INTO public.site_settings (
  site_theme,
  setting_key,
  setting_value,
  auto_approve_properties,
  property_listing,
  contact_view,
  photo_view
)
VALUES (
  'light',
  'global',
  'global',
  false,
  20,
  10,
  10
)
ON CONFLICT (setting_key) DO UPDATE
SET
  updated_at = NOW(),
  auto_approve_properties = COALESCE(site_settings.auto_approve_properties, EXCLUDED.auto_approve_properties),
  property_listing = COALESCE(site_settings.property_listing, EXCLUDED.property_listing),
  contact_view = COALESCE(site_settings.contact_view, EXCLUDED.contact_view),
  photo_view = COALESCE(site_settings.photo_view, EXCLUDED.photo_view);
