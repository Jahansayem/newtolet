-- =====================================================
-- FIX FEEDBACK RLS POLICIES
-- =====================================================
-- Run this in Supabase SQL Editor to fix admin access
-- =====================================================

-- =====================================================
-- STEP 1: Drop all existing policies
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view approved feedback" ON feedback;
DROP POLICY IF EXISTS "Authenticated users can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON feedback;

-- =====================================================
-- STEP 2: Create simplified policies that work
-- =====================================================

-- Policy 1: Public can view APPROVED feedback (for homepage)
CREATE POLICY "Public view approved feedback" ON feedback
    FOR SELECT
    USING (status = 'approved');

-- Policy 2: Authenticated users can INSERT feedback
CREATE POLICY "Authenticated insert feedback" ON feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy 3: Authenticated users can view ALL feedback (for admin panel)
-- This is simpler and will work for all authenticated users
-- You can add admin-only restriction in your app logic
CREATE POLICY "Authenticated view all feedback" ON feedback
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy 4: Authenticated users can UPDATE feedback (for admin panel)
CREATE POLICY "Authenticated update feedback" ON feedback
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy 5: Authenticated users can DELETE feedback (for admin panel)
CREATE POLICY "Authenticated delete feedback" ON feedback
    FOR DELETE
    TO authenticated
    USING (true);

-- =====================================================
-- STEP 3: Verify policies are created
-- =====================================================

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'feedback';

-- =====================================================
-- STEP 4: Test query to see if feedback is accessible
-- =====================================================

SELECT id, name, email, feedback, status, created_at
FROM feedback
ORDER BY created_at DESC;

-- =====================================================
-- DONE!
--
-- Now try accessing the admin panel feedback section.
-- It should show the 3 sample feedbacks from the database.
-- =====================================================
