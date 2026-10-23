const getEnv = (name, values = [], fallbackValue = null) => {
  const value = values.find((entry) => typeof entry === 'string' && entry.trim().length > 0)

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  if (fallbackValue !== null) {
    return fallbackValue
  }

  throw new Error(`Missing required environment variable: ${name}`)
}

const trimTrailingSlash = (value) => value.replace(/\/+$/, '')

const getSupabaseProjectUrl = () =>
  trimTrailingSlash(
    getEnv('NEXT_PUBLIC_SUPABASE_URL', [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.VITE_SUPABASE_URL,
    ])
  )

const getSupabaseAnonKey = () =>
  getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', [
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
  ])

const parseFunctionResponse = async (response) => {
  let payload = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Function request failed with status ${response.status}`

    throw new Error(message)
  }

  return payload
}

export const invokeSupabaseFunction = async ({ functionName, body, token = null }) => {
  const anonKey = getSupabaseAnonKey()
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: anonKey,
  }

  headers.Authorization = `Bearer ${token || anonKey}`

  const response = await fetch(`${getSupabaseProjectUrl()}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
    cache: 'no-store',
  })

  return parseFunctionResponse(response)
}
