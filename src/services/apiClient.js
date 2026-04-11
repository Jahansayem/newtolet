import { supabase } from './supabaseClient'

const getStoredAccessToken = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return localStorage.getItem('authToken')
}

export const getAccessToken = async () => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token || getStoredAccessToken()
  } catch (error) {
    console.error('Error reading access token:', error)
    return getStoredAccessToken()
  }
}

const normalizeBody = (body, headers) => {
  if (typeof body === 'undefined') {
    return undefined
  }

  if (body instanceof FormData) {
    return body
  }

  headers.set('Content-Type', 'application/json')
  return JSON.stringify(body)
}

const parseResponse = async (response) => {
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
      `Request failed with status ${response.status}`

    throw new Error(message)
  }

  return payload
}

export const jsonRequest = async (url, options = {}) => {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')

  const response = await fetch(url, {
    ...options,
    headers,
    body: normalizeBody(options.body, headers),
  })

  return parseResponse(response)
}

export const authenticatedJsonRequest = async (url, options = {}) => {
  const token = await getAccessToken()

  if (!token) {
    throw new Error('Authentication required')
  }

  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${token}`)

  return jsonRequest(url, {
    ...options,
    headers,
  })
}
