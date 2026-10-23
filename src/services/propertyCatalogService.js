import { supabase, isRecoverableSupabaseError } from './supabaseClient'
import { readSnapshot, removeSnapshot, removeSnapshotsByPrefix, writeSnapshot } from './cacheService'
import {
  HOME_CATEGORIES,
  getPropertyCategoryValues,
  matchesPropertyCategory,
  normalizePropertyCategory,
} from '../lib/propertyCategories'
import { getPropertyTypeValues, matchesPropertyTypeOption } from '../lib/propertyTypes'
import { compareActivePinnedFirst, isPropertyActivelyPinned } from '../utils/propertyPinning'
import { extractExactPropertyIdNumber, stripPropertyIdPrefix } from '../utils/propertyDisplaySerial'
import locationData from '../thetolet_locations_bundle.json'

const PROPERTY_IMAGES_BUCKET = 'property-images'
const RELATED_RECORD_BATCH_SIZE = 100
const HOMEPAGE_CATEGORY_ITEM_LIMIT = 6
const HOMEPAGE_PROPERTIES_LIMIT = 72
const SEARCHABLE_PROPERTIES_LIMIT = 200
const SEARCH_RESULTS_LIMIT = 500
const PROPERTY_CATALOG_CACHE_VERSION = 'v3'
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

const isTransientFetchError = (error) => {
  const message = getErrorMessage(error).toLowerCase()
  return (
    error?.name === 'TypeError' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  )
}

const locationIndex = (() => {
  const districtsByDivision = {}
  const divisions = []
  const divisionByKey = {}
  const districtByKey = {}
  const upazillaByKey = {}
  const subAreaByKey = {}
  const districtToDivision = {}
  const upazillaToDistrict = {}
  const upazillaToDivision = {}
  const subAreaToUpazilla = {}
  const subAreaToDistrict = {}
  const subAreaToDivision = {}

  ;(locationData?.divisions || []).forEach((division) => {
    const divisionName = division?.name || ''

    if (!divisionName) {
      return
    }

    divisions.push(divisionName)
    divisionByKey[divisionName.toLowerCase()] = divisionName
    districtsByDivision[divisionName.toLowerCase()] = (division.districts || [])
      .map((district) => district?.name)
      .filter(Boolean)

    ;(division.districts || []).forEach((district) => {
      const districtName = district?.name || ''

      if (!districtName) {
        return
      }

      districtByKey[districtName.toLowerCase()] = districtName
      districtToDivision[districtName.toLowerCase()] = divisionName

      ;(district.upazillas || []).forEach((upazilla) => {
        const upazillaName = upazilla?.name || ''

        if (!upazillaName) {
          return
        }

        upazillaByKey[upazillaName.toLowerCase()] = upazillaName
        upazillaToDistrict[upazillaName.toLowerCase()] = districtName
        upazillaToDivision[upazillaName.toLowerCase()] = divisionName

        ;(upazilla.sub_areas || []).forEach((subArea) => {
          if (!subArea) {
            return
          }

          subAreaByKey[subArea.toLowerCase()] = subArea
          subAreaToUpazilla[subArea.toLowerCase()] = upazillaName
          subAreaToDistrict[subArea.toLowerCase()] = districtName
          subAreaToDivision[subArea.toLowerCase()] = divisionName
        })
      })
    })
  })

  return {
    divisions,
    districtsByDivision,
    divisionByKey,
    districtByKey,
    upazillaByKey,
    subAreaByKey,
    districtToDivision,
    upazillaToDistrict,
    upazillaToDivision,
    subAreaToUpazilla,
    subAreaToDistrict,
    subAreaToDivision,
  }
})()

// Users paste the label as shown on cards ("ID: 100001"); match on the bare value.
const normalizeSearchText = (value) => stripPropertyIdPrefix(value).toLowerCase()

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
  sort: filters.sort || DEFAULT_SEARCH_FILTERS.sort,
})

const getSearchCacheKey = (filters = {}) => {
  const normalizedFilters = normalizeSearchFilters(filters)
  return `properties:${PROPERTY_CATALOG_CACHE_VERSION}:search:${JSON.stringify(normalizedFilters)}`
}

