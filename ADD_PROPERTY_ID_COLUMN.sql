-- Add property_id_number column to properties table
-- This column will store a human-readable unique property ID

ALTER TABLE properties
ADD COLUMN property_id_number TEXT;

-- Create index on property_id_number for faster lookups
CREATE INDEX idx_properties_property_id_number ON properties(property_id_number);

-- Add comment to document the purpose
COMMENT ON COLUMN properties.property_id_number IS 'Public display ID: sequential number from 100000, assigned by the assign_property_id_number trigger (see 20261021120000_property_id_number_sequence_and_lookup.sql)';
