// Pure helpers for anonymous visitor tracking. No DOM or Supabase imports so
// `node --test` can load this file; the browser glue lives in
// src/services/customerEventsService.js.

export const VISITOR_ID_STORAGE_KEY = 'newtolet:visitor-id'
export const SESSION_ID_STORAGE_KEY = 'newtolet:session-id'
export const TRACKED_PREFIX = 'newtolet:tracked:'
export const MAX_TEXT_LENGTH = 512

/** Event types the browser may record; unlocks, inquiries and orders come from database triggers. */
export const CLIENT_EVENT_TYPES = Object.freeze(['listing_view', 'phone_tap', 'whatsapp_tap', 'search'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value)

/** RFC 4122 v4 id; prefers crypto.randomUUID, falls back to getRandomValues, then Math.random. */
export const generateUuid = (cryptoLike = globalThis.crypto) => {
  if (cryptoLike && typeof cryptoLike.randomUUID === 'function') return cryptoLike.randomUUID()
  const bytes = new Uint8Array(16)
  if (cryptoLike && typeof cryptoLike.getRandomValues === 'function') cryptoLike.getRandomValues(bytes)
  else for (let index = 0; index < 16; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Returns the id stored under `key`, creating one when missing or corrupt.
 * A storage that throws (private mode, quota) still yields a fresh id so the
 * caller can keep it in memory for the page's lifetime. `null` storage → null.
 */
export const readOrCreateId = (storage, key, generate = generateUuid) => {
  if (!storage) return null
  let existing = null
  try {
    existing = storage.getItem(key)
  } catch {
    return generate()
  }
  if (isUuid(existing)) return existing
  const next = generate()
  try {
    storage.setItem(key, next)
  } catch {
    // unpersisted id; still usable for this page
  }
  return next
}

export const truncateText = (value, max = MAX_TEXT_LENGTH) => {
  if (value === null || value === undefined) return null
  const text = String(value)
  if (!text) return null
  return text.length > max ? text.slice(0, max) : text
}

/**
 * Builds the argument object for the track_customer_event RPC, or null when the
 * event must not be sent (forbidden type, no visitor and no session).
 */
export const buildEventPayload = ({ type, visitorId = null, sessionId = null, propertyId = null, pagePath = null, referrer = null, metadata = null } = {}) => {
  if (!CLIENT_EVENT_TYPES.includes(type)) return null
  if (!isUuid(visitorId)) return null
  const safeMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  return {
    p_event_type: type,
    p_visitor_id: visitorId,
    p_session_id: isUuid(sessionId) ? sessionId : null,
    p_property_id: isUuid(propertyId) ? propertyId : null,
    p_page_path: truncateText(pagePath),
    p_referrer: truncateText(referrer),
    p_metadata: safeMetadata,
  }
}

/** sessionStorage key used to send a listing view only once per tab per listing. */
export const trackedKey = (type, propertyId) => `${TRACKED_PREFIX}${type}:${propertyId || 'none'}`
