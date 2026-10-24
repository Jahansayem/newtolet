// Fire-and-forget visitor tracking for the public site. Records listing views,
// phone taps and searches through the track_customer_event RPC with a random
// browser id (localStorage) and per-tab session id (sessionStorage). Never
// throws, never blocks rendering, does nothing during static export.

import { isRecoverableSupabaseError, supabase } from './supabaseClient'
import {
  SESSION_ID_STORAGE_KEY,
  VISITOR_ID_STORAGE_KEY,
  buildEventPayload,
  generateUuid,
  readOrCreateId,
  trackedKey,
} from '../lib/visitorId'

const memory = { visitorId: null, sessionId: null }

const safeStorage = (name) => {
  if (typeof window === 'undefined') return null
  try {
    return window[name] || null
  } catch {
    return null
  }
}

export const getVisitorId = () => {
  if (typeof window === 'undefined') return null
  if (!memory.visitorId) memory.visitorId = readOrCreateId(safeStorage('localStorage'), VISITOR_ID_STORAGE_KEY, generateUuid) || generateUuid()
  return memory.visitorId
}

export const getSessionId = () => {
  if (typeof window === 'undefined') return null
  if (!memory.sessionId) memory.sessionId = readOrCreateId(safeStorage('sessionStorage'), SESSION_ID_STORAGE_KEY, generateUuid) || generateUuid()
  return memory.sessionId
}

const alreadyTrackedThisTab = (type, propertyId) => {
  const storage = safeStorage('sessionStorage')
  if (!storage) return false
  const key = trackedKey(type, propertyId)
  try {
    if (storage.getItem(key)) return true
    storage.setItem(key, String(Date.now()))
  } catch {
    // storage unavailable: fall back to the server-side 60 s dedupe
  }
  return false
}

/**
 * trackEvent('listing_view' | 'phone_tap' | 'whatsapp_tap' | 'search', { propertyId, metadata, oncePerTab })
 * Listing views are sent once per listing per tab; other types rely on the
 * server's 60-second dedupe. Returns nothing; callers must not await it.
 */
export const trackEvent = (type, { propertyId = null, metadata = null, oncePerTab = type === 'listing_view' } = {}) => {
  try {
    if (typeof window === 'undefined' || !supabase) return
    if (oncePerTab && alreadyTrackedThisTab(type, propertyId)) return
    const payload = buildEventPayload({
      type,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      propertyId,
      pagePath: `${window.location.pathname}${window.location.search}`,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      metadata,
    })
    if (!payload) return
    void supabase
      .rpc('track_customer_event', payload)
      .then(({ error }) => {
        if (error && !isRecoverableSupabaseError(error) && error.code !== 'PGRST202') {
          console.debug('customer event not recorded:', error.message)
        }
      })
      .catch(() => {})
  } catch {
    // tracking is best-effort
  }
}

/** Records a search from the normalised customer_search_history payload. */
export const trackSearch = (normalizedPayload = {}) => {
  const { user_id: _ignored, ...rest } = normalizedPayload || {}
  trackEvent('search', { metadata: rest, oncePerTab: false })
}
