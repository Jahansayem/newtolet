// The public Property ID is `properties.property_id_number`: a stable number from 100000
// assigned by the database on insert. It is the only identifier shown to users; the
// internal UUID stays in URLs and foreign keys.

export const getPropertyIdNumber = (property = {}) => {
  const value = property?.property_id_number

  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

// English label used by admin screens (non-admin components translate via
// `listing.card.idLabel`). Empty when the row has no number, so a positional index can
// never be mistaken for a real ID. The second argument is accepted for backwards
// compatibility with older call sites and ignored.
export const getPropertyDisplayLabel = (property = {}) => {
  const idNumber = getPropertyIdNumber(property)
  return idNumber ? `ID: ${idNumber}` : ''
}

// Users copy the label as shown ("ID: 100001", "Property #100001", "#100001").
// Strip that decoration so the digits can be matched against the stored value.
export const stripPropertyIdPrefix = (text = '') =>
  String(text || '')
    .trim()
    .replace(/^(?:property\s*)?(?:id)?\s*[:#]?\s*/i, '')
    .trim()

// Digits-only query → the exact Property ID being asked for, otherwise null.
export const extractExactPropertyIdNumber = (text = '') => {
  const stripped = stripPropertyIdPrefix(text)
  return /^\d+$/.test(stripped) ? stripped : null
}
