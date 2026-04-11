-- Add referral system columns to users table
-- Run this in Supabase SQL Editor

-- Add referred_by column to track who referred the user
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id);

-- Add credits column if it doesn't exist
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Create index for faster referral queries
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by);

-- Update RLS policies to allow users to update credits
CREATE POLICY "Users can update their own credits" ON public.users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow reading referred_by for referral validation
CREATE POLICY "Anyone can read user referral info" ON public.users
    FOR SELECT USING (true);

-- Function to add credits to referrer (optional - for more complex scenarios)
CREATE OR REPLACE FUNCTION add_referral_credits()
RETURNS TRIGGER AS $$
BEGIN
    -- If user was referred by someone, add 10 credits to referrer
    IF NEW.referred_by IS NOT NULL THEN
        UPDATE public.users
        SET credits = credits + 10
        WHERE id = NEW.referred_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create trigger to automatically add credits on new user registration
-- Uncomment if you want automatic credit addition via trigger instead of frontend
-- CREATE TRIGGER on_user_referred
--     AFTER INSERT ON public.users
--     FOR EACH ROW
--     EXECUTE FUNCTION add_referral_credits();

-- Verify the changes
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('referred_by', 'credits');
