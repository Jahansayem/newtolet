ALTER TABLE IF EXISTS public.properties
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.property_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_favorites_user_id
ON public.property_favorites (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.property_view_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  view_count INTEGER NOT NULL DEFAULT 1,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_view_history_user_id
ON public.property_view_history (user_id, last_viewed_at DESC);

CREATE TABLE IF NOT EXISTS public.job_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  specific_address TEXT NOT NULL,
  contact_details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_participations_user_id
ON public.job_participations (user_id, created_at DESC);

ALTER TABLE IF EXISTS public.property_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_view_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own property favorites" ON public.property_favorites;
CREATE POLICY "Users can manage own property favorites"
ON public.property_favorites
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own property view history" ON public.property_view_history;
CREATE POLICY "Users can manage own property view history"
ON public.property_view_history
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own job participations" ON public.job_participations;
CREATE POLICY "Users can manage own job participations"
ON public.job_participations
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_property_view_history_set_updated_at ON public.property_view_history;
CREATE TRIGGER trg_property_view_history_set_updated_at
BEFORE UPDATE ON public.property_view_history
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_job_participations_set_updated_at ON public.job_participations;
CREATE TRIGGER trg_job_participations_set_updated_at
BEFORE UPDATE ON public.job_participations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
