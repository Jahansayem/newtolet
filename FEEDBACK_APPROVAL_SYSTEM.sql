-- =====================================================
-- FEEDBACK APPROVAL SYSTEM - SQL Migration
-- =====================================================
-- This adds approval workflow to the feedback system
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: Add status column to feedback table
-- =====================================================

-- Add status column (pending, approved, rejected)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add reviewed_at timestamp
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Add reviewed_by (admin user id who approved/rejected)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- =====================================================
-- STEP 2: Update existing feedback to approved status
-- =====================================================

-- Set all existing feedback to approved (so they show on homepage)
UPDATE feedback SET status = 'approved' WHERE status = 'pending';

-- =====================================================
-- STEP 3: Create indexes for better performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- =====================================================
-- STEP 4: Update RLS policies
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view feedback" ON feedback;
DROP POLICY IF EXISTS "Authenticated users can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can manage feedback" ON feedback;

-- Policy: Anyone can view APPROVED feedback only
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
        auth.uid() IN (SELECT id FROM users WHERE is_admin = true)
    );

-- Policy: Admins can update feedback status
CREATE POLICY "Admins can update feedback" ON feedback
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() IN (SELECT id FROM users WHERE is_admin = true)
    );

-- Policy: Admins can delete feedback
CREATE POLICY "Admins can delete feedback" ON feedback
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() IN (SELECT id FROM users WHERE is_admin = true)
    );

-- =====================================================
-- STEP 5: Verify the changes
-- =====================================================

-- Check feedback table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'feedback'
AND column_name IN ('status', 'reviewed_at', 'reviewed_by')
ORDER BY ordinal_position;

-- Count feedback by status
SELECT status, COUNT(*) as count
FROM feedback
GROUP BY status;

-- =====================================================
-- DONE! The feedback approval system is ready.
--
-- Features:
-- - User submits feedback → status = 'pending'
-- - Admin approves → status = 'approved', shows on homepage
-- - Admin rejects → status = 'rejected', hidden from homepage
-- - Only approved feedback visible to public
-- =====================================================
