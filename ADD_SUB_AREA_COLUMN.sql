-- ============================================================================
-- RUN THIS SQL IN SUPABASE SQL EDITOR TO ADD SUB_AREA COLUMN
-- Go to: Supabase Dashboard > SQL Editor > New Query > Paste & Run
-- ============================================================================

-- Add sub_area column to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS sub_area TEXT;

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'properties' AND table_schema = 'public'
ORDER BY ordinal_position;

-- DONE! The sub_area column has been added to the properties table.
