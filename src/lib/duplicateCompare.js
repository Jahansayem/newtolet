// Side-by-side comparison of listings that share a phone number, and the plan
// for "Keep this one". Pure module: safe for node --test.

const text = (value) => (value === null || value === undefined ? '' : String(value).trim())
const dateOnly = (value) => text(value).slice(0, 10)

const rent = (listing) => {
  const amount = listing.rent_amount_bdt ? `৳${Number(listing.rent_amount_bdt).toLocaleString('en-US')}${listing.rent_period ? ` / ${listing.rent_period}` : ''}` : ''
  if (amount) return listing.is_rent_negotiable ? `${amount} (negotiable)` : amount
  return listing.is_rent_negotiable ? 'Negotiable' : ''
}

const submitter = (listing) => {
  if (listing.isAiSubmitted) return 'AI agent'
  const by = listing.submitted_by || {}
  return by.name || by.email || by.phone || ''
}

// `informational` rows are shown but never marked as a difference: they are
// expected to differ between any two listings.
export const COMPARE_FIELDS = Object.freeze([
  { key: 'status', label: 'Status', informational: true, get: (listing) => text(listing.status) },
  { key: 'rent', label: 'Rent', get: rent },
  { key: 'category', label: 'Category', get: (listing) => text(listing.category) },
  { key: 'property_type', label: 'Property type', get: (listing) => text(listing.property_type) },
  { key: 'total_rooms', label: 'Rooms', get: (listing) => text(listing.total_rooms) },
  { key: 'total_bathrooms', label: 'Bathrooms', get: (listing) => text(listing.total_bathrooms) },
  { key: 'floor_level', label: 'Floor', get: (listing) => text(listing.floor_level) },
  { key: 'occupancy', label: 'Occupancy', get: (listing) => text(listing.occupancy) },
  { key: 'state_district', label: 'District', get: (listing) => text(listing.state_district) },
  { key: 'area', label: 'Area', get: (listing) => text(listing.area) },
  { key: 'sub_area', label: 'Sub-area', get: (listing) => text(listing.sub_area) },
  { key: 'available_from', label: 'Available from', get: (listing) => dateOnly(listing.available_from) },
  { key: 'deadline', label: 'Deadline', get: (listing) => dateOnly(listing.deadline) },
  { key: 'photos', label: 'Photos', get: (listing) => (typeof listing.photoCount === 'number' ? String(listing.photoCount) : '') },
  { key: 'amenities', label: 'Amenities', get: (listing) => (Array.isArray(listing.amenities) ? [...listing.amenities].sort().join(', ') : '') },
  { key: 'description', label: 'Description', get: (listing) => text(listing.short_description) },
  { key: 'submitted', label: 'Submitted', informational: true, get: (listing) => dateOnly(listing.created_at) },
  { key: 'submitter', label: 'Submitted by', informational: true, get: submitter },
])

const comparable = (value) => value.toLowerCase().replace(/\s+/g, ' ')

/**
 * buildComparison(listings) -> [{ key, label, values: string[], differs }]
 * One row per field, one value per listing (same order). `differs` is true
 * when the listings do not all show the same value; case and spacing are
 * ignored, an empty value counts as a value.
 */
export const buildComparison = (listings = []) =>
  COMPARE_FIELDS.map((field) => {
    const values = listings.map((listing) => field.get(listing || {}))
    const differs = !field.informational && new Set(values.map(comparable)).size > 1
    return { key: field.key, label: field.label, values, differs }
  })

export const countDifferences = (rows = []) => rows.filter((row) => row.differs).length

/**
 * planKeepOne(listings, keepId, othersAction) -> { approveIds, rejectIds, leftIds }
 * The kept listing is approved unless it already is. With othersAction
 * 'reject' the other *pending* listings are rejected; listings that were
 * already approved or rejected are never touched.
 */
export const planKeepOne = (listings = [], keepId, othersAction = 'reject') => {
  const keep = listings.find((listing) => listing.id === keepId)
  if (!keep) return { approveIds: [], rejectIds: [], leftIds: [] }
  const others = listings.filter((listing) => listing.id !== keepId)
  const pendingOthers = others.filter((listing) => listing.status === 'pending').map((listing) => listing.id)
  const rejectIds = othersAction === 'reject' ? pendingOthers : []
  return {
    approveIds: keep.status === 'approved' ? [] : [keepId],
    rejectIds,
    leftIds: others.map((listing) => listing.id).filter((id) => !rejectIds.includes(id)),
  }
}
