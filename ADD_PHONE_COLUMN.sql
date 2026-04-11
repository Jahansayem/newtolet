-- ============================================================================
-- RUN THIS SQL IN SUPABASE SQL EDITOR TO ADD PHONE COLUMN
-- Go to: Supabase Dashboard > SQL Editor > New Query > Paste & Run
-- ============================================================================

-- Step 1: Add phone column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Step 2: Update the trigger function to save phone on registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, phone, name, credits, verified, is_admin, is_active, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        0,
        false,
        false,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        phone = COALESCE(EXCLUDED.phone, public.users.phone),
        name = COALESCE(EXCLUDED.name, public.users.name),
        updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Step 3: Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- DONE! Now new users will have their phone number saved.
-- Existing users will show 'N/A' for phone until they update their profile.
