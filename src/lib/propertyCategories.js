export const HOME_CATEGORIES = Object.freeze([
  'Family',
  'Bachelor',
  'Office',
  'Sublet',
  'Hostel',
  'Shop',
])

const CATEGORY_ALIASES = Object.freeze({
  family: 'Family',
  'family home': 'Family',
  bachelor: 'Bachelor',
  office: 'Office',
  'office space': 'Office',
  sublet: 'Sublet',
  hostel: 'Hostel',
  'hostel/mess': 'Hostel',
  shop: 'Shop',
})

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

export const normalizePropertyCategory = (value) => {
  const normalizedValue = normalizeText(value)

  if (!normalizedValue) {
    return ''
  }

  return CATEGORY_ALIASES[normalizedValue.toLowerCase()] || normalizedValue
}

export const getPropertyCategoryForMatch = (property) =>
  normalizePropertyCategory(property?.normalizedCategory || property?.category)

export const matchesPropertyCategory = (property, category) => {
  if (!category || category === 'All') {
    return true
  }

  return getPropertyCategoryForMatch(property) === normalizePropertyCategory(category)
}
