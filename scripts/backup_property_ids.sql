-- BACKUP SCRIPT: Save current property IDs before reset
-- Run this BEFORE applying the reset migration to create a backup

-- Create a backup table with current property IDs
CREATE TABLE IF NOT EXISTS property_id_backup AS
SELECT
    id,
    property_id_number AS old_property_id_number,
    created_at,
    NOW() AS backup_timestamp
FROM properties
WHERE property_id_number IS NOT NULL;

-- Verify backup was created
SELECT
    COUNT(*) AS total_backed_up_properties,
    MIN(old_property_id_number) AS min_old_id,
    MAX(old_property_id_number) AS max_old_id,
    MIN(created_at) AS oldest_property,
    MAX(created_at) AS newest_property
FROM property_id_backup;

-- If you need to restore the old IDs, run:
-- UPDATE properties p
-- SET property_id_number = b.old_property_id_number
-- FROM property_id_backup b
-- WHERE p.id = b.id;
