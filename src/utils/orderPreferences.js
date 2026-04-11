const ORDER_PREFERENCES_VERSION = 'order_preferences_v1'

const isNonEmpty = (value) => typeof value === 'string' && value.trim() !== ''

const cleanObject = (value) => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const entries = Object.entries(value).filter(([, entryValue]) => {
    if (typeof entryValue === 'string') {
      return isNonEmpty(entryValue)
    }

    if (Array.isArray(entryValue)) {
      return entryValue.length > 0
    }

    return entryValue != null
  })

  return entries.length ? Object.fromEntries(entries) : null
}

const formatLocation = (location) => {
  if (!location) {
    return ''
  }

  return [location.area, location.district, location.division]
    .filter(isNonEmpty)
    .join(', ')
}

export const serializeOrderPreferences = ({
  locations = [],
  gender,
  bathRoom,
  notes,
  kitchenFacility,
  gasFacility,
  livingSpace,
  roomSharing,
  floorPreference,
  liftFacility,
  parkingFacility,
}) => {
  const extraLocations = Array.isArray(locations)
    ? locations
        .slice(1)
        .map((location) => cleanObject(location))
        .filter(Boolean)
    : []

  const primaryRequirements = cleanObject({
    gender,
    bathRoom,
  })

  const additionalRequirements = cleanObject({
    kitchenFacility,
    gasFacility,
    livingSpace,
    roomSharing,
    floorPreference,
    liftFacility,
    parkingFacility,
  })

  const payload = cleanObject({
    version: ORDER_PREFERENCES_VERSION,
    extraLocations,
    primaryRequirements,
    additionalRequirements,
    notes: isNonEmpty(notes) ? notes.trim() : null,
  })

  if (!payload || Object.keys(payload).length === 1) {
    return null
  }

  return JSON.stringify(payload)
}

export const parseOrderPreferences = (rawPreferences) => {
  if (!isNonEmpty(rawPreferences)) {
    return null
  }

  try {
    const parsed = JSON.parse(rawPreferences)

    if (parsed?.version === ORDER_PREFERENCES_VERSION) {
      return parsed
    }
  } catch (error) {
    // Legacy plain-text preferences should continue to render.
  }

  return {
    legacyText: rawPreferences,
  }
}

export const formatOrderNeedFrom = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const formatOrderPreferencesSummary = (rawPreferences) => {
  const parsed = parseOrderPreferences(rawPreferences)

  if (!parsed) {
    return ''
  }

  if (parsed.legacyText) {
    return parsed.legacyText
  }

  const summary = []

  if (Array.isArray(parsed.extraLocations) && parsed.extraLocations.length > 0) {
    summary.push(
      `Extra locations: ${parsed.extraLocations
        .map((location) => formatLocation(location))
        .filter(Boolean)
        .join(' | ')}`
    )
  }

  const gender = parsed.primaryRequirements?.gender
  if (isNonEmpty(gender)) {
    summary.push(`Gender: ${gender}`)
  }

  const bathRoom = parsed.primaryRequirements?.bathRoom
  if (isNonEmpty(bathRoom)) {
    summary.push(`Bath room: ${bathRoom}`)
  }

  const requirementLabels = {
    kitchenFacility: 'Kitchen',
    gasFacility: 'Gas',
    livingSpace: 'Living space',
    roomSharing: 'Room sharing',
    floorPreference: 'Floor',
    liftFacility: 'Lift',
    parkingFacility: 'Parking',
  }

  Object.entries(requirementLabels).forEach(([key, label]) => {
    const value = parsed.additionalRequirements?.[key]
    if (isNonEmpty(value)) {
      summary.push(`${label}: ${value}`)
    }
  })

  if (isNonEmpty(parsed.notes)) {
    summary.push(`Notes: ${parsed.notes}`)
  }

  return summary.join(' | ')
}
