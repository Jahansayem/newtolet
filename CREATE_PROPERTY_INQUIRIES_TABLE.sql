-- Create property_inquiries table for Contact Owner messages
CREATE TABLE IF NOT EXISTS property_inquiries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE property_inquiries ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can create inquiries (public contact form)
CREATE POLICY "Anyone can create inquiries" ON property_inquiries
    FOR INSERT WITH CHECK (true);

-- Policy: Anyone can view all inquiries (for admin)
CREATE POLICY "Anyone can view all inquiries" ON property_inquiries
    FOR SELECT USING (true);

-- Policy: Anyone can update inquiries (for admin)
CREATE POLICY "Anyone can update inquiries" ON property_inquiries
    FOR UPDATE USING (true);

-- Policy: Anyone can delete inquiries (for admin)
CREATE POLICY "Anyone can delete inquiries" ON property_inquiries
    FOR DELETE USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_property_inquiries_property_id ON property_inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_status ON property_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_property_inquiries_created_at ON property_inquiries(created_at DESC);
