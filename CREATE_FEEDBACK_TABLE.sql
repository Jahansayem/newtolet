-- =====================================================
-- CREATE FEEDBACK TABLE - Complete Setup
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: Create feedback table
-- =====================================================

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    feedback TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    is_resolved BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 2: Create indexes for better performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- =====================================================
-- STEP 3: Enable RLS (Row Level Security)
-- =====================================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: Drop existing policies (if any)
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view approved feedback" ON feedback;
DROP POLICY IF EXISTS "Authenticated users can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON feedback;

-- =====================================================
-- STEP 5: Create RLS policies
-- =====================================================

-- Policy: Anyone (including anonymous users) can view APPROVED feedback only
CREATE POLICY "Anyone can view approved feedback" ON feedback
    FOR SELECT
    USING (status = 'approved');

-- Policy: Authenticated users can submit feedback (will be pending by default)
CREATE POLICY "Authenticated users can submit feedback" ON feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Admins can view ALL feedback (pending, approved, rejected)
CREATE POLICY "Admins can view all feedback" ON feedback
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- Policy: Admins can update feedback status
CREATE POLICY "Admins can update feedback" ON feedback
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- Policy: Admins can delete feedback
CREATE POLICY "Admins can delete feedback" ON feedback
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- =====================================================
-- STEP 6: Insert sample approved feedback (optional)
-- =====================================================

INSERT INTO feedback (name, email, feedback, status, is_resolved) VALUES
    ('John Doe', 'john@example.com', 'Great service! Found my dream apartment quickly.', 'approved', false),
    ('Sarah Smith', 'sarah@example.com', 'The platform is very user-friendly and easy to navigate.', 'approved', false),
    ('Mike Johnson', 'mike@example.com', 'Excellent property listings with detailed information.', 'approved', false)
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 7: Verify the table creation
-- =====================================================

-- Check feedback table structure
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'feedback'
ORDER BY ordinal_position;

-- Count feedback by status
SELECT status, COUNT(*) as count
FROM feedback
GROUP BY status;

-- =====================================================
-- DONE! The feedback system is ready.
--
-- Features:
-- ✓ Users can submit feedback (status = pending)
-- ✓ Admins can approve/reject feedback
-- ✓ Only approved feedback shows on homepage
-- ✓ Full audit trail with reviewed_at and reviewed_by
-- =====================================================
