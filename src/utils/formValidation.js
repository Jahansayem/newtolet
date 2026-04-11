// Form validation utilities for Add Property workflow

export const validateScreen1 = (data) => {
  const errors = {}

  if (!data.category) {
    errors.category = 'Please select a category'
  }

  // property_type validation removed - field no longer exists

  // dining_rooms and living_rooms are optional, no validation needed

  if (!data.total_bathrooms || data.total_bathrooms < 0) {
    errors.total_bathrooms = 'Please enter valid number of bathrooms'
  }

  if (data.balcony === null || data.balcony === undefined || data.balcony < 0) {
    errors.balcony = 'Please enter valid number of balconies'
  }

  if (data.kitchen === null || data.kitchen === undefined || data.kitchen < 0) {
    errors.kitchen = 'Please enter valid number of kitchen'
  }

  if (!data.floor_level) {
    errors.floor_level = 'Please select floor level'
  }

  if (!data.occupancy) {
    errors.occupancy = 'Please select occupancy restriction'
  }

  return errors
}

export const validateScreen2 = (data) => {
  const errors = {}

  if (!data.rent_amount_bdt || data.rent_amount_bdt <= 0) {
    errors.rent_amount_bdt = 'Please enter valid rent amount (must be greater than 0)'
  }

  if (!data.rent_period) {
    errors.rent_period = 'Please select rent period'
  }

  return errors
}

export const validateScreen3 = (data) => {
  const errors = {}

  if (!data.state_district || data.state_district.trim() === '') {
    errors.state_district = 'Please enter state/district'
  }

  if (!data.area || data.area.trim() === '') {
    errors.area = 'Please enter area'
  }

  if (!data.contact_number || data.contact_number.trim() === '') {
    errors.contact_number = 'Please enter contact number'
  }

  if (!isValidPhoneNumber(data.contact_number)) {
    errors.contact_number = 'Please enter valid phone number (e.g., +8801788888888)'
  }

  if (!data.short_description || data.short_description.trim() === '') {
    errors.short_description = 'Please enter short description'
  } else if (data.short_description.trim().length < 10) {
    errors.short_description = 'Description must be at least 10 characters'
  }

  return errors
}

export const validateScreen4 = (data) => {
  const errors = {}

  if (!data.available_from) {
    errors.available_from = 'Please select available from date'
  }

  if (!data.deadline) {
    errors.deadline = 'Please select deadline date'
  }

  if (data.available_from && data.deadline) {
    const availableDate = new Date(data.available_from)
    const deadlineDate = new Date(data.deadline)

    if (availableDate > deadlineDate) {
      errors.deadline = 'Deadline must be after available from date'
    }
  }

  if (!data.images || data.images.length < 1) {
    errors.images = 'Please upload at least 1 image'
  }

  if (data.images && data.images.length > 10) {
    errors.images = 'Maximum 10 images allowed'
  }

  return errors
}

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