const escapePostgrestPatternValue = (value = '') =>
  String(value).replace(/[\\%_*]/g, '\\$&').replace(/[(),]/g, ' ')

const getKeywordSearchTerms = (search = '') =>
  Array.from(new Set([
    search,
    ...String(search || '').split(/\s+/),
  ]
    .map((term) => escapePostgrestPatternValue(term).trim())
    .filter((term) => term.length >= 2)))

const getDivisionDistrictValues = (division = '') => {
  const normalizedDivision = division.trim()
  const districts = locationIndex.districtsByDivision[normalizedDivision.toLowerCase()] || []
  return Array.from(new Set([normalizedDivision, ...districts].filter(Boolean)))
}

const getMatchedLocationValues = (search = '') => {
  const normalizedSearch = normalizeSearchText(search)
  const stateDistrictValues = new Set()
  const areaValues = new Set()
  const subAreaValues = new Set()
  const divisionValues = new Set()

  if (normalizedSearch.length < 2) {
    return {
      stateDistrictValues: [],
      areaValues: [],
      subAreaValues: [],
      divisionValues: [],
    }
  }

  const matchesSearch = (value = '') => normalizeSearchText(value).includes(normalizedSearch)

  locationIndex.divisions.forEach((division) => {
    if (!matchesSearch(division)) {
      return
    }

    divisionValues.add(division)
    getDivisionDistrictValues(division).forEach((value) => stateDistrictValues.add(value))
  })

  Object.entries(locationIndex.districtByKey).forEach(([districtKey, district]) => {
    if (!districtKey.includes(normalizedSearch)) {
      return
    }

    stateDistrictValues.add(district)
    const division = locationIndex.districtToDivision[districtKey]

    if (division) {
      divisionValues.add(division)
    }
  })

  Object.entries(locationIndex.upazillaByKey).forEach(([upazillaKey, upazilla]) => {
    if (!upazillaKey.includes(normalizedSearch)) {
      return
    }

    areaValues.add(upazilla)
    const district = locationIndex.upazillaToDistrict[upazillaKey]
    const division = locationIndex.upazillaToDivision[upazillaKey]

    if (district) {
      stateDistrictValues.add(district)
    }

    if (division) {
      divisionValues.add(division)
    }
  })

  Object.entries(locationIndex.subAreaByKey).forEach(([subAreaKey, subArea]) => {
    if (!subAreaKey.includes(normalizedSearch)) {
      return
    }

    subAreaValues.add(subArea)
    const upazilla = locationIndex.subAreaToUpazilla[subAreaKey]
    const district = locationIndex.subAreaToDistrict[subAreaKey]
    const division = locationIndex.subAreaToDivision[subAreaKey]

    if (upazilla) {
      areaValues.add(upazilla)
    }

    if (district) {
      stateDistrictValues.add(district)
    }

    if (division) {
      divisionValues.add(division)
    }
  })

  return {
    stateDistrictValues: [...stateDistrictValues],
    areaValues: [...areaValues],
    subAreaValues: [...subAreaValues],
    divisionValues: [...divisionValues],
  }
}

const getPropertyLocationSearchValues = (property = {}) => {
  const stateDistrict = property.location?.state_district ?? property.state_district
  const area = property.location?.area ?? property.area
  const subArea = property.location?.sub_area ?? property.sub_area
  const values = [stateDistrict, area, subArea]
  const stateDistrictKey = normalizeSearchText(stateDistrict)
  const areaKey = normalizeSearchText(area)
  const subAreaKey = normalizeSearchText(subArea)

  if (locationIndex.divisionByKey[stateDistrictKey]) {
    values.push(locationIndex.divisionByKey[stateDistrictKey])
  }

  if (locationIndex.districtToDivision[stateDistrictKey]) {
    values.push(locationIndex.districtToDivision[stateDistrictKey])
  }

  if (locationIndex.upazillaToDistrict[areaKey]) {
    values.push(locationIndex.upazillaToDistrict[areaKey], locationIndex.upazillaToDivision[areaKey])
  }

  if (locationIndex.subAreaToUpazilla[subAreaKey]) {
    values.push(
      locationIndex.subAreaToUpazilla[subAreaKey],
      locationIndex.subAreaToDistrict[subAreaKey],
      locationIndex.subAreaToDivision[subAreaKey]
    )
  }

  return Array.from(new Set(values.filter(Boolean)))
}

