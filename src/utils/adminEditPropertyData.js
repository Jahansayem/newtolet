// Admin edits may save an incomplete listing (no field is required). The
// database still has column types and a few constraints, so an incomplete
// payload is reshaped here into something Postgres accepts:
//   - NOT NULL text columns get '' instead of null/undefined
//   - number and date columns get null instead of '' (which is a type error)
//   - a listing with no usable rent is stored as "rent negotiable", because
//     properties_negotiable_or_priced_chk rejects "no rent and not negotiable"

const NOT_NULL_TEXT_COLUMNS = [
  'category',
  'property_type',
  'rent_period',
  'state_district',
  'area',
  'contact_number',
]

const NUMBER_COLUMNS = [
  'total_rooms',
  'dining_rooms',
  'living_rooms',
  'total_bathrooms',
  'balcony',
  'total_kitchen',
  'room_size_sqft',
  'rent_amount_bdt',
  'lat',
  'lng',
]

const DATE_COLUMNS = ['available_from', 'deadline']

const isBlank = (value) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

const toNumberOrNull = (value) => {
  if (isBlank(value)) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const normalizeAdminEditPropertyData = (propertyData = {}) => {
  const normalized = { ...propertyData }

  NOT_NULL_TEXT_COLUMNS.forEach((column) => {
    if (column in normalized && isBlank(normalized[column])) {
      normalized[column] = ''
    }
  })

  NUMBER_COLUMNS.forEach((column) => {
    if (column in normalized) {
      normalized[column] = toNumberOrNull(normalized[column])
    }
  })

  DATE_COLUMNS.forEach((column) => {
    if (column in normalized && isBlank(normalized[column])) {
      normalized[column] = null
    }
  })

  if ('rent_amount_bdt' in normalized && !(normalized.rent_amount_bdt > 0)) {
    normalized.rent_amount_bdt = null
    normalized.is_rent_negotiable = true
  }

  return normalized
}
