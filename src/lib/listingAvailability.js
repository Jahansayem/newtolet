// Listing availability status and "rent includes" values. The database accepts exactly these (see the
// check constraints in supabase/migrations/20261118120000_listing_availability_rent_includes.sql);
// keep both lists in sync.

export const AVAILABILITY_STATUSES = Object.freeze(['available', 'coming_soon', 'rented'])
export const DEFAULT_AVAILABILITY_STATUS = 'available'

export const RENT_INCLUDES_OPTIONS = Object.freeze([
  'water',
  'gas',
  'electricity',
  'service_charge',
  'security',
  'internet',
  'lift',
  'generator',
  'parking',
])

/** Unknown or missing values (including rows from before the migration) read as 'available'. */
export const normalizeAvailabilityStatus = (value) => {
  const status = String(value ?? '').trim().toLowerCase()
  return AVAILABILITY_STATUSES.includes(status) ? status : DEFAULT_AVAILABILITY_STATUS
}

export const isRentedListing = (listing) =>
  normalizeAvailabilityStatus(listing?.availability_status) === 'rented'

/**
 * Keeps only known values, without duplicates, in the canonical option order, so what is saved and
 * shown never depends on the order the boxes were ticked.
 */
export const normalizeRentIncludes = (value) => {
  const picked = new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => String(entry ?? '').trim().toLowerCase())
      .filter(Boolean)
  )
  return RENT_INCLUDES_OPTIONS.filter((option) => picked.has(option))
}

export const toggleRentIncludes = (current, option) => {
  const list = normalizeRentIncludes(current)
  return list.includes(option)
    ? list.filter((entry) => entry !== option)
    : normalizeRentIncludes([...list, option])
}
