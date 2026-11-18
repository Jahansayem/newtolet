// Pure helpers for the property compare list (ids in localStorage, see propertyCompareService.js)
// and for the side-by-side table on /compare/. No browser or Supabase access here so they can be
// unit-tested with node --test.

export const MAX_COMPARE_ITEMS = 4

const cleanIds = (ids) => (Array.isArray(ids) ? ids.filter(Boolean) : [])

/**
 * Adds or removes one id. Adding past `max` is refused (the list is unchanged) so the table never
 * grows wider than the screen can show.
 */
export const toggleCompareId = (ids, propertyId, max = MAX_COMPARE_ITEMS) => {
  const current = cleanIds(ids)

  if (current.includes(propertyId)) {
    return { ids: current.filter((id) => id !== propertyId), compared: false, limitReached: false }
  }

  if (current.length >= max) {
    return { ids: current, compared: false, limitReached: true }
  }

  return { ids: [...current, propertyId], compared: true, limitReached: false }
}

const normalizeForComparison = (value) => {
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value)) return [...value].map(String).sort().join('|')
  return String(value).trim().toLowerCase()
}

/** True when at least two listings show different values (blank counts as a value). */
export const valuesDiffer = (values) => {
  if (!Array.isArray(values) || values.length < 2) return false
  const first = normalizeForComparison(values[0])
  return values.some((value) => normalizeForComparison(value) !== first)
}

// Rows of the compare table, in display order. `get` reads the raw value from a listing in the
// shape getComparedProperties() returns; the page formats it for display.
export const COMPARE_ROWS = Object.freeze([
  { key: 'rent', get: (item) => (item.is_rent_negotiable ? 'negotiable' : item.rent_amount_bdt ?? '') },
  { key: 'category', get: (item) => item.category || '' },
  { key: 'propertyType', get: (item) => item.property_type || '' },
  { key: 'location', get: (item) => [item.sub_area, item.area, item.state_district].filter(Boolean).join(', ') },
  { key: 'bedrooms', get: (item) => item.total_rooms ?? '' },
  { key: 'bathrooms', get: (item) => item.total_bathrooms ?? '' },
  { key: 'balcony', get: (item) => item.balcony ?? '' },
  { key: 'kitchen', get: (item) => item.total_kitchen ?? '' },
  { key: 'floor', get: (item) => item.floor_level || '' },
  { key: 'size', get: (item) => item.room_size_sqft ?? '' },
  { key: 'availableFrom', get: (item) => (item.available_from ? String(item.available_from).slice(0, 7) : '') },
  { key: 'occupancy', get: (item) => item.occupancy || '' },
  { key: 'facilities', get: (item) => (Array.isArray(item.amenities) ? item.amenities : []) },
  { key: 'propertyId', get: (item) => item.property_id_number ?? '' },
])

/**
 * Builds the table body: one entry per row with each listing's raw value and whether the values
 * differ. The Property ID row never counts as a difference (it is unique by definition).
 */
export const buildCompareRows = (items) => {
  const list = Array.isArray(items) ? items.filter(Boolean) : []

  return COMPARE_ROWS.map(({ key, get }) => {
    const values = list.map((item) => get(item))
    return { key, values, differs: key !== 'propertyId' && valuesDiffer(values) }
  })
}
