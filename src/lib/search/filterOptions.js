// Search filter vocabulary shared by the search form, URL parsing and the query planner.
// Stored values vary between listing sources, so each option lists every stored spelling.

export const PAGE_SIZE = 20

export const BATHROOM_FILTER_OPTIONS = ['1', '2', '3']

export const AMENITY_FILTERS = Object.freeze({
  furnished: ['With Furniture', 'Furnished'],
  lift: ['Lift'],
  generator: ['Generator'],
  parking: ['Garage', 'Parking'],
  gas: ['Gas Connection', 'Gas', 'LPG gas'],
})

export const AMENITY_FILTER_KEYS = Object.keys(AMENITY_FILTERS)

export const OCCUPANCY_FILTERS = Object.freeze({
  family: ['Only Family', 'Family'],
  female: ['Only Female', 'Female'],
  male: ['Only Male', 'Male'],
})

export const OCCUPANCY_FILTER_KEYS = Object.keys(OCCUPANCY_FILTERS)

/** "lift,gas" -> ['lift', 'gas'] (unknown keys dropped, order fixed, no duplicates). */
export const parseAmenityList = (value = '') => {
  const requested = new Set(
    (Array.isArray(value) ? value : String(value || '').split(','))
      .map((entry) => String(entry).trim().toLowerCase())
      .filter(Boolean)
  )
  return AMENITY_FILTER_KEYS.filter((key) => requested.has(key))
}

export const parsePageNumber = (value) => {
  const page = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(page) && page >= 1 && page <= 10000 ? page : 1
}
