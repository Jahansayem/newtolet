-- Verification Script for Registration Fixes
-- Run this in Supabase SQL Editor to verify all fixes are in place

-- 1. Check users table schema
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Check RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'users' AND schemaname = 'public';

-- 3. Check all RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd as command,
    qual as qualification,
    with_check
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

-- 4. Verify no users exist yet (for fresh test)
SELECT COUNT(*) as user_count FROM public.users;

-- 5. Check auth.users count in Supabase Auth
SELECT COUNT(*) as auth_user_count FROM auth.users;
