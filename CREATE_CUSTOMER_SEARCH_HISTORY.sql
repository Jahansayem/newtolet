-- Create customer search history table for admin visibility
CREATE TABLE IF NOT EXISTS customer_search_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    search_query TEXT,
    selected_location JSONB,
    selected_category TEXT,
    selected_price_range TEXT,
    result_count INTEGER DEFAULT 0 CHECK (result_count >= 0),
    page_path TEXT NOT NULL DEFAULT '/propertylist2',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customer_search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert customer search history" ON customer_search_history;
DROP POLICY IF EXISTS "Authenticated users can view customer search history" ON customer_search_history;

CREATE POLICY "Anyone can insert customer search history" ON customer_search_history
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Authenticated users can view customer search history" ON customer_search_history
    FOR SELECT
    TO authenticated
    USING (true);

CREATE INDEX IF NOT EXISTS idx_customer_search_history_created_at
    ON customer_search_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_search_history_user_id
    ON customer_search_history(user_id);

CREATE INDEX IF NOT EXISTS idx_customer_search_history_search_query
    ON customer_search_history(search_query);
