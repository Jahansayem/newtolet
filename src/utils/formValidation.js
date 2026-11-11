// Form validation utilities for Add Property workflow
//
// Each `validateScreenNCodes` helper returns `{ field: { code, params } }`
// so callers can localize messages via `localizeValidationErrors(errors, t)`.
// The original `validateScreenN` helpers keep returning English strings.

export const VALIDATION_KEY_PREFIX = 'addProperty.validation'

const VALIDATION_MESSAGES_EN = {
  categoryRequired: 'Please select a category',
  bathroomsInvalid: 'Please enter valid number of bathrooms',
  balconyInvalid: 'Please enter valid number of balconies',
  kitchenInvalid: 'Please enter valid number of kitchen',
  floorLevelRequired: 'Please select floor level',
  occupancyRequired: 'Please select occupancy restriction',
  rentAmountOrNegotiable: 'Please enter rent amount or mark it as negotiable',
  rentAmountInvalid: 'Please enter valid rent amount (must be greater than 0)',
  rentPeriodRequired: 'Please select rent period',
  stateDistrictRequired: 'Please enter state/district',
  areaRequired: 'Please enter area',
  contactNumberRequired: 'Please enter contact number',
  contactNumberInvalid: 'Please enter valid phone number (e.g., +8801788888888)',
  descriptionRequired: 'Please enter short description',
  descriptionMinLength: 'Description must be at least {min} characters',
  availableFromRequired: 'Please select available from date',
  deadlineRequired: 'Please select deadline date',
  deadlineBeforeAvailable: 'Deadline must be after available from date',
  imagesMin: 'Please upload at least {min} image',
  imagesMax: 'Maximum {max} images allowed',
}

const interpolate = (template, params) =>
  typeof template === 'string' && params
    ? template.replace(/\{(\w+)\}/g, (match, name) =>
        params[name] === undefined || params[name] === null ? match : String(params[name])
      )
    : template

const toEnglishMessages = (codeErrors) => {
  const errors = {}
  for (const [field, entry] of Object.entries(codeErrors)) {
    errors[field] = interpolate(VALIDATION_MESSAGES_EN[entry.code] || entry.code, entry.params)
  }
  return errors
}

/**
 * Convert `{ field: { code, params } }` into localized strings using a `t` function.
 */
export const localizeValidationErrors = (codeErrors, t) => {
  const errors = {}
  for (const [field, entry] of Object.entries(codeErrors || {})) {
    errors[field] = t(`${VALIDATION_KEY_PREFIX}.${entry.code}`, entry.params)
  }
  return errors
}

export const validateScreen1Codes = (data) => {
  const errors = {}

  if (!data.category) {
    errors.category = { code: 'categoryRequired' }
  }

  // property_type validation removed - field no longer exists

  // total_rooms and living_rooms are optional, no validation needed

  if (!data.total_bathrooms || data.total_bathrooms < 0) {
    errors.total_bathrooms = { code: 'bathroomsInvalid' }
  }

  if (data.balcony === null || data.balcony === undefined || data.balcony < 0) {
    errors.balcony = { code: 'balconyInvalid' }
  }

  if (data.kitchen === null || data.kitchen === undefined || data.kitchen < 0) {
    errors.kitchen = { code: 'kitchenInvalid' }
  }

  if (!data.floor_level) {
    errors.floor_level = { code: 'floorLevelRequired' }
  }

  if (!data.occupancy) {
    errors.occupancy = { code: 'occupancyRequired' }
  }

  return errors
}

export const validateScreen1 = (data) => toEnglishMessages(validateScreen1Codes(data))

export const validateScreen2Codes = (data) => {
  const errors = {}
  const hasRentAmount = data.rent_amount_bdt !== '' && data.rent_amount_bdt !== null && data.rent_amount_bdt !== undefined
  const isNegotiable = data.is_rent_negotiable === true || data.is_rent_negotiable === 'true'

  if (!isNegotiable && !hasRentAmount) {
    errors.rent_amount_bdt = { code: 'rentAmountOrNegotiable' }
  } else if (hasRentAmount && Number(data.rent_amount_bdt) <= 0) {
    errors.rent_amount_bdt = { code: 'rentAmountInvalid' }
  }

  if (!data.rent_period) {
    errors.rent_period = { code: 'rentPeriodRequired' }
  }

  return errors
}

export const validateScreen2 = (data) => toEnglishMessages(validateScreen2Codes(data))

export const validateScreen3Codes = (data) => {
  const errors = {}

  if (!data.state_district || data.state_district.trim() === '') {
    errors.state_district = { code: 'stateDistrictRequired' }
  }

  if (!data.area || data.area.trim() === '') {
    errors.area = { code: 'areaRequired' }
  }

  if (!data.contact_number || data.contact_number.trim() === '') {
    errors.contact_number = { code: 'contactNumberRequired' }
  }

  if (!isValidPhoneNumber(data.contact_number)) {
    errors.contact_number = { code: 'contactNumberInvalid' }
  }

  if (!data.short_description || data.short_description.trim() === '') {
    errors.short_description = { code: 'descriptionRequired' }
  } else if (data.short_description.trim().length < 10) {
    errors.short_description = { code: 'descriptionMinLength', params: { min: 10 } }
  }

  return errors
}

export const validateScreen3 = (data) => toEnglishMessages(validateScreen3Codes(data))

export const validateScreen4Codes = (data) => {
  const errors = {}

  if (!data.available_from) {
    errors.available_from = { code: 'availableFromRequired' }
  }

  // Deadline is optional on the Add Property form (the field was removed); only the
  // ordering rule applies when both dates are present. Edit Property keeps its own check.
  if (data.available_from && data.deadline) {
    const availableDate = new Date(data.available_from)
    const deadlineDate = new Date(data.deadline)

    if (availableDate > deadlineDate) {
      errors.deadline = { code: 'deadlineBeforeAvailable' }
    }
  }

  if (!data.images || data.images.length < 1) {
    errors.images = { code: 'imagesMin', params: { min: 1 } }
  }

  if (data.images && data.images.length > 10) {
    errors.images = { code: 'imagesMax', params: { max: 10 } }
  }

  return errors
}

export const validateScreen4 = (data) => toEnglishMessages(validateScreen4Codes(data))

export const isValidPhoneNumber = (phone) => {
  // Bangladesh phone format: +880 or 880 or just number starting with 1
  const phoneRegex = /^(\+88|88)?01[3-9]\d{8}$/
  const cleanedPhone = phone.replace(/\s+/g, '')
  return phoneRegex.test(cleanedPhone)
}

export const formatPhoneNumber = (phone) => {
  // Convert any format to +8801xxxxxxxxx
  let cleaned = phone.replace(/\D/g, '')

  if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2)
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }

  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return '+880' + cleaned
  }

  return '+880' + cleaned
}

export const validateAllScreens = (formData) => {
  const allErrors = {
    ...validateScreen1(formData),
    ...validateScreen2(formData),
    ...validateScreen3(formData),
    ...validateScreen4(formData)
  }

  return allErrors
}

export const hasErrors = (errors) => {
  return Object.keys(errors).length > 0
}
