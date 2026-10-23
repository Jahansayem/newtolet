/**
 * Property-type search options and the stored spellings each option matches.
 *
 * The Add/Edit Property forms store values such as "Office Space" while the search UI
 * offers "Office"; an exact `eq` comparison therefore never matched. Keep this map
 * data-only so both the client filters and the Supabase query can use it.
 */
export const PROPERTY_TYPE_OPTIONS = Object.freeze([
  'Apartment',
  'House',
  'Room',
  'Sublet',
  'Office',
  'Shop',
  'Warehouse',
])

export const PROPERTY_TYPE_ALIASES = Object.freeze({
  Apartment: ['Apartment'],
  House: ['House'],
  Room: ['Room'],
  Sublet: ['Sublet'],
  Office: ['Office', 'Office Space'],
  Shop: ['Shop'],
  Warehouse: ['Warehouse'],
})

const normalize = (value) =>
  value === null || value === undefined ? '' : String(value).trim().toLowerCase()

/** Stored spellings that count as a match for a search option (the option itself included). */
export const getPropertyTypeValues = (option) =>
  PROPERTY_TYPE_ALIASES[option] ? [...PROPERTY_TYPE_ALIASES[option]] : option ? [option] : []

/** Map an option or any stored spelling (case-insensitive) back to its search option, else ''. */
export const resolvePropertyTypeOption = (value) => {
  const key = normalize(value)

  if (!key) {
    return ''
  }

  for (const [option, aliases] of Object.entries(PROPERTY_TYPE_ALIASES)) {
    if (aliases.some((alias) => normalize(alias) === key)) {
      return option
    }
  }

  return ''
}

/** True when a property's stored type belongs to the given search option. */
export const matchesPropertyTypeOption = (propertyType, option) => {
  if (!option || option === 'All') {
    return true
  }

  const key = normalize(propertyType)
  return getPropertyTypeValues(option).some((alias) => normalize(alias) === key)
}