const getGeneratedPropertySearchText = (property = {}) => {
  const stateDistrict = property.location?.state_district ?? property.state_district
  const area = property.location?.area ?? property.area
  const subArea = property.location?.sub_area ?? property.sub_area
  const category = property.category
  const propertyType = property.property_type

  return [
    [category, propertyType].filter(Boolean).join(' '),
    [category, propertyType, area, stateDistrict].filter(Boolean).join(' '),
    [propertyType, area, subArea, stateDistrict].filter(Boolean).join(' '),
    [category, 'property', area, stateDistrict].filter(Boolean).join(' '),
  ]
}

const matchesSearchKeyword = (property = {}, search = '') => {
  const normalizedSearch = normalizeSearchText(search)

  if (!normalizedSearch) {
    return true
  }

  const searchableValues = [
    property.id,
    property.property_id_number,
    property.category,
    property.property_type,
    property.floor_level,
    property.occupancy,
    property.pricing?.rent_period ?? property.rent_period,
    property.search_related_text,
    ...getPropertyLocationSearchValues(property),
    property.location?.short_description ?? property.short_description,
    property.pricing?.rent_amount_bdt ?? property.rent_amount_bdt,
    ...(Array.isArray(property.amenities) ? property.amenities : []),
    ...getGeneratedPropertySearchText(property),
  ]

  const normalizedValues = searchableValues
    .filter((value) => value !== null && value !== undefined)
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
  const normalizedTokens = normalizedSearch.split(/\s+/).filter(Boolean)
  const searchableText = normalizedValues.join(' ')

  return (
    normalizedValues.some((value) => value.includes(normalizedSearch)) ||
    normalizedTokens.every((token) => searchableText.includes(token))
  )
}

