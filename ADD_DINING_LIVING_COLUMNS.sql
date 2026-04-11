-- Migration: Add dining_rooms and living_rooms columns, remove total_rooms
-- This script checks if the properties table exists before making changes

-- First, check if properties table exists by trying to add columns only if table exists
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    -- Check if properties table exists
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'properties'
    ) THEN
        -- Add dining_rooms column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'properties'
            AND column_name = 'dining_rooms'
        ) THEN
            ALTER TABLE properties ADD COLUMN dining_rooms INTEGER DEFAULT 0;
            RAISE NOTICE 'Added dining_rooms column';
        END IF;

        -- Add living_rooms column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'properties'
            AND column_name = 'living_rooms'
        ) THEN
            ALTER TABLE properties ADD COLUMN living_rooms INTEGER DEFAULT 0;
            RAISE NOTICE 'Added living_rooms column';
        END IF;

        -- Drop total_rooms column if it exists
        IF EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'properties'
            AND column_name = 'total_rooms'
        ) THEN
            ALTER TABLE properties DROP COLUMN total_rooms;
            RAISE NOTICE 'Dropped total_rooms column';
        END IF;

        RAISE NOTICE 'Migration completed successfully';
    ELSE
        RAISE NOTICE 'Properties table does not exist. Please run SCHEMA.sql first to create the tables.';
    END IF;
END $$;

-- Verify the changes
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'properties'
AND column_name IN ('dining_rooms', 'living_rooms', 'total_rooms')
ORDER BY column_name;
