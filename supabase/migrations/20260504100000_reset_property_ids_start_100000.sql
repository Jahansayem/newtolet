-- Reset Property IDs to Start from 100000
-- This migration renumbers all existing property_id_number values
-- to start from 100000 while maintaining chronological order

-- First, let's see what we're working with
-- Properties will be renumbered in order of created_at (oldest first)

-- Step 1: Create a temporary sequence for renumbering
DO $$
DECLARE
    property_record RECORD;
    new_id_number INTEGER := 100000;
    property_count INTEGER := 0;
BEGIN
    -- Count properties to be updated
    SELECT COUNT(*) INTO property_count
    FROM properties
    WHERE property_id_number IS NOT NULL;

    RAISE NOTICE 'Found % properties to renumber', property_count;

    -- Reset all property_id_numbers to NULL first
    UPDATE properties
    SET property_id_number = NULL
    WHERE property_id_number IS NOT NULL;

    -- Renumber properties in chronological order (oldest first)
    FOR property_record IN
        SELECT id
        FROM properties
        ORDER BY created_at ASC
    LOOP
        UPDATE properties
        SET property_id_number = new_id_number::TEXT
        WHERE id = property_record.id;

        new_id_number := new_id_number + 1;
    END LOOP;

    RAISE NOTICE 'Successfully renumbered properties from 100000 to %', new_id_number - 1;
END $$;

-- Step 2: Verify the renumbering
SELECT
    id,
    property_id_number,
    created_at
FROM properties
ORDER BY created_at ASC
LIMIT 10;

-- Expected output should show:
-- property_id_number starting at 100000 for the oldest property
-- Sequentially increasing by 1 for each property
-- Ordered by created_at

-- Step 3: Create an index on property_id_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_property_id_number
ON properties(property_id_number);

-- Step 4: Add a comment to document this change
COMMENT ON COLUMN properties.property_id_number IS
'Property display ID number starting from 100000. Sequential numbering based on creation order.';
