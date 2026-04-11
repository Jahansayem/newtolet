ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS is_job_feed_posted BOOLEAN DEFAULT false;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS job_feed_posted_at TIMESTAMPTZ;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS job_feed_title TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS job_feed_description TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_job_feed_posted
ON public.orders (is_job_feed_posted, job_feed_posted_at DESC);

DROP POLICY IF EXISTS "Anyone can view posted job feed orders" ON public.orders;
CREATE POLICY "Anyone can view posted job feed orders"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (is_job_feed_posted = true);
