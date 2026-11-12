// Which fields of a listing need a reviewer's attention. Pure module: no
// Supabase import, safe for node --test. Used by the admin table badge, the
// details panel and the editor. Flags never block an action; they only warn.

export const FLAG_LEVELS = Object.freeze({ CRITICAL: 'critical', WARNING: 'warning' })

const isBlank = (value) => value === null || value === undefined || String(value).trim() === ''
const toNumber = (value) => (isBlank(value) || Number.isNaN(Number(value)) ? null : Number(value))

// Text that reads like a note to a colleague or a placeholder, not like an
// advert: typical of listings written from a forwarded post.
const INTERNAL_NOTE_PATTERNS = [
  /\b(?:note|n\.b\.|nb|source|src|ref|original post|posted by|forwarded|copied from|admin|internal|todo|fixme|tbd)\s*[:-]/i,
  /\bnot\s+(?:specified|mentioned|provided|available|given|sure|clear|stated)\b/i,
  /\b(?:unknown|unclear|unspecified|n\/a|to be confirmed|needs? (?:review|checking|verification)|could not|couldn't|cannot determine|no (?:info|information|details))\b/i,
  /\b(?:assum(?:e|ed|ing)|guess(?:ed|ing)?|probably|confidence)\b/i,
  /\bas an ai\b/i,
  /https?:\/\/|www\.|facebook\.com|fb\.com/i,
  /\[[^\]]{2,}\]|\{\{[^}]*\}\}|<[^>]{2,}>/,
]

export const looksLikeInternalNote = (text) => !isBlank(text) && INTERNAL_NOTE_PATTERNS.some((pattern) => pattern.test(String(text)))

const phoneDigits = (value) => String(value || '').replace(/\D/g, '')

const countOf = (listing, countKey, listKey) => {
  if (typeof listing?.[countKey] === 'number') return listing[countKey]
  return Array.isArray(listing?.[listKey]) ? listing[listKey].length : null
}

/**
 * getCompletenessFlags(listing) -> [{ code, label, level }]
 * Counts that were not loaded (photoCount / images, amenities) are skipped
 * rather than reported as missing.
 */
export const getCompletenessFlags = (listing = {}) => {
  const flags = []
  const add = (code, label, level) => flags.push({ code, label, level })
  const { CRITICAL, WARNING } = FLAG_LEVELS

  const rooms = toNumber(listing.total_rooms)
  if (rooms === null || rooms <= 0) add('rooms', 'Rooms missing', CRITICAL)
  if (isBlank(listing.area)) add('area', 'No area', CRITICAL)
  if (phoneDigits(listing.contact_number).length < 11) add('phone', 'Phone number invalid', CRITICAL)

  const description = String(listing.short_description || '').trim()
  if (description.length < 10) add('description', 'Description too short', CRITICAL)
  else if (looksLikeInternalNote(description)) add('note', 'Description looks like an internal note', CRITICAL)

  if (isBlank(listing.floor_level)) add('floor', 'No floor', WARNING)
  if (isBlank(listing.occupancy)) add('occupancy', 'No occupancy', WARNING)

  const bathrooms = toNumber(listing.total_bathrooms)
  if (bathrooms === null || bathrooms <= 0) add('bathrooms', 'Bathrooms missing', WARNING)

  if (countOf(listing, 'amenityCount', 'amenities') === 0) add('amenities', 'No amenities', WARNING)
  if (countOf(listing, 'photoCount', 'images') === 0) add('photos', 'No photos', WARNING)

  if (isBlank(listing.available_from)) add('dates', 'No available-from date', WARNING)
  else if (!isBlank(listing.deadline) && String(listing.deadline) < String(listing.available_from)) add('dates', 'Deadline is before the available-from date', WARNING)

  const rent = toNumber(listing.rent_amount_bdt)
  if (!listing.is_rent_negotiable && rent !== null && rent < 500) add('rent', 'Rent looks too low', WARNING)

  if (listing.isDuplicatePhone) add('duplicate', 'Phone used by other listings', WARNING)

  return flags
}

/** { count, level: 'critical'|'warning'|'ok', text, description } for a badge. */
export const summarizeCompleteness = (flags = []) => {
  if (flags.length === 0) return { count: 0, level: 'ok', text: 'Complete', description: 'No issues found' }
  const level = flags.some((flag) => flag.level === FLAG_LEVELS.CRITICAL) ? FLAG_LEVELS.CRITICAL : FLAG_LEVELS.WARNING
  return {
    count: flags.length,
    level,
    text: `${flags.length} ${flags.length === 1 ? 'issue' : 'issues'}`,
    description: flags.map((flag) => flag.label).join(', '),
  }
}

// What the "Incomplete only" list filter can ask the database: the fields a
// plain query can test. Photos and amenities live in other tables and the
// description rules are not expressible there.
export const INCOMPLETE_OR_FILTER =
  'total_rooms.is.null,total_rooms.eq.0,total_bathrooms.is.null,total_bathrooms.eq.0,floor_level.is.null,occupancy.is.null,available_from.is.null'
