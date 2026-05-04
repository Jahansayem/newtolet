import { supabase } from './supabaseClient'
import { readSnapshot, removeSnapshot, writeSnapshot } from './cacheService'
import { HOME_CATEGORIES, normalizePropertyCategory } from '../lib/propertyCategories'

const PROPERTY_IMAGES_BUCKET = 'property-images'
const PUBLIC_PROPERTIES_VIEW = 'public_property_catalog'
const RELATED_RECORD_BATCH_SIZE = 100
const HOMEPAGE_CATEGORY_ITEM_LIMIT = 6
const HOMEPAGE_PROPERTIES_LIMIT = 72
const SEARCHABLE_PROPERTIES_LIMIT = 200
const PROPERTY_CATALOG_CACHE_VERSION = 'v2'

const isMissingPublicCatalogError = (error) =>
  error?.code === 'PGRST205' ||
  error?.code === '42P01' ||
  error?.message?.includes(`Could not find the table '${PUBLIC_PROPERTIES_VIEW}'`) ||
  error?.message?.includes('does not exist')

const logPublicCatalogFallback = (contextLabel = 'properties') => {
  console.warn(`Using ${contextLabel} fallback because ${PUBLIC_PROPERTIES_VIEW} is unavailable.`)
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

const mapPublicProperty = (property, imagesByProperty = {}, amenitiesByProperty = {}) => ({
  id: property.id,
  property_id_number: property.property_id_number,
  category: property.category,
  normalizedCategory: normalizePropertyCategory(property.category),
  property_type: property.property_type || 'Apartment',
  dining_rooms: property.dining_rooms || 0,
  living_rooms: property.living_rooms || 0,
  total_bathrooms: property.total_bathrooms,
  total_balcony: property.balcony,
  total_kitchen: property.total_kitchen || null,
  floor_level: property.floor_level,
  room_size: property.room_size_sqft,
  occupancy: property.occupancy || null,
  specifications: {
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
  is_pinned: Boolean(property.is_pinned),
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

const fetchPublicProperties = async ({ select = '*', limit = null, offset = 0 } = {}) => {
  let query = supabase
    .from(PUBLIC_PROPERTIES_VIEW)
    .select(select)
    .order('created_at', { ascending: false })

  if (limit) {
    query = query.range(offset, offset + limit - 1)
  }

  const { data, error } = await query

  if (!error) {
    return {
      properties: data || [],
      usedLegacyFallback: false,
    }
  }

  if (!isMissingPublicCatalogError(error)) {
    throw error
  }

  let legacyQuery = supabase
    .from('properties')
    .select(select)
    .eq('status', 'approved')
    .neq('is_active', false)
    .order('created_at', { ascending: false })

  if (limit) {
    legacyQuery = legacyQuery.range(offset, offset + limit - 1)
  }

  const { data: legacyData, error: legacyError } = await legacyQuery

  if (legacyError) {
    throw legacyError
  }

  return {
    properties: legacyData || [],
    usedLegacyFallback: true,
  }
}

export const invalidatePropertyCatalogSnapshots = () => {
  removeSnapshot(getAllPropertiesCacheKey())
  removeSnapshot(getHomepagePropertiesCacheKey())
  removeSnapshot(getSearchablePropertiesCacheKey())
}

export const getAllProperties = async (options = {}) => {
  const cacheKey = getAllPropertiesCacheKey(options)

  try {
    const limit =
      Number.isInteger(options.limit) && options.limit > 0 ? options.limit : null
    const offset =
      Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : 0

    const { properties, usedLegacyFallback } = await fetchPublicProperties({ limit, offset })

    if (!properties || properties.length === 0) {
      if (usedLegacyFallback) {
        logPublicCatalogFallback('approved properties')
      }
      writeSnapshot(cacheKey, [])
      return []
    }

    const propertyIds = properties.map((property) => property.id)
    const [allImages, allAmenities] = await Promise.all([
      fetchRelatedRowsInBatches({
        table: 'property_images',
        ids: propertyIds,
        orderColumn: 'display_order',
      }),
      fetchRelatedRowsInBatches({
        table: 'property_amenities',
        select: 'property_id, amenity_type',
        ids: propertyIds,
      }),
    ])

    const transformedProperties = mapPublicProperties(properties, allImages, allAmenities)

    if (usedLegacyFallback) {
      logPublicCatalogFallback('approved properties')
    }

    writeSnapshot(cacheKey, transformedProperties)

    return transformedProperties
  } catch (error) {
    console.error('Error fetching all properties:', error)

    const cachedProperties = readSnapshot(cacheKey)
    if (cachedProperties) {
      console.warn('Using cached approved properties after fetch error')
      return cachedProperties
    }

    throw error
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
    let usedLegacyFallback = false
    let exhaustedCatalog = false

    while (!exhaustedCatalog) {
      const response = await fetchPublicProperties({
        limit: HOMEPAGE_PROPERTIES_LIMIT,
        offset,
      })
      const properties = response?.properties || []
      usedLegacyFallback = usedLegacyFallback || response?.usedLegacyFallback === true

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
      if (usedLegacyFallback) {
        logPublicCatalogFallback('homepage properties')
      }
      writeSnapshot(cacheKey, [])
      return []
    }

    const propertyIds = selectedProperties.map((property) => property.id)
    const [allImages, allAmenities] = await Promise.all([
      fetchRelatedRowsInBatches({
        table: 'property_images',
        ids: propertyIds,
        orderColumn: 'display_order',
      }),
      fetchRelatedRowsInBatches({
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

    if (usedLegacyFallback) {
      logPublicCatalogFallback('homepage properties')
    }

    writeSnapshot(cacheKey, transformedProperties)

    return transformedProperties
  } catch (error) {
    if (isMissingPublicCatalogError(error)) {
      console.warn(`Homepage properties unavailable because ${PUBLIC_PROPERTIES_VIEW} could not be loaded.`)
    } else {
      console.error('Error fetching homepage properties:', error)
    }

    const cachedProperties = readSnapshot(cacheKey)
    if (cachedProperties) {
      console.warn('Using cached homepage properties after fetch error')
      return cachedProperties
    }

    throw error
  }
}

export const getSearchableProperties = async (limit = SEARCHABLE_PROPERTIES_LIMIT) => {
  const cacheKey = getSearchablePropertiesCacheKey(limit)

  try {
    const { properties, usedLegacyFallback } = await fetchPublicProperties({
      select:
        'id, property_id_number, category, property_type, rent_amount_bdt, is_rent_negotiable, state_district, area, sub_area, short_description, created_at, status, is_active',
      limit,
    })

    if (!properties || properties.length === 0) {
      writeSnapshot(cacheKey, [])
      return []
    }

    const propertyIds = properties.map((property) => property.id)
    const images = await fetchRelatedRowsInBatches({
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
    }))

    if (usedLegacyFallback) {
      logPublicCatalogFallback('searchable properties')
    }

    writeSnapshot(cacheKey, transformedProperties)

    return transformedProperties
  } catch (error) {
    if (isMissingPublicCatalogError(error)) {
      console.warn(`Searchable properties unavailable because ${PUBLIC_PROPERTIES_VIEW} could not be loaded.`)
    } else {
      console.error('Error fetching searchable properties:', error)
    }

    const cachedProperties = readSnapshot(cacheKey)
    if (cachedProperties) {
      console.warn('Using cached searchable properties after fetch error')
      return cachedProperties
    }

    throw error
  }
}
