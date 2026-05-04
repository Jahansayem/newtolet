export const COMPARE_PROPERTIES_STORAGE_KEY = 'compareProperties'
export const COMPARE_PROPERTIES_BROWSER_EVENT = 'compare-properties-updated'

const readStoredIds = () => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(COMPARE_PROPERTIES_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch (error) {
    console.error('Error reading compared properties:', error)
    return []
  }
}

const writeStoredIds = (propertyIds) => {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(COMPARE_PROPERTIES_STORAGE_KEY, JSON.stringify(propertyIds))
  window.dispatchEvent(
    new CustomEvent(COMPARE_PROPERTIES_BROWSER_EVENT, {
      detail: { propertyIds },
    })
  )
}

export const getComparedPropertyIds = () => readStoredIds()

export const toggleComparedProperty = (propertyId) => {
  if (!propertyId) {
    throw new Error('Property is required.')
  }

  const currentCompared = readStoredIds()
  const nextCompared = currentCompared.includes(propertyId)
    ? currentCompared.filter((id) => id !== propertyId)
    : [...currentCompared, propertyId]

  writeStoredIds(nextCompared)

  return {
    compared: nextCompared.includes(propertyId),
    propertyIds: nextCompared,
  }
}