const getPropertyRentAmount = (property = {}) => {
  const amount = Number(property?.pricing?.rent_amount_bdt ?? property?.rent_amount_bdt)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

const getPropertyRoomCount = (property = {}) =>
  Number(property?.total_rooms ?? property?.specifications?.total_rooms ?? 0)

const getPropertyLocationField = (property = {}, key) =>
  property?.location?.[key] ?? property?.[key] ?? ''

const matchesPropertyFilters = (property = {}, filters = {}) => {
  const normalizedFilters = normalizeSearchFilters(filters)
  const stateDistrict = String(getPropertyLocationField(property, 'state_district')).toLowerCase()
  const area = String(getPropertyLocationField(property, 'area')).toLowerCase()
  const subArea = String(getPropertyLocationField(property, 'sub_area')).toLowerCase()
  const divisionValues = normalizedFilters.division
    ? getDivisionDistrictValues(normalizedFilters.division).map((value) => value.toLowerCase())
    : []
  const rentAmount = getPropertyRentAmount(property)

  if (normalizedFilters.district && stateDistrict !== normalizedFilters.district.toLowerCase()) {
    return false
  }

  if (!normalizedFilters.district && normalizedFilters.division && !divisionValues.includes(stateDistrict)) {
    return false
  }

  if (normalizedFilters.upazilla && area !== normalizedFilters.upazilla.toLowerCase()) {
    return false
  }

  if (normalizedFilters.subArea && subArea !== normalizedFilters.subArea.toLowerCase()) {
    return false
  }

  if (!matchesPropertyCategory(property, normalizedFilters.category)) {
    return false
  }

  if (!matchesPropertyTypeOption(property.property_type, normalizedFilters.propertyType)) {
    return false
  }

  if (normalizedFilters.minPrice && (rentAmount === null || rentAmount < Number(normalizedFilters.minPrice))) {
    return false
  }

  if (normalizedFilters.maxPrice && (rentAmount === null || rentAmount > Number(normalizedFilters.maxPrice))) {
    return false
  }

  if (normalizedFilters.rooms && getPropertyRoomCount(property) < Number(normalizedFilters.rooms)) {
    return false
  }

  return matchesSearchKeyword(property, normalizedFilters.search)
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

const fetchPublicProperties = async ({ select = PUBLIC_PROPERTY_SELECT, limit = null, offset = 0 } = {}) => {
  let legacyQuery = supabase
    .from('properties')
    .select(select)
    .eq('status', 'approved')
    .neq('is_active', false)
    .order('created_at', { ascending: false })

  const { data: legacyData, error: legacyError } = await legacyQuery

  if (legacyError) {
    throw legacyError
  }

  const sortedData = sortPublicProperties(legacyData || [])
  const pagedData = limit ? sortedData.slice(offset, offset + limit) : sortedData

  return {
    properties: pagedData,
  }
}

const applyPublicPropertyFilters = (query, filters = {}) => {
  const normalizedFilters = normalizeSearchFilters(filters)
  let nextQuery = query

  if (normalizedFilters.district) {
    nextQuery = nextQuery.eq('state_district', normalizedFilters.district)
  } else if (normalizedFilters.division) {
    nextQuery = nextQuery.in('state_district', getDivisionDistrictValues(normalizedFilters.division))
  }

  if (normalizedFilters.upazilla) {
    nextQuery = nextQuery.eq('area', normalizedFilters.upazilla)
  }

  if (normalizedFilters.subArea) {
    nextQuery = nextQuery.eq('sub_area', normalizedFilters.subArea)
  }

  if (normalizedFilters.category !== 'All') {
    nextQuery = nextQuery.in('category', getPropertyCategoryValues(normalizedFilters.category))
  }

  if (normalizedFilters.propertyType !== 'All') {
    nextQuery = nextQuery.in('property_type', getPropertyTypeValues(normalizedFilters.propertyType))
  }

  if (normalizedFilters.minPrice) {
    nextQuery = nextQuery.gte('rent_amount_bdt', Number(normalizedFilters.minPrice))
  }

  if (normalizedFilters.maxPrice) {
    nextQuery = nextQuery.lte('rent_amount_bdt', Number(normalizedFilters.maxPrice))
  }

  if (normalizedFilters.rooms) {
    nextQuery = nextQuery.gte('total_rooms', Number(normalizedFilters.rooms))
  }

  if (normalizedFilters.search) {
    const searchTerms = getKeywordSearchTerms(normalizedFilters.search)
    const matchedLocations = getMatchedLocationValues(normalizedFilters.search)
    const keywordConditions = []

    searchTerms.forEach((keyword) => {
      keywordConditions.push(
        `property_id_number.ilike.%${keyword}%`,
        `category.ilike.%${keyword}%`,
        `property_type.ilike.%${keyword}%`,
        `state_district.ilike.%${keyword}%`,
        `area.ilike.%${keyword}%`,
        `sub_area.ilike.%${keyword}%`,
        `short_description.ilike.%${keyword}%`,
        `floor_level.ilike.%${keyword}%`,
        `occupancy.ilike.%${keyword}%`,
        `rent_period.ilike.%${keyword}%`
      )
    })

    matchedLocations.stateDistrictValues.forEach((value) => {
      keywordConditions.push(`state_district.ilike.%${escapePostgrestPatternValue(value)}%`)
    })

    matchedLocations.areaValues.forEach((value) => {
      keywordConditions.push(`area.ilike.%${escapePostgrestPatternValue(value)}%`)
    })

    matchedLocations.subAreaValues.forEach((value) => {
      keywordConditions.push(`sub_area.ilike.%${escapePostgrestPatternValue(value)}%`)
    })

    if (keywordConditions.length) {
      nextQuery = nextQuery.or(Array.from(new Set(keywordConditions)).join(','))
    }
  }

  return nextQuery
}

const applySortOrder = (query, sort = DEFAULT_SEARCH_FILTERS.sort) => {
  if (sort === 'price_low') {
    return query.order('rent_amount_bdt', { ascending: true, nullsFirst: false })
  }

  if (sort === 'price_high') {
    return query.order('rent_amount_bdt', { ascending: false, nullsFirst: false })
  }

  return query.order('created_at', { ascending: false })
}

const sortSearchResults = (properties = [], sort = DEFAULT_SEARCH_FILTERS.sort) => {
  const nextProperties = [...properties]
  const withPinnedFirst = (comparison) =>
    nextProperties.sort((left, right) => {
      const pinComparison = compareActivePinnedFirst(left, right)

      if (pinComparison !== 0) {
        return pinComparison
      }

      return comparison(left, right)
    })

  if (sort === 'price_low') {
    return withPinnedFirst(
      (left, right) =>
        (getPropertyRentAmount(left) ?? Number.MAX_SAFE_INTEGER) -
        (getPropertyRentAmount(right) ?? Number.MAX_SAFE_INTEGER)
    )
  }

  if (sort === 'price_high') {
    return withPinnedFirst(
      (left, right) => (getPropertyRentAmount(right) ?? -1) - (getPropertyRentAmount(left) ?? -1)
    )
  }

  return sortPublicProperties(nextProperties)
}

const mergePropertiesById = (...propertyLists) => {
  const propertiesById = new Map()

  propertyLists.flat().forEach((property) => {
    if (!property?.id) {
      return
    }

    const existing = propertiesById.get(property.id)

    if (!existing) {
      propertiesById.set(property.id, property)
      return
    }

    // Keep the first copy but carry over amenity enrichment from a later duplicate.
    if (!existing.search_related_text && property.search_related_text) {
      propertiesById.set(property.id, { ...existing, search_related_text: property.search_related_text })
    }
  })

  return [...propertiesById.values()]
}

const fetchKeywordAmenityPropertyIds = async (search = '') => {
  const searchTerms = getKeywordSearchTerms(search)

  if (!searchTerms.length) {
    return { ids: [], amenitiesById: new Map() }
  }

  const { data, error } = await supabase
    .from('property_amenities')
    .select('property_id, amenity_type')
    .or(searchTerms.map((keyword) => `amenity_type.ilike.%${keyword}%`).join(','))
    .limit(SEARCH_RESULTS_LIMIT)

  if (error) {
    if (process.env.NODE_ENV === 'development' && !isSupabaseQuotaError(error)) {
      console.warn(`Continuing without amenity keyword matches: ${getErrorMessage(error)}`)
    }

    return { ids: [], amenitiesById: new Map() }
  }

  const amenitiesById = new Map()
  ;(data || []).forEach((row) => {
    if (!row?.property_id) {
      return
    }
    const list = amenitiesById.get(row.property_id) || []
    if (row.amenity_type && !list.includes(row.amenity_type)) {
      list.push(row.amenity_type)
    }
    amenitiesById.set(row.property_id, list)
  })

  return { ids: [...amenitiesById.keys()], amenitiesById }
}

const fetchFilteredPublicPropertyRows = async (filters = {}, propertyIds = null) => {
  if (Array.isArray(propertyIds) && !propertyIds.length) {
    return []
  }

  const normalizedFilters = normalizeSearchFilters(filters)
  let query = supabase
    .from('properties')
    .select(PUBLIC_PROPERTY_SELECT)
    .eq('status', 'approved')
    .neq('is_active', false)

  query = applyPublicPropertyFilters(query, normalizedFilters)

  if (Array.isArray(propertyIds)) {
    query = query.in('id', propertyIds)
  }

  query = applySortOrder(query, normalizedFilters.sort).limit(SEARCH_RESULTS_LIMIT)

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data || []
}

const prepareFilteredSearchRows = (rows = [], filters = {}) => {
  const normalizedFilters = normalizeSearchFilters(filters)

  return sortSearchResults(rows, normalizedFilters.sort).filter(
    (property) => matchesSearchKeyword(property, normalizedFilters.search)
  )
}

const fetchFilteredPublicProperties = async (filters = {}) => {
  const normalizedFilters = normalizeSearchFilters(filters)
  const keywordRows = await fetchFilteredPublicPropertyRows(normalizedFilters)
  const { ids: amenityPropertyIds, amenitiesById } = await fetchKeywordAmenityPropertyIds(
    normalizedFilters.search
  )
  // Tag each amenity match with the amenity names that matched (not the whole query), so the
  // every-word post-filter still requires the other words to match the property itself.
  const amenityRows = (await fetchFilteredPublicPropertyRows(
    {
      ...normalizedFilters,
      search: '',
    },
    amenityPropertyIds
  )).map((property) => ({
    ...property,
    search_related_text: (amenitiesById.get(property.id) || []).join(' '),
  }))
  return prepareFilteredSearchRows(
    mergePropertiesById(keywordRows, amenityRows),
    normalizedFilters
  )
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

/**
 * Search with an explicit outcome so the UI can distinguish "no matches" from
 * "the service could not be reached". `properties` is always an array.
 *   source: 'live' | 'cache-search' | 'cache-all' | 'none'
 *   error:  null | { code: 'unavailable' | 'failed', message }
 */
export const searchPropertiesWithStatus = async (filters = {}) => {
  const normalizedFilters = normalizeSearchFilters(filters)
  const cacheKey = getSearchCacheKey(normalizedFilters)

  try {
    const properties = await fetchFilteredPublicProperties(normalizedFilters)

    if (!properties.length) {
      writeSnapshot(cacheKey, [])
      return { properties: [], source: 'live', error: null }
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

    return { properties: transformedProperties, source: 'live', error: null }
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    const isRecoverable = isSupabaseQuotaError(error) || isRecoverableSupabaseError(error)

    if (isRecoverable) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Search unavailable, using cached data if any: ${errorMessage}`)
      }
    } else {
      console.error('Error searching properties:', errorMessage, error)
    }

    const status = {
      code: isRecoverable ? 'unavailable' : 'failed',
      message: errorMessage,
    }

    const cachedSearchProperties = readSnapshot(cacheKey)
    if (Array.isArray(cachedSearchProperties)) {
      return { properties: cachedSearchProperties, source: 'cache-search', error: status }
    }

    const cachedAllProperties = readSnapshot(getAllPropertiesCacheKey())
    if (Array.isArray(cachedAllProperties)) {
      return {
        properties: sortSearchResults(
          cachedAllProperties.filter((property) => matchesPropertyFilters(property, normalizedFilters)),
          normalizedFilters.sort
        ),
        source: 'cache-all',
        error: status,
      }
    }

    return { properties: [], source: 'none', error: status }
  }
}

export const searchProperties = async (filters = {}) =>
  (await searchPropertiesWithStatus(filters)).properties

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
    const homepagePropertiesByCategory = HOME_CATEGORIES.reduce((accumulator, category) => {
      accumulator[category] = []
      return accumulator
    }, {})
    const selectedPropertyIds = new Set()
    let offset = 0
    let exhaustedCatalog = false

    while (!exhaustedCatalog) {
      const response = await fetchPublicProperties({
        limit: HOMEPAGE_PROPERTIES_LIMIT,
        offset,
      })
      const properties = response?.properties || []

      if (properties.length === 0) {
        exhaustedCatalog = true
        break
      }

      properties.forEach((property) => {
        const category = normalizePropertyCategory(property?.category)

        if (!HOME_CATEGORIES.includes(category)) {
          return
        }

        if (selectedPropertyIds.has(property.id)) {
          return
        }

        if (homepagePropertiesByCategory[category].length >= HOMEPAGE_CATEGORY_ITEM_LIMIT) {
          return
        }

        homepagePropertiesByCategory[category].push(property)
        selectedPropertyIds.add(property.id)
      })

      const allCategoriesFilled = HOME_CATEGORIES.every(
        (category) => homepagePropertiesByCategory[category].length >= HOMEPAGE_CATEGORY_ITEM_LIMIT
      )

      if (allCategoriesFilled) {
        break
      }

      if (properties.length < HOMEPAGE_PROPERTIES_LIMIT) {
        exhaustedCatalog = true
        break
      }

      offset += HOMEPAGE_PROPERTIES_LIMIT
    }

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

    const transformedProperties = mapPublicProperties(
      selectedProperties,
      allImages,
      allAmenities
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
