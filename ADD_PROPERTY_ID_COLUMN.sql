-- Add property_id_number column to properties table
-- This column will store a human-readable unique property ID

ALTER TABLE properties
ADD COLUMN property_id_number TEXT;

-- Create index on property_id_number for faster lookups
CREATE INDEX idx_properties_property_id_number ON properties(property_id_number);

-- Add comment to document the purpose
COMMENT ON COLUMN properties.property_id_number IS 'Human-readable unique property ID in format PROP-YYYY-XXXX';
