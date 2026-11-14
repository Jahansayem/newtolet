import { supabase, isRecoverableSupabaseError } from './supabaseClient'
import { pruneSnapshotsByPrefix, readSnapshot, removeSnapshot, removeSnapshotsByPrefix, writeSnapshot } from './cacheService'
import {
  HOME_CATEGORIES,
  getPropertyCategoryValues,
  normalizePropertyCategory,
} from '../lib/propertyCategories'
import { getPropertyTypeValues } from '../lib/propertyTypes'
import { compareActivePinnedFirst, isPropertyActivelyPinned } from '../utils/propertyPinning'
import { extractExactPropertyIdNumber } from '../utils/propertyDisplaySerial'
import locationData from '../thetolet_locations_bundle.json'
import { createLocationIndex } from '../lib/search/locationIndex.js'
import { buildSearchPlan } from '../lib/search/queryPlan.js'
import { PAGE_SIZE, parseAmenityList, parsePageNumber } from '../lib/search/filterOptions.js'

const PROPERTY_IMAGES_BUCKET = 'property-images'
const RELATED_RECORD_BATCH_SIZE = 100
const HOMEPAGE_CATEGORY_ITEM_LIMIT = 6
const HOMEPAGE_PROPERTIES_LIMIT = 72
const SEARCHABLE_PROPERTIES_LIMIT = 200
const PROPERTY_CATALOG_CACHE_VERSION = 'v4'
const PUBLIC_PROPERTY_SELECT =
  'id, property_id_number, category, property_type, total_rooms, total_bathrooms, balcony, floor_level, occupancy, room_size_sqft, rent_amount_bdt, rent_period, state_district, area, sub_area, short_description, available_from, deadline, status, created_at, updated_at, reviewed_at, is_featured, is_active, is_pinned, pinned_at, pinned_until, total_kitchen, dining_rooms, living_rooms, is_rent_negotiable, lat, lng'

const DEFAULT_SEARCH_FILTERS = Object.freeze({
  search: '',
  division: '',
  district: '',
  upazilla: '',
  subArea: '',
  category: 'All',
  propertyType: 'All',
  minPrice: '',
  maxPrice: '',
  rooms: '',
  sort: 'newest',
})

const getErrorMessage = (error) => {
  if (!error) {
    return 'Unknown error'
  }

  if (typeof error === 'string') {
    return error
  }

  return error.message || error.details || error.hint || JSON.stringify(error)
}

const isSupabaseQuotaError = (error) => {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('exceed_storage_size_quota') ||
    message.includes('quota') ||
    message.includes('restricted')
  )
}

const isMissingDatabaseObjectError = (error) =>
  ['PGRST202', 'PGRST204', '42883', '42703'].includes(error?.code) ||
  /does not exist|Could not find/i.test(error?.message || '')

const isTransientFetchError = (error) => {
  const message = getErrorMessage(error).toLowerCase()
  return (
    error?.name === 'TypeError' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  )
}

const normalizeSearchFilters = (filters = {}) => ({
  ...DEFAULT_SEARCH_FILTERS,
  ...filters,
  search: String(filters.search || '').trim(),
  division: String(filters.division || '').trim(),
  district: String(filters.district || '').trim(),
  upazilla: String(filters.upazilla || '').trim(),
  subArea: String(filters.subArea || '').trim(),
  category: filters.category && filters.category !== 'All' ? String(filters.category).trim() : 'All',
  propertyType:
    filters.propertyType && filters.propertyType !== 'All'
      ? String(filters.propertyType).trim()
      : 'All',
  minPrice: String(filters.minPrice || '').replace(/[^\d]/g, ''),
  maxPrice: String(filters.maxPrice || '').replace(/[^\d]/g, ''),
  rooms: String(filters.rooms || '').replace(/[^\d]/g, ''),
  baths: String(filters.baths || '').replace(/[^\d]/g, ''),
  amenities: parseAmenityList(filters.amenities).join(','),
  occupancy: String(filters.occupancy || '').trim().toLowerCase(),
  includeNegotiable: filters.includeNegotiable === true || filters.includeNegotiable === '1',
  sort: filters.sort || DEFAULT_SEARCH_FILTERS.sort,
})

