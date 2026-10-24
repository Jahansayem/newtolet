import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_RESTRICTION_STORAGE_KEY = 'newtolet:supabase-restricted-until'
const SUPABASE_CONNECTION_FAILURE_STORAGE_KEY = 'newtolet:supabase-connection-failed-until'
const SUPABASE_RESTRICTION_TTL_MS = 5 * 60 * 1000
const SUPABASE_CONNECTION_FAILURE_TTL_MS = 30 * 1000
const SUPABASE_RESTRICTION_MESSAGE =
  'Supabase project is temporarily restricted. Falling back to cached or local data.'
const SUPABASE_STORAGE_QUOTA_MESSAGE =
  'Supabase storage quota is exceeded. Google sign in and live data are unavailable until the project owner upgrades the Supabase plan, disables the spend cap, or reduces storage usage and waits for the quota to reset.'
const SUPABASE_CONNECTION_FAILURE_MESSAGE =
  'Supabase is currently unreachable. Falling back to cached or local data.'

let supabaseRestrictedUntil = 0
let supabaseConnectionFailedUntil = 0

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

const readStoredTimestamp = (storageKey) => {
  if (!canUseStorage()) {
    return 0
  }

  const storedValue = Number(localStorage.getItem(storageKey) || 0)
  return Number.isFinite(storedValue) ? storedValue : 0
}

const writeStoredTimestamp = (storageKey, timestamp) => {
  if (!canUseStorage()) {
    return
  }

  localStorage.setItem(storageKey, String(timestamp))
}

const getRestrictionUntil = () =>
  Math.max(supabaseRestrictedUntil, readStoredTimestamp(SUPABASE_RESTRICTION_STORAGE_KEY))

const getConnectionFailureUntil = () =>
  Math.max(
    supabaseConnectionFailedUntil,
    readStoredTimestamp(SUPABASE_CONNECTION_FAILURE_STORAGE_KEY)
  )

export const isSupabaseProjectRestricted = () => Date.now() < getRestrictionUntil()
export const isSupabaseConnectionUnavailable = () => Date.now() < getConnectionFailureUntil()

const getErrorMessage = (error) => {
  if (!error) {
    return ''
  }

  if (typeof error === 'string') {
    return error
  }

  return error.message || error.details || error.hint || String(error)
}

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

const trimTrailingSlash = (value = '') =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''

const getSupabaseRestrictionMessage = (bodyText = '') => {
  const normalizedBody = bodyText.toLowerCase()

  if (normalizedBody.includes('exceed_storage_size_quota')) {
    return SUPABASE_STORAGE_QUOTA_MESSAGE
  }

  return SUPABASE_RESTRICTION_MESSAGE
}

const markSupabaseProjectRestricted = () => {
  const restrictedUntil = Date.now() + SUPABASE_RESTRICTION_TTL_MS
  supabaseRestrictedUntil = restrictedUntil
  writeStoredTimestamp(SUPABASE_RESTRICTION_STORAGE_KEY, restrictedUntil)
}

const markSupabaseConnectionUnavailable = () => {
  const connectionFailedUntil = Date.now() + SUPABASE_CONNECTION_FAILURE_TTL_MS
  supabaseConnectionFailedUntil = connectionFailedUntil
  writeStoredTimestamp(SUPABASE_CONNECTION_FAILURE_STORAGE_KEY, connectionFailedUntil)
}

// Explicit user retries (e.g. the "Retry" button on search results) should hit the network
// again instead of receiving the remembered synthetic 503 for the rest of the window.
export const clearSupabaseConnectionFailureMark = () => {
  supabaseConnectionFailedUntil = 0
  writeStoredTimestamp(SUPABASE_CONNECTION_FAILURE_STORAGE_KEY, 0)
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

const createSupabaseConnectionFailureResponse = (error) =>
  new Response(
    JSON.stringify({
      code: 'SUPABASE_CONNECTION_UNAVAILABLE',
      message: SUPABASE_CONNECTION_FAILURE_MESSAGE,
      details: getErrorMessage(error),
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

export const checkSupabaseAuthServiceAvailability = async () => {
  if (isSupabaseProjectRestricted()) {
    return {
      available: false,
      error: SUPABASE_STORAGE_QUOTA_MESSAGE,
    }
  }

  try {
    const response = await supabaseFetch(`${trimTrailingSlash(supabaseUrl)}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
      },
    })

    if (response.status === 402) {
      const bodyText = await response.text().catch(() => '')

      return {
        available: false,
        error: getSupabaseRestrictionMessage(bodyText),
      }
    }

    return {
      available: true,
      error: null,
    }
  } catch (error) {
    return {
      available: false,
      error: getErrorMessage(error) || SUPABASE_CONNECTION_FAILURE_MESSAGE,
    }
  }
}

export const isRecoverableSupabaseError = (error) => {
  const message = getErrorMessage(error).toLowerCase()
  const status = Number(error?.status)
  const errorName = String(error?.name || '').toLowerCase()

  return (
    errorName === 'authretryablefetcherror' ||
    error?.code === 'SUPABASE_PROJECT_RESTRICTED' ||
    error?.code === 'SUPABASE_CONNECTION_UNAVAILABLE' ||
    status === 402 ||
    status === 503 ||
    message === '{}' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('connection') ||
    message.includes('unreachable') ||
    message.includes('service unavailable') ||
    message.includes('temporarily unavailable') ||
    message.includes('quota') ||
    message.includes('restricted')
  )
}

const supabaseFetch = async (input, init) => {
  if (isSupabaseProjectRestricted()) {
    return createSupabaseRestrictionResponse()
  }

  if (isSupabaseConnectionUnavailable()) {
    return createSupabaseConnectionFailureResponse()
  }

  let response

  try {
    response = await globalThis.fetch(input, init)
  } catch (error) {
    // A cancelled request (AbortController, React effect cleanup, navigation)
    // says nothing about connectivity: surface it unchanged instead of marking
    // the backend unreachable for the next 30 seconds.
    if (error?.name === 'AbortError' || init?.signal?.aborted) {
      throw error
    }
    markSupabaseConnectionUnavailable()
    return createSupabaseConnectionFailureResponse(error)
  }

  if (response.status === 402) {
    const bodyText = await response.clone().text().catch(() => '')

    if (isSupabaseRestrictionResponse(response.status, bodyText)) {
      markSupabaseProjectRestricted()
    }
  }

  return response
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    persistSession: true,
  },
  global: {
    fetch: supabaseFetch,
  },
})
