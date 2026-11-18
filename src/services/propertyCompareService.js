import { supabase } from './supabaseClient'
import { MAX_COMPARE_ITEMS, toggleCompareId } from '../lib/propertyCompare.js'

export const COMPARE_PROPERTIES_STORAGE_KEY = 'compareProperties'
export const COMPARE_PROPERTIES_BROWSER_EVENT = 'compare-properties-updated'
export { MAX_COMPARE_ITEMS }

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

  try {
    localStorage.setItem(COMPARE_PROPERTIES_STORAGE_KEY, JSON.stringify(propertyIds))
  } catch (error) {
    console.error('Error saving compared properties:', error)
  }
  window.dispatchEvent(
    new CustomEvent(COMPARE_PROPERTIES_BROWSER_EVENT, {
      detail: { propertyIds },
    })
  )
}

export const getComparedPropertyIds = () => readStoredIds()

/**
 * Adds or removes a listing. Returns `limitReached: true` (and changes nothing) when the list
 * already holds MAX_COMPARE_ITEMS listings.
 */
export const toggleComparedProperty = (propertyId) => {
  if (!propertyId) {
    throw new Error('Property is required.')
  }

  const result = toggleCompareId(readStoredIds(), propertyId)

  if (!result.limitReached) {
    writeStoredIds(result.ids)
  }

  return {
    compared: result.ids.includes(propertyId),
    limitReached: result.limitReached,
    propertyIds: result.ids,
  }
}

export const removeComparedProperty = (propertyId) => {
  const nextIds = readStoredIds().filter((id) => id !== propertyId)
  writeStoredIds(nextIds)
  return nextIds
}

export const clearComparedProperties = () => {
  writeStoredIds([])
  return []
}

// Columns the compare table shows. All of them are in the public_property_catalog view, which
// already limits rows to approved, active, unexpired listings.
const COMPARE_SELECT =
  'id, property_id_number, category, property_type, total_rooms, total_bathrooms, balcony, total_kitchen, floor_level, occupancy, room_size_sqft, rent_amount_bdt, rent_period, is_rent_negotiable, state_district, area, sub_area, available_from, updated_at'

/**
 * Loads the compared listings in the order they were added, with their first photo and
 * facilities. Ids that no longer resolve (rented, expired, deleted) are returned in `missingIds`
 * so the page can drop them from the list.
 */
export const getComparedProperties = async (propertyIds = readStoredIds()) => {
  const ids = Array.isArray(propertyIds) ? propertyIds.filter(Boolean).slice(0, MAX_COMPARE_ITEMS) : []

  if (!ids.length) {
    return { items: [], missingIds: [] }
  }

  const [propertiesResult, imagesResult, amenitiesResult] = await Promise.all([
    supabase.from('public_property_catalog').select(COMPARE_SELECT).in('id', ids),
    supabase.from('property_images').select('property_id, image_url, display_order').in('property_id', ids).order('display_order'),
    supabase.from('property_amenities').select('property_id, amenity_type').in('property_id', ids),
  ])

  if (propertiesResult.error) {
    throw propertiesResult.error
  }

  const firstImageById = new Map()
  for (const row of imagesResult.data || []) {
    if (row?.image_url && !firstImageById.has(row.property_id)) {
      firstImageById.set(row.property_id, row.image_url)
    }
  }

  const amenitiesById = new Map()
  for (const row of amenitiesResult.data || []) {
    if (!row?.amenity_type) continue
    const list = amenitiesById.get(row.property_id) || []
    list.push(row.amenity_type)
    amenitiesById.set(row.property_id, list)
  }

  const byId = new Map(
    (propertiesResult.data || []).map((row) => [
      row.id,
      { ...row, primary_image: firstImageById.get(row.id) || null, amenities: amenitiesById.get(row.id) || [] },
    ])
  )

  return {
    items: ids.map((id) => byId.get(id)).filter(Boolean),
    missingIds: ids.filter((id) => !byId.has(id)),
  }
}
