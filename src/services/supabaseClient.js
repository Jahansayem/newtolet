import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_RESTRICTION_STORAGE_KEY = 'newtolet:supabase-restricted-until'
const SUPABASE_RESTRICTION_TTL_MS = 5 * 60 * 1000
const SUPABASE_RESTRICTION_MESSAGE =
  'Supabase project is temporarily restricted. Falling back to cached or local data.'

let supabaseRestrictedUntil = 0

// Validate environment variables - check for missing or placeholder values
const isValidEnvVar = (value) => {
  return value && value !== 'YOUR_SUPABASE_URL' && value !== 'YOUR_SUPABASE_ANON_KEY'
}

if (!isValidEnvVar(supabaseUrl) || !isValidEnvVar(supabaseAnonKey)) {
  if (typeof window === 'undefined') {
    // Server-side during build/render - show helpful error
    console.error('\n==============================================')
    console.error('❌ Missing Supabase Environment Variables')
    console.error('==============================================')
    console.error('Please update your .env.local file with actual values:')
    console.error('  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co')
    console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here')
    console.error('\nGet your credentials from: Supabase Dashboard > Settings > API')
    console.error('==============================================\n')
  }
  throw new Error('Missing Supabase environment variables. Please check your .env.local file and add real values (not placeholders).')
}

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const readStoredRestrictionUntil = () => {
  if (!canUseStorage()) {
    return 0
  }

  const storedValue = Number(localStorage.getItem(SUPABASE_RESTRICTION_STORAGE_KEY) || 0)
  return Number.isFinite(storedValue) ? storedValue : 0
}

const writeStoredRestrictionUntil = (restrictedUntil) => {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(SUPABASE_RESTRICTION_STORAGE_KEY, String(restrictedUntil))
}

const getRestrictionUntil = () =>
  Math.max(supabaseRestrictedUntil, readStoredRestrictionUntil())

export const isSupabaseProjectRestricted = () => Date.now() < getRestrictionUntil()

const isSupabaseRestrictionResponse = (status, bodyText = '') => {
  const normalizedBody = bodyText.toLowerCase()

  return (
    status === 402 &&
    (
      normalizedBody.includes('exceed_storage_size_quota') ||
      normalizedBody.includes('restricted') ||
      normalizedBody.includes('quota') ||
      normalizedBody.includes('payment required')
    )
  )
}

const markSupabaseProjectRestricted = () => {
  const restrictedUntil = Date.now() + SUPABASE_RESTRICTION_TTL_MS
  supabaseRestrictedUntil = restrictedUntil
  writeStoredRestrictionUntil(restrictedUntil)
}

const createSupabaseRestrictionResponse = () =>
  new Response(
    JSON.stringify({
      code: 'SUPABASE_PROJECT_RESTRICTED',
      message: SUPABASE_RESTRICTION_MESSAGE,
    }),
    {
      status: 402,
      statusText: 'Payment Required',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

const supabaseFetch = async (input, init) => {
  if (isSupabaseProjectRestricted()) {
    return createSupabaseRestrictionResponse()
  }

  const response = await globalThis.fetch(input, init)

  if (response.status === 402) {
    const bodyText = await response.clone().text().catch(() => '')

    if (isSupabaseRestrictionResponse(response.status, bodyText)) {
      markSupabaseProjectRestricted()
    }
  }

  return response
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch,
  },
})