const getSearchCacheKey = (filters = {}) => {
  const normalizedFilters = normalizeSearchFilters(filters)
  return `properties:${PROPERTY_CATALOG_CACHE_VERSION}:search:${JSON.stringify(normalizedFilters)}`
}

export const getAllPropertiesCacheKey = (options = {}) => {
  const limit =
    Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 'all'
  const offset =
    Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : 0

  return `properties:${PROPERTY_CATALOG_CACHE_VERSION}:all:${limit}:${offset}`
}

export const getHomepagePropertiesCacheKey = () =>
  `properties:${PROPERTY_CATALOG_CACHE_VERSION}:homepage:${HOMEPAGE_PROPERTIES_LIMIT}`

export const getSearchablePropertiesCacheKey = (limit = SEARCHABLE_PROPERTIES_LIMIT) =>
  `properties:${PROPERTY_CATALOG_CACHE_VERSION}:searchable:${limit}`

const normalizePropertyImageUrl = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  if (/^https?:\/\//i.test(trimmedValue) || trimmedValue.startsWith('data:image/')) {
    return trimmedValue
  }

  const bucketPathMatch = trimmedValue.match(/(?:^|\/)property-images\/(.+)$/i)
  const objectPath = (bucketPathMatch?.[1] || trimmedValue).replace(/^\/+/, '')

  if (!objectPath) {
    return null
  }

  const { data } = supabase.storage.from(PROPERTY_IMAGES_BUCKET).getPublicUrl(objectPath)
  return data?.publicUrl || null
}

const groupPropertyImages = (images) => {
  const imagesByProperty = {}

  ;(images || []).forEach((img) => {
    const normalizedUrl = normalizePropertyImageUrl(img?.image_url)

    if (!img?.property_id || !normalizedUrl) {
      return
    }

    if (!imagesByProperty[img.property_id]) {
      imagesByProperty[img.property_id] = []
    }

    if (!imagesByProperty[img.property_id].includes(normalizedUrl)) {
      imagesByProperty[img.property_id].push(normalizedUrl)
    }
  })

  return imagesByProperty
}

