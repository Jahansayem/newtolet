-- Add total_kitchen column to properties table
-- Run this in your Supabase SQL Editor

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS total_kitchen INTEGER DEFAULT 0;

-- Optional: Add comment for documentation
COMMENT ON COLUMN properties.total_kitchen IS 'Total number of kitchens in the property';
