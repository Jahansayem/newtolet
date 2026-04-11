-- ============================================================================
-- REGISTRATION SYSTEM SQL SETUP
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES ON USERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_anonymous" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_admin_all" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- ============================================================================
-- STEP 2: DISABLE RLS TEMPORARILY (to clean up)
-- ============================================================================

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: VERIFY/CREATE USERS TABLE STRUCTURE
-- ============================================================================

-- Check if table exists, create if not
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    phone TEXT,
    name TEXT,
    credits INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add phone column if it doesn't exist (for existing tables)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================================================
-- STEP 4: ENABLE RLS
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: CREATE NEW SIMPLE POLICIES
-- ============================================================================

-- Policy 1: Allow users to insert their own profile (after auth signup)
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Policy 2: Allow users to read their own profile
CREATE POLICY "Users can read own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 3: Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 4: Allow service role full access (for admin operations)
CREATE POLICY "Service role has full access"
ON public.users
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 6: CREATE TRIGGER FOR AUTO-CREATING USER PROFILE ON SIGNUP
-- This is the KEY fix - automatically create profile when user signs up
-- ============================================================================

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, phone, name, credits, verified, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        0,
        false,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 7: VERIFY SETUP
-- ============================================================================

-- Check policies
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public';

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' OR trigger_name = 'on_auth_user_created';

-- ============================================================================
-- DONE! Your registration should now work.
-- ============================================================================

-- TEST: After running this SQL, try registering a new user in your app.
-- The trigger will automatically create the user profile in the users table.
