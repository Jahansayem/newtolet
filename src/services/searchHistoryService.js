import { supabase } from './supabaseClient'
import { getStoredUser } from './authService'

const TABLE_NAME = 'customer_search_history'

const isMissingTableError = (error) =>
  error?.code === 'PGRST205' ||
  error?.message?.includes(`Could not find the table '${TABLE_NAME}'`) ||
  error?.message?.includes(`relation "${TABLE_NAME}" does not exist`)

const createMissingTableError = () =>
  new Error(`Missing '${TABLE_NAME}' table. Run CREATE_CUSTOMER_SEARCH_HISTORY.sql in Supabase.`)

const normalizeLocation = (selectedLocation) => {
  if (!selectedLocation || typeof selectedLocation !== 'object') {
    return null
  }

  const normalizedLocation = {
    upazilla: selectedLocation.upazilla?.trim() || null,
    district: selectedLocation.district?.trim() || null,
    division: selectedLocation.division?.trim() || null,
    subArea:
      selectedLocation.subArea?.trim() ||
      selectedLocation.sub_area?.trim() ||
      null,
    area: selectedLocation.area?.trim() || null,
  }

  return Object.values(normalizedLocation).some(Boolean) ? normalizedLocation : null
}

const normalizeSearchRange = (selectedPriceRange, filters = {}) => {
  if (selectedPriceRange && selectedPriceRange !== 'All') {
    return selectedPriceRange
  }

  const segments = []
  if (filters.minPrice) segments.push(`min:${filters.minPrice}`)
  if (filters.maxPrice) segments.push(`max:${filters.maxPrice}`)
  if (filters.rooms) segments.push(`rooms:${filters.rooms}+`)

  return segments.join(' | ') || null
}

const normalizeSearchPayload = ({
  searchQuery = '',
  selectedLocation = null,
  selectedCategory = 'All',
  selectedPriceRange = 'All',
  filters = null,
  resultCount = 0,
  pagePath = '',
}) => {
  const storedUser = getStoredUser()
  const normalizedFilters = filters && typeof filters === 'object' ? filters : {}
  const normalizedSearchQuery = (searchQuery || normalizedFilters.search || '').trim()
  const normalizedPagePath =
    pagePath ||
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/')
  const normalizedLocation = normalizeLocation(selectedLocation || normalizedFilters)
  const normalizedCategory =
    (selectedCategory && selectedCategory !== 'All' ? selectedCategory : null) ||
    (normalizedFilters.category && normalizedFilters.category !== 'All'
      ? normalizedFilters.category
      : null)

  return {
    user_id: storedUser?.id || null,
    search_query: normalizedSearchQuery || null,
    selected_location: normalizedLocation,
    selected_category: normalizedCategory,
    selected_price_range: normalizeSearchRange(selectedPriceRange, normalizedFilters),
    result_count: Number.isFinite(resultCount) ? resultCount : 0,
    page_path: normalizedPagePath,
  }
}

export const logCustomerSearch = async (payload) => {
  try {
    const normalizedPayload = normalizeSearchPayload(payload)

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(normalizedPayload)
      .select()
      .single()

    if (error) {
      if (isMissingTableError(error)) {
        throw createMissingTableError()
      }

      throw error
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error logging customer search:', error)
    return { data: null, error }
  }
}

export const getCustomerSearchHistory = async () => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        users (
          id,
          name,
          email,
          phone
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTableError(error)) {
        throw createMissingTableError()
      }

      throw error
    }

    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching customer search history:', error)
    return { data: [], error }
  }
}
