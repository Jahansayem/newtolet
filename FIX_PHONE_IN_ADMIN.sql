ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read all users" ON public.users;
DROP POLICY IF EXISTS "Admin can update all users" ON public.users;
DROP POLICY IF EXISTS "Admin can delete users" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role has full access" ON public.users;
DROP POLICY IF EXISTS "Service role full access" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can read all users" ON public.users;
DROP POLICY IF EXISTS "select_all_users" ON public.users;
DROP POLICY IF EXISTS "insert_own_user" ON public.users;
DROP POLICY IF EXISTS "update_own_user" ON public.users;
DROP POLICY IF EXISTS "delete_own_user" ON public.users;
DROP POLICY IF EXISTS "service_role_all" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_admin_all" ON public.users;
DROP POLICY IF EXISTS "users_insert_anonymous" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "allow_read_all" ON public.users;
DROP POLICY IF EXISTS "allow_insert_own" ON public.users;
DROP POLICY IF EXISTS "allow_update_own" ON public.users;
DROP POLICY IF EXISTS "allow_delete_own" ON public.users;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_all" ON public.users
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "allow_insert_own" ON public.users
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "allow_update_own" ON public.users
FOR UPDATE TO authenticated
USING (auth.uid() = id);

CREATE POLICY "allow_delete_own" ON public.users
FOR DELETE TO authenticated
USING (auth.uid() = id);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.users (id, email, phone, name, credits, verified, is_admin, is_active, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'name',
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

UPDATE public.users u
SET phone = au.raw_user_meta_data->>'phone'
FROM auth.users au
WHERE u.id = au.id
AND (u.phone IS NULL OR u.phone = '')
AND au.raw_user_meta_data->>'phone' IS NOT NULL;