const chunkArray = (items, chunkSize) => {
  const chunks = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

const fetchRelatedRowsInBatches = async ({
  table,
  select = '*',
  matchColumn = 'property_id',
  ids = [],
  orderColumn = null,
}) => {
  if (!ids.length) {
    return []
  }

  const batches = chunkArray(ids, RELATED_RECORD_BATCH_SIZE)
  const rows = []

  for (const batch of batches) {
    let query = supabase.from(table).select(select).in(matchColumn, batch)

    if (orderColumn) {
      query = query.order(orderColumn)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`)
    }

    rows.push(...(data || []))
  }

  return rows
}

const fetchOptionalRelatedRowsInBatches = async (options) => {
  try {
    return await fetchRelatedRowsInBatches(options)
  } catch (error) {
    const isExpectedFallback = isSupabaseQuotaError(error) || isRecoverableSupabaseError(error)

    if (process.env.NODE_ENV === 'development' && !isExpectedFallback) {
      const level = isTransientFetchError(error) ? 'warn' : 'error'
      console[level](
        `Continuing without ${options.table} after fetch failed: ${getErrorMessage(error)}`
      )
    }

    return []
  }
}

const mapPublicProperty = (property, imagesByProperty = {}, amenitiesByProperty = {}) => ({
  id: property.id,
  property_id_number: property.property_id_number,
  category: property.category,
  normalizedCategory: normalizePropertyCategory(property.category),
  property_type: property.property_type || 'Apartment',
  total_rooms: property.total_rooms || 0,
  dining_rooms: property.dining_rooms || 0,
  living_rooms: property.living_rooms || 0,
  total_bathrooms: property.total_bathrooms,
  total_balcony: property.balcony,
  total_kitchen: property.total_kitchen || null,
  floor_level: property.floor_level,
  room_size: property.room_size_sqft,
  occupancy: property.occupancy || null,
  specifications: {
    total_rooms: property.total_rooms || 0,
    dining_rooms: property.dining_rooms || 0,
    living_rooms: property.living_rooms || 0,
    total_bathrooms: property.total_bathrooms,
    total_balcony: property.balcony,
    total_kitchen: property.total_kitchen || null,
    floor_level: property.floor_level,
    room_size: property.room_size_sqft,
  },
  pricing: {
    rent_amount_bdt: property.rent_amount_bdt,
    rent_period: property.rent_period,
    is_rent_negotiable: Boolean(property.is_rent_negotiable),
  },
  location: {
    state_district: property.state_district,
    area: property.area,
    sub_area: property.sub_area || null,
    short_description: property.short_description,
  },
  amenities: amenitiesByProperty[property.id] || [],
  availability: {
    available_from: property.available_from,
    deadline: property.deadline,
  },
  images: imagesByProperty[property.id] || [],
  primary_image: imagesByProperty[property.id]?.[0] || null,
  lat: property.lat,
  lng: property.lng,
  status: property.status,
  is_active: property.is_active !== false,
  pinned_at: property.pinned_at || null,
  pinned_until: property.pinned_until || null,
  is_pinned: isPropertyActivelyPinned(property),
  created_at: property.created_at,
  reviewed_at: property.reviewed_at,
})

const buildAmenitiesByProperty = (amenities = []) => {
  const amenitiesByProperty = {}

  ;(amenities || []).forEach((amenity) => {
    if (!amenitiesByProperty[amenity.property_id]) {
      amenitiesByProperty[amenity.property_id] = []
    }

    amenitiesByProperty[amenity.property_id].push(amenity.amenity_type)
  })

  return amenitiesByProperty
}

const mapPublicProperties = (properties, images = [], amenities = []) => {
  const imagesByProperty = groupPropertyImages(images)
  const amenitiesByProperty = buildAmenitiesByProperty(amenities)

  return properties.map((property) =>
    mapPublicProperty(property, imagesByProperty, amenitiesByProperty)
  )
}

const sortPublicProperties = (properties = []) =>
  [...properties].sort((left, right) => {
    const pinComparison = compareActivePinnedFirst(left, right)

    if (pinComparison !== 0) {
      return pinComparison
    }

    return new Date(right?.created_at || 0).getTime() - new Date(left?.created_at || 0).getTime()
  })

// expires_at arrives with migration 20261114120000_qa_listing_quality.sql. Probe once per session
// so this build works before and after the migration (the expiry filter switches on by itself).
let expiryColumnProbe = null
let hasExpiryColumn = false

export const ensureCatalogCapabilities = () => {
  if (!expiryColumnProbe) {
    expiryColumnProbe = supabase
      .from('properties')
      .select('expires_at', { head: true })
      .limit(1)
      .then(({ error }) => {
        hasExpiryColumn = !error
        if (error && !isMissingDatabaseObjectError(error)) {
          // Network trouble, not a missing column: probe again next time.
          expiryColumnProbe = null
        }
      })
      .catch(() => {
        expiryColumnProbe = null
      })
  }

  return expiryColumnProbe || Promise.resolve()
}

/** Rows the public may see: approved, active, not soft-deleted, not expired. */
export const applyPublicVisibility = (query) => {
  const visible = query.eq('status', 'approved').neq('is_active', false).is('deleted_at', null)
  return hasExpiryColumn ? visible.gt('expires_at', new Date().toISOString()) : visible
}

// PostgREST returns at most 1000 rows per request (max_rows), so "everything" must be paged.
const POSTGREST_MAX_ROWS = 1000
const FULL_CATALOG_CAP = 3000

/**
 * Newest public listings. With `limit`, one ranged request. Without it, pages through the catalog
 * up to FULL_CATALOG_CAP rows (the old single request silently stopped at 1000 rows).
 */
const fetchPublicProperties = async ({ select = PUBLIC_PROPERTY_SELECT, limit = null, offset = 0 } = {}) => {
  await ensureCatalogCapabilities()
  const fetchRange = async (from, to) => {
    const { data, error } = await applyPublicVisibility(supabase.from('properties').select(select))
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    return data || []
  }

  if (limit) {
    return { properties: sortPublicProperties(await fetchRange(offset, offset + limit - 1)) }
  }

  const rows = []
  for (let from = offset; from < offset + FULL_CATALOG_CAP; from += POSTGREST_MAX_ROWS) {
    const page = await fetchRange(from, from + POSTGREST_MAX_ROWS - 1)
    rows.push(...page)
    if (page.length < POSTGREST_MAX_ROWS) break
  }

  return { properties: sortPublicProperties(rows) }
}

export const invalidatePropertyCatalogSnapshots = () => {
  removeSnapshot(getAllPropertiesCacheKey())
  removeSnapshot(getHomepagePropertiesCacheKey())
  removeSnapshot(getSearchablePropertiesCacheKey())
  removeSnapshotsByPrefix(`properties:${PROPERTY_CATALOG_CACHE_VERSION}:search:`)
}

export const getAllProperties = async (options = {}) => {
  const cacheKey = getAllPropertiesCacheKey(options)

  try {
    const limit =
      Number.isInteger(options.limit) && options.limit > 0 ? options.limit : null
    const offset =
      Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : 0

    const { properties } = await fetchPublicProperties({ limit, offset })

    if (!properties || properties.length === 0) {
      writeSnapshot(cacheKey, [])
      return []
    }

    const propertyIds = properties.map((property) => property.id)
    const [allImages, allAmenities] = await Promise.all([
      fetchOptionalRelatedRowsInBatches({
        table: 'property_images',
        ids: propertyIds,
        orderColumn: 'display_order',
      }),
      fetchOptionalRelatedRowsInBatches({
        table: 'property_amenities',
        select: 'property_id, amenity_type',
        ids: propertyIds,
      }),
    ])

    const transformedProperties = mapPublicProperties(properties, allImages, allAmenities)

    writeSnapshot(cacheKey, transformedProperties)

    return transformedProperties
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    const isExpectedFallback = isSupabaseQuotaError(error) || isRecoverableSupabaseError(error)

    if (!isExpectedFallback) {
      console.error('Error fetching all properties:', errorMessage, error)
    }

    const cachedProperties = readSnapshot(cacheKey)
    if (cachedProperties) {
      if (process.env.NODE_ENV === 'development' && !isExpectedFallback) {
        console.warn('Using cached properties after fetch failed')
      }
      return cachedProperties
    }

    if (process.env.NODE_ENV === 'development' && !isExpectedFallback) {
      console.warn('Properties unavailable and no cache:', errorMessage)
    }

    return []
  }
}

const SEARCH_LOCATION_INDEX = createLocationIndex(locationData)
const MAX_PINNED_RESULTS = 6

/**
 * Applies a search plan (see lib/search/queryPlan.js) to a properties query. Everything happens in
 * SQL so `count: 'exact'` and `.range()` give a true total and real pages.
 */
const applySearchPlan = (query, filters, plan) => {
  let nextQuery = applyPublicVisibility(query)

  if (plan.logic) {
    nextQuery = nextQuery.or(plan.logic)
  }

  plan.amenities.forEach((values, index) => {
    nextQuery = nextQuery.in(`amenity_filter_${index}.amenity_type`, values)
  })

  if (plan.category !== 'All') {
    nextQuery = nextQuery.in('category', getPropertyCategoryValues(plan.category))
  }

  if (plan.propertyType !== 'All') {
    nextQuery = nextQuery.in('property_type', getPropertyTypeValues(plan.propertyType))
  }

  if (plan.occupancyValues.length) {
    nextQuery = nextQuery.in('occupancy', plan.occupancyValues)
  }

  // With "include price on request" the range lives inside plan.logic as an OR branch.
  if (!filters.includeNegotiable && (filters.minPrice || filters.maxPrice)) {
    nextQuery = nextQuery.not('is_rent_negotiable', 'is', true)
    if (filters.minPrice) nextQuery = nextQuery.gte('rent_amount_bdt', Number(filters.minPrice))
    if (filters.maxPrice) nextQuery = nextQuery.lte('rent_amount_bdt', Number(filters.maxPrice))
  }

  if (filters.rooms) {
    nextQuery = nextQuery.gte('total_rooms', Number(filters.rooms))
  }

  if (filters.baths) {
    nextQuery = nextQuery.gte('total_bathrooms', Number(filters.baths))
  }

  return nextQuery
}

const searchSelect = (plan) =>
  plan.amenities.reduce(
    (select, _values, index) => `${select}, amenity_filter_${index}:property_amenities!inner(amenity_type)`,
    PUBLIC_PROPERTY_SELECT
  )

/**
 * Price sorts put listings with a real price first and "Negotiable"/price-on-request last, so a
 * cheap-first list never starts with unpriced cards. Newest is the default.
 */
const applyPagedSortOrder = (query, sort) => {
  if (sort === 'price_low' || sort === 'price_high') {
    return query
      .order('is_rent_negotiable', { ascending: true, nullsFirst: true })
      .order('rent_amount_bdt', { ascending: sort === 'price_low', nullsFirst: false })
      .order('created_at', { ascending: false })
  }

  if (sort === 'oldest') {
    return query.order('created_at', { ascending: true })
  }

  return query.order('created_at', { ascending: false })
}

const stripSearchJoins = (rows = []) =>
  rows.map((row) => {
    const clean = { ...row }
    Object.keys(clean).forEach((key) => {
      if (key.startsWith('amenity_filter_')) delete clean[key]
    })
    return clean
  })

const attachImagesAndAmenities = async (rows = []) => {
  if (!rows.length) {
    return []
  }

  const propertyIds = rows.map((property) => property.id)
  const [allImages, allAmenities] = await Promise.all([
    fetchOptionalRelatedRowsInBatches({ table: 'property_images', ids: propertyIds, orderColumn: 'display_order' }),
    fetchOptionalRelatedRowsInBatches({ table: 'property_amenities', select: 'property_id, amenity_type', ids: propertyIds }),
  ])

  return mapPublicProperties(rows, allImages, allAmenities)
}

/**
 * One page of search results with a true total.
 *
 * Active paid pins ("Featured") come from a separate small query: they lead page 1 and are
 * excluded from the paged list so they never repeat or shift page boundaries.
 *
 * @returns {Promise<{
 *   properties: object[], featured: object[], total: number, page: number, pageCount: number,
 *   pageSize: number, place: null|{type, name}, suggestion: string,
 *   source: 'live'|'cache-search'|'none', error: null|{code, message}
 * }>}
 */
export const searchPropertiesWithStatus = async (filters = {}, { page = 1, pageSize = PAGE_SIZE } = {}) => {
  const normalizedFilters = normalizeSearchFilters(filters)
  const safePage = parsePageNumber(page)
  const cacheKey = `${getSearchCacheKey(normalizedFilters)}:page:${safePage}`
  const plan = buildSearchPlan(normalizedFilters, SEARCH_LOCATION_INDEX)
  const meta = {
    page: safePage,
    pageSize,
    place: plan.place ? { type: plan.place.type, name: plan.place.name } : null,
    suggestion: plan.suggestion,
  }

  if (plan.empty) {
    return { ...meta, emptyQuery: true, properties: [], featured: [], total: 0, pageCount: 0, source: 'live', error: null }
  }

  try {
    await ensureCatalogCapabilities()
    const select = searchSelect(plan)
    const nowIso = new Date().toISOString()

    const { data: pinnedRows, error: pinnedError } = await applySearchPlan(
      supabase.from('properties').select(select),
      normalizedFilters,
      plan
    )
      .gt('pinned_until', nowIso)
      .order('pinned_until', { ascending: false })
      .limit(MAX_PINNED_RESULTS)

    if (pinnedError) {
      throw pinnedError
    }

    const pinnedIds = (pinnedRows || []).map((row) => row.id)
    const from = (safePage - 1) * pageSize
    let mainQuery = applySearchPlan(
      supabase.from('properties').select(select, { count: 'exact' }),
      normalizedFilters,
      plan
    )

    if (pinnedIds.length) {
      mainQuery = mainQuery.not('id', 'in', `(${pinnedIds.join(',')})`)
    }

    const { data: pageRows, count, error } = await applyPagedSortOrder(mainQuery, normalizedFilters.sort)
      .range(from, from + pageSize - 1)

    if (error) {
      throw error
    }

    const [featuredRaw, propertiesRaw] = await Promise.all([
      safePage === 1 ? attachImagesAndAmenities(stripSearchJoins(pinnedRows || [])) : Promise.resolve([]),
      attachImagesAndAmenities(stripSearchJoins(pageRows || [])),
    ])
    const verifiedIds = await getVerifiedOwnerPropertyIds([...featuredRaw, ...propertiesRaw].map((row) => row.id))
    const markVerified = (row) => ({ ...row, owner_verified: verifiedIds.has(row.id) })
    const featured = featuredRaw.map(markVerified)
    const properties = propertiesRaw.map(markVerified)
    const total = (count || 0) + pinnedIds.length
    const result = {
      ...meta,
      properties,
      featured,
      total,
      pageCount: Math.max(1, Math.ceil((count || 0) / pageSize)),
      source: 'live',
      error: null,
    }

    writeSnapshot(cacheKey, { properties, featured, total, pageCount: result.pageCount })
    pruneSnapshotsByPrefix(`properties:${PROPERTY_CATALOG_CACHE_VERSION}:search:`, 30)
    return result
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    const isRecoverable = isSupabaseQuotaError(error) || isRecoverableSupabaseError(error)

    if (!isRecoverable) {
      console.error('Error searching properties:', errorMessage, error)
    }

    const status = { code: isRecoverable ? 'unavailable' : 'failed', message: errorMessage }
    const cached = readSnapshot(cacheKey)

    if (cached && Array.isArray(cached.properties)) {
      return { ...meta, ...cached, source: 'cache-search', error: status }
    }

    return { ...meta, properties: [], featured: [], total: 0, pageCount: 0, source: 'none', error: status }
  }
}

export const searchProperties = async (filters = {}, options = {}) =>
  (await searchPropertiesWithStatus(filters, options)).properties

const PROPERTY_ID_LOOKUP_RPC = 'find_public_property_id_by_number'

const isMissingPropertyIdLookupRpcError = (error) =>
  error?.code === 'PGRST202' ||
  error?.code === '42883' ||
  error?.message?.includes(`Could not find the function public.${PROPERTY_ID_LOOKUP_RPC}`)

/**
 * Resolve a public Property ID ("100001", "ID: 100001", "#100001") to the listing's uuid.
 * Only approved, active listings resolve. Pending, unknown, non-numeric input and an
 * unreachable service all return null so the caller falls back to a normal keyword search.
 */
export const findPublicPropertyIdByNumber = async (value) => {
  const idNumber = extractExactPropertyIdNumber(value)

  if (!idNumber) {
    return null
  }

  try {
    const { data, error } = await supabase.rpc(PROPERTY_ID_LOOKUP_RPC, { p_number: idNumber })

    if (!error) {
      return typeof data === 'string' && data ? data : null
    }

    if (!isMissingPropertyIdLookupRpcError(error)) {
      throw error
    }

    // Database without the RPC yet: direct read (only works where a public SELECT policy exists).
    const { data: rows, error: queryError } = await supabase
      .from('properties')
      .select('id')
      .eq('property_id_number', idNumber)
      .eq('status', 'approved')
      .neq('is_active', false)
      .limit(1)

    if (queryError) {
      throw queryError
    }

    return rows?.[0]?.id || null
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Property ID lookup failed:', getErrorMessage(error))
    }
    return null
  }
}

export const getHomepageProperties = async () => {
  const cacheKey = getHomepagePropertiesCacheKey()

  try {
    await ensureCatalogCapabilities()
    // One small query per category, in parallel. The old loop re-downloaded the whole catalog
    // for every 72-row step until each category had 6 items (minutes on slow connections).
    const nowIso = new Date().toISOString()
    const categoryRows = await Promise.all(
      HOME_CATEGORIES.map(async (category) => {
        const values = getPropertyCategoryValues(category)
        const [pinnedResult, latestResult] = await Promise.all([
          applyPublicVisibility(supabase.from('properties').select(PUBLIC_PROPERTY_SELECT))
            .in('category', values)
            .gt('pinned_until', nowIso)
            .order('pinned_until', { ascending: false })
            .limit(HOMEPAGE_CATEGORY_ITEM_LIMIT),
          applyPublicVisibility(supabase.from('properties').select(PUBLIC_PROPERTY_SELECT))
            .in('category', values)
            .order('created_at', { ascending: false })
            .limit(HOMEPAGE_CATEGORY_ITEM_LIMIT),
        ])

        if (latestResult.error) {
          throw latestResult.error
        }

        return [...(pinnedResult.data || []), ...(latestResult.data || [])]
      })
    )

    const selectedPropertyIds = new Set()
    const homepagePropertiesByCategory = {}
    HOME_CATEGORIES.forEach((category, categoryIndex) => {
      homepagePropertiesByCategory[category] = sortPublicProperties(categoryRows[categoryIndex])
        .filter((property) => {
          if (selectedPropertyIds.has(property.id)) return false
          selectedPropertyIds.add(property.id)
          return true
        })
        .slice(0, HOMEPAGE_CATEGORY_ITEM_LIMIT)
    })

    const selectedProperties = HOME_CATEGORIES.flatMap(
      (category) => homepagePropertiesByCategory[category]
    )

    if (!selectedProperties.length) {
      writeSnapshot(cacheKey, [])
      return []
    }

    const propertyIds = selectedProperties.map((property) => property.id)

    const [allImages, allAmenities] = await Promise.all([
      fetchOptionalRelatedRowsInBatches({
        table: 'property_images',
        ids: propertyIds,
        orderColumn: 'display_order',
      }),
      fetchOptionalRelatedRowsInBatches({
        table: 'property_amenities',
        select: 'property_id, amenity_type',
        ids: propertyIds,
      }),
    ])

    const transformedProperties = await withOwnerVerification(
      mapPublicProperties(selectedProperties, allImages, allAmenities)
    )

    writeSnapshot(cacheKey, transformedProperties)

    return transformedProperties
  } catch (error) {
    const cachedProperties = readSnapshot(cacheKey)
    if (cachedProperties) {
      if (process.env.NODE_ENV === 'development' && !isSupabaseQuotaError(error)) {
        console.warn(
          `Using cached homepage properties after fetch failed: ${getErrorMessage(error)}`
        )
      }

      return cachedProperties
    }

    if (process.env.NODE_ENV === 'development' && !isSupabaseQuotaError(error)) {
      console.warn(`Homepage properties unavailable: ${getErrorMessage(error)}`)
    }

    return []
  }
}

export const getSearchableProperties = async (limit = SEARCHABLE_PROPERTIES_LIMIT) => {
  const cacheKey = getSearchablePropertiesCacheKey(limit)

  try {
    const { properties } = await fetchPublicProperties({
      select:
        'id, property_id_number, category, property_type, rent_amount_bdt, is_rent_negotiable, state_district, area, sub_area, short_description, created_at, status, is_active, is_pinned, pinned_at, pinned_until',
      limit,
    })

    if (!properties || properties.length === 0) {
      writeSnapshot(cacheKey, [])
      return []
    }

    const propertyIds = properties.map((property) => property.id)
    const images = await fetchOptionalRelatedRowsInBatches({
      table: 'property_images',
      select: 'property_id, image_url, is_thumbnail, display_order',
      ids: propertyIds,
      orderColumn: 'display_order',
    })

    const imagesByProperty = groupPropertyImages(
      [...(images || [])].sort((left, right) => {
        const leftWeight = left?.is_thumbnail ? -1 : 0
        const rightWeight = right?.is_thumbnail ? -1 : 0
        return leftWeight - rightWeight
      })
    )

    const transformedProperties = properties.map((property) => ({
      id: property.id,
      property_id_number: property.property_id_number,
      category: property.category,
      normalizedCategory: normalizePropertyCategory(property.category),
      property_type: property.property_type || 'Apartment',
      pricing: {
        rent_amount_bdt: property.rent_amount_bdt,
        is_rent_negotiable: Boolean(property.is_rent_negotiable),
      },
      location: {
        state_district: property.state_district,
        area: property.area,
        sub_area: property.sub_area || null,
        short_description: property.short_description,
      },
      images: imagesByProperty[property.id] ? [imagesByProperty[property.id][0]] : [],
      primary_image: imagesByProperty[property.id]?.[0] || null,
      created_at: property.created_at,
      status: property.status,
      is_active: property.is_active !== false,
      pinned_at: property.pinned_at || null,
      pinned_until: property.pinned_until || null,
      is_pinned: isPropertyActivelyPinned(property),
    }))

    writeSnapshot(cacheKey, transformedProperties)

    return transformedProperties
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    const isExpectedFallback = isSupabaseQuotaError(error) || isRecoverableSupabaseError(error)

    if (!isExpectedFallback) {
      console.error('Error fetching searchable properties:', errorMessage, error)
    }

    const cachedProperties = readSnapshot(cacheKey)
    if (cachedProperties) {
      if (process.env.NODE_ENV === 'development' && !isExpectedFallback) {
        console.warn('Using cached searchable properties after fetch failed')
      }
      return cachedProperties
    }

    if (process.env.NODE_ENV === 'development' && !isExpectedFallback) {
      console.warn('Searchable properties unavailable and no cache:', errorMessage)
    }

    return []
  }
}

// ---------------------------------------------------------------------------------------------
// Trust and discovery helpers (QA audit 2026-11-14)


/**
 * Ids (of the given ones) whose owner has a verified account. Empty set when the lookup function
 * is not deployed yet or the request fails: a missing badge is better than a broken page.
 */
export const getVerifiedOwnerPropertyIds = async (propertyIds = []) => {
  const ids = [...new Set(propertyIds.filter(Boolean))].slice(0, 200)

  if (!ids.length) {
    return new Set()
  }

  const { data, error } = await supabase.rpc('verified_owner_property_ids', { p_property_ids: ids })

  if (error) {
    if (process.env.NODE_ENV === 'development' && !isMissingDatabaseObjectError(error)) {
      console.warn(`Verified-owner lookup failed: ${getErrorMessage(error)}`)
    }
    return new Set()
  }

  return new Set((data || []).map((row) => (typeof row === 'string' ? row : row?.verified_owner_property_ids || row?.id)).filter(Boolean))
}

/** Adds `owner_verified: true|false` to mapped properties (one request for the whole list). */
export const withOwnerVerification = async (properties = []) => {
  if (!properties.length) {
    return properties
  }

  const verifiedIds = await getVerifiedOwnerPropertyIds(properties.map((property) => property.id))
  return properties.map((property) => ({ ...property, owner_verified: verifiedIds.has(property.id) }))
}

/** WhatsApp opt-in and expiry date for one listing (columns added 2026-11-14). */
export const getListingExtras = async (propertyId) => {
  const empty = { whatsappEnabled: false, expiresAt: null }

  if (!propertyId) {
    return empty
  }

  const { data, error } = await supabase
    .from('properties')
    .select('whatsapp_enabled, expires_at')
    .eq('id', propertyId)
    .maybeSingle()

  if (error || !data) {
    return empty
  }

  return { whatsappEnabled: data.whatsapp_enabled === true, expiresAt: data.expires_at || null }
}

const SIMILAR_LIMIT = 6

/**
 * Listings like this one: same category in the same area first, then the same district.
 * `property` uses the detail shape ({ id, category, location: { area, state_district } }).
 */
export const getSimilarProperties = async (property = {}) => {
  const district = String(property.location?.state_district || property.state_district || '').trim()
  const area = String(property.location?.area || property.area || '').trim()

  if (!property.id || !district) {
    return []
  }

  try {
    await ensureCatalogCapabilities()
    const base = () => {
      let query = applyPublicVisibility(supabase.from('properties').select(PUBLIC_PROPERTY_SELECT))
        .neq('id', property.id)
        .ilike('state_district', `${district}%`)
        .order('created_at', { ascending: false })
        .limit(SIMILAR_LIMIT)

      if (property.category) {
        query = query.in('category', getPropertyCategoryValues(property.category))
      }

      return query
    }

    const rows = []

    if (area && area.toLowerCase() !== district.toLowerCase()) {
      const { data, error } = await base().or(`area.ilike."%${area.replace(/"/g, '')}%",sub_area.ilike."%${area.replace(/"/g, '')}%"`)
      if (error) throw error
      rows.push(...(data || []))
    }

    if (rows.length < SIMILAR_LIMIT) {
      const { data, error } = await base()
      if (error) throw error
      ;(data || []).forEach((row) => {
        if (rows.length < SIMILAR_LIMIT && !rows.some((existing) => existing.id === row.id)) rows.push(row)
      })
    }

    return withOwnerVerification(await attachImagesAndAmenities(rows))
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Similar listings unavailable: ${getErrorMessage(error)}`)
    }
    return []
  }
}

/**
 * How many public listings match `filters` and were created after `sinceIso` (saved-search
 * alerts). Head request: no rows are downloaded.
 */
export const countNewListings = async (filters = {}, sinceIso = null) => {
  const normalizedFilters = normalizeSearchFilters(filters)
  const plan = buildSearchPlan(normalizedFilters, SEARCH_LOCATION_INDEX)

  if (plan.empty) {
    return 0
  }

  await ensureCatalogCapabilities()
  let query = applySearchPlan(
    supabase.from('properties').select(searchSelect(plan), { count: 'exact', head: true }),
    normalizedFilters,
    plan
  )

  if (sinceIso) {
    query = query.gt('created_at', sinceIso)
  }

  const { count, error } = await query
  if (error) {
    throw error
  }

  return count || 0
}
