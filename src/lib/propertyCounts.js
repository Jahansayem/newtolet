// Stat-card counts for the admin Properties tab. Pure module: no Supabase
// import, safe for node --test.
//
// A count that could not be read is `null`, never 0. The screen keeps the last
// value it knew for that card and retries only the counts that failed.

export const PROPERTY_COUNT_KEYS = Object.freeze(['total', 'approved', 'pending', 'rejected', 'duplicatePending'])

export const PROPERTY_COUNT_LABELS = Object.freeze({
  total: 'Listings',
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  duplicatePending: 'Duplicate groups',
})

const isCount = (value) => typeof value === 'number' && Number.isFinite(value)

/** Fresh values win; a missing or failed (null) value keeps the previous one. */
export const mergePropertyCounts = (previous, next) =>
  Object.fromEntries(
    PROPERTY_COUNT_KEYS.map((key) => {
      if (isCount(next?.[key])) return [key, next[key]]
      return [key, isCount(previous?.[key]) ? previous[key] : null]
    })
  )

/** Which counts to ask for: the requested subset in card order, or all of them. */
export const resolveCountKeys = (only) => {
  const requested = Array.isArray(only) ? PROPERTY_COUNT_KEYS.filter((key) => only.includes(key)) : []
  return requested.length ? requested : [...PROPERTY_COUNT_KEYS]
}

/** "Pending and Rejected", "Listings, Approved and Pending", or "the counts" when all failed. */
export const describeFailedCounts = (failedKeys = []) => {
  const labels = PROPERTY_COUNT_KEYS.filter((key) => failedKeys.includes(key)).map((key) => PROPERTY_COUNT_LABELS[key])
  if (labels.length === 0) return ''
  if (labels.length === PROPERTY_COUNT_KEYS.length) return 'the counts'
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}
