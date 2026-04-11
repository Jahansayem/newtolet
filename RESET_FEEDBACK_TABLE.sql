-- First drop all policies
DROP POLICY IF EXISTS "Anyone can view approved feedback" ON feedback;
DROP POLICY IF EXISTS "Authenticated users can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can view feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can update feedback" ON feedback;
DROP POLICY IF EXISTS "Anyone can delete feedback" ON feedback;

-- Drop the table completely
DROP TABLE IF EXISTS feedback CASCADE;

-- Create fresh feedback table
CREATE TABLE feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    name TEXT NOT NULL,
    feedback TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create simple policies
CREATE POLICY "feedback_insert" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "feedback_select" ON feedback FOR SELECT USING (true);
CREATE POLICY "feedback_update" ON feedback FOR UPDATE USING (true);
CREATE POLICY "feedback_delete" ON feedback FOR DELETE USING (true);

-- Verify table structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'feedback';
