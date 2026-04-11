import { createClient } from '@supabase/supabase-js'

const getEnv = (name, fallbackNames = []) => {
  const value = [name, ...fallbackNames]
    .map((key) => process.env[key])
    .find((entry) => typeof entry === 'string' && entry.trim().length > 0)

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

const getSupabaseConfig = () => ({
  supabaseUrl: getEnv('NEXT_PUBLIC_SUPABASE_URL', ['VITE_SUPABASE_URL']),
  supabaseAnonKey: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY']),
  supabaseServiceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
})

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
}

export const createSupabaseAuthClient = () =>
  createClient(
    getSupabaseConfig().supabaseUrl,
    getSupabaseConfig().supabaseAnonKey,
    clientOptions
  )

export const createSupabaseAdminClient = () =>
  createClient(
    getSupabaseConfig().supabaseUrl,
    getSupabaseConfig().supabaseServiceRoleKey,
    clientOptions
  )

export const getBearerToken = (request) => {
  const authorization = request.headers.get('authorization') || ''

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
}

export const getAuthenticatedUser = async (request, options = {}) => {
  const { requireAdmin = false, allowMissing = false } = options
  const token = getBearerToken(request)

  if (!token) {
    if (allowMissing) {
      return { token: null, authUser: null, profile: null }
    }

    throw new Error('Missing authorization token')
  }

  const authClient = createSupabaseAuthClient()
  const adminClient = createSupabaseAdminClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token)

  if (authError || !user) {
    throw new Error('Invalid or expired session')
  }

  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('id, name, email, phone, is_admin, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (!profile) {
    throw new Error('User profile not found')
  }

  if (requireAdmin && profile.is_admin !== true) {
    throw new Error('Admin access required')
  }

  return {
    token,
    authUser: user,
    profile,
    adminClient,
  }
}
