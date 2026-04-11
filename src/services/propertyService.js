import { supabase } from './supabaseClient'
import {
  buildUserPanelCacheKey,
  invalidateUserPanelCache,
  invalidateUserPanelCacheByPrefix,
  readSnapshot,
  revalidateUserPanelResource,
  writeSnapshot,
} from './cacheService'
import {
  uploadMultipleImages,
  uploadIDDocument,
  validateImageFile,
} from './imageUploadService'
import { hasUnlockedContactView } from './creditService'
import { getAutoApproveProperties } from './adminService'
import { getUserPanelCachePolicy } from './userPanelCacheConfig'

const PROPERTY_IMAGES_BUCKET = 'property-images'
const RELATED_RECORD_BATCH_SIZE = 100

export const getAllPropertiesCacheKey = (options = {}) => {
  const limit =
    Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 'all'
  const offset =
    Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : 0

  return `properties:all:${limit}:${offset}`
}

export const getUserPropertiesCacheKey = (userId) =>
  `properties:user:${userId || 'anonymous'}`

const getPropertyDetailViewerKey = (viewer = {}) => {
  if (viewer?.canViewProtected) {
    return `privileged:${viewer?.viewerId || 'anonymous'}`
  }

  return viewer?.viewerId || 'anonymous'
}

export const getPropertyByIdCacheKey = (propertyId, viewer = {}) =>
  `properties:detail:${propertyId || 'unknown'}:${getPropertyDetailViewerKey(viewer)}`

const maskProtectedPropertyFields = (property, shouldRevealProtectedFields) => ({
  ...property,
  contact_number: shouldRevealProtectedFields ? property.contact_number : null,
  area: shouldRevealProtectedFields ? property.area : null,
  sub_area: shouldRevealProtectedFields ? property.sub_area : null,
  sector: shouldRevealProtectedFields ? property.sector : null,
  road: shouldRevealProtectedFields ? property.road : null,
  house_plot: shouldRevealProtectedFields ? property.house_plot : null,
})

const isPropertyVisible = (property) => property?.is_active !== false

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

const getNormalizedImages = (images) =>
  (images || [])
    .map((img) => normalizePropertyImageUrl(img?.image_url ?? img))
    .filter(Boolean)

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

/**
 * Generate a unique property ID number
 * Format: Simple sequential number starting from 100000 (e.g., 100000, 100001, 100002)
 * @returns {Promise<string>} - Unique property ID number
 */
const generatePropertyIdNumber = async () => {
  // Starting number for property IDs
  const STARTING_ID = 100000

  try {
    // Get the highest existing property_id_number
    const { data, error } = await supabase
      .from('properties')
      .select('property_id_number')
      .not('property_id_number', 'is', null)
      .order('property_id_number', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error getting highest property ID:', error)
    }

    // Find the highest numeric ID
    let highestNumber = STARTING_ID - 1  // Default to start - 1 if no properties
    if (data && data.length > 0) {
      // Try to extract number from various formats
      for (const prop of data) {
        const num = parseInt(prop.property_id_number)
        if (!isNaN(num) && num > highestNumber) {
          highestNumber = num
        }
      }
    }

    // Generate next sequential number
    const nextNumber = highestNumber + 1

    return String(nextNumber)
  } catch (error) {
    console.error('Error generating property ID:', error)
    // Fallback: return starting ID
    return String(STARTING_ID)
  }
}

/**
 * Submit complete property listing
 * @param {Object} formData - Complete form data from all 4 screens
 * @param {string} userId - Current user ID
 * @param {File[]} imageFiles - Array of image files to upload
 * @param {File} idFront - Front side of ID document (optional if already verified)
 * @param {File} idBack - Back side of ID document (optional if already verified)
 * @returns {Promise<Object>} - { success: boolean, propertyId?: string, error?: string }
 */
export const submitPropertyListing = async (
  formData,
  userId,
  imageFiles,
  idFront,
  idBack
) => {
  try {
    // ===== STEP 1: Validate inputs =====
    if (!userId) {
      throw new Error('User not authenticated')
    }

    if (!imageFiles || imageFiles.length < 1) {
      throw new Error('Please upload at least 1 image')
    }

    // Validate each image file
    for (const file of imageFiles) {
      const validation = validateImageFile(file)
      if (!validation.isValid) {
        throw new Error(validation.error)
      }
    }

    // ===== STEP 2: Check user authentication =====
    // Check if user is authenticated by checking localStorage for user object
    const storedUser = localStorage.getItem('user')
    const isAuthenticatedUser = storedUser ? JSON.parse(storedUser) : null

    if (!isAuthenticatedUser) {
      throw new Error('Please login to add a property')
    }

    // Note: Property listing is now free (no credit check required)

    // ===== STEP 3: Generate Property ID Number =====
    const propertyIdNumber = await generatePropertyIdNumber()

    // ===== STEP 4: Check auto-approve setting =====
    let propertyStatus = 'pending';
    try {
      const autoApproveResult = await getAutoApproveProperties();
      if (autoApproveResult.data?.auto_approve_properties) {
        propertyStatus = 'approved';
      }
    } catch {
      console.log('Could not check auto-approve setting, using pending status');
    }

    // ===== STEP 5: Create property record =====
    const propertyData = {
      user_id: userId,
      property_id_number: propertyIdNumber,
      category: formData.category,
      property_type: formData.property_type || 'Apartment', // Default to Apartment if not provided
      dining_rooms: formData.dining_rooms || 0,
      living_rooms: formData.living_rooms || 0,
      total_bathrooms: formData.total_bathrooms,
      balcony: formData.balcony,
      total_kitchen: formData.kitchen || 0,
      floor_level: formData.floor_level,
      occupancy: formData.occupancy,
      room_size_sqft: formData.room_size_sqft || null,
      rent_amount_bdt: formData.rent_amount_bdt,
      rent_period: formData.rent_period,
      state_district: formData.state_district,
      area: formData.area,
      contact_number: formData.contact_number,
      short_description: formData.short_description,
      sub_area: formData.sub_area || null,
      sector: formData.sector || null,
      road: formData.road || null,
      house_plot: formData.house_plot || null,
      lat: formData.lat,
      lng: formData.lng,
      available_from: formData.available_from,
      deadline: formData.deadline,
      status: propertyStatus,
      is_active: true,
      is_pinned: false,
      reviewed_at: propertyStatus === 'approved' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    }

    const { data: propertyRecord, error: propertyError } = await supabase
      .from('properties')
      .insert([propertyData])
      .select()

    if (propertyError) {
      throw new Error(`Failed to create property: ${propertyError.message}`)
    }

    const propertyId = propertyRecord[0].id

    try {
      // ===== STEP 6: Upload images =====
      const imageUrls = await uploadMultipleImages(imageFiles, propertyId)

      // ===== STEP 7: Insert property images records =====
      const propertyImagesData = imageUrls.map((url, index) => ({
        property_id: propertyId,
        image_url: url,
        is_thumbnail: index === 0, // First image is thumbnail
        display_order: index,
      }))

      const { error: imagesError } = await supabase
        .from('property_images')
        .insert(propertyImagesData)

      if (imagesError) {
        throw new Error(`Failed to save image records: ${imagesError.message}`)
      }

      // ===== STEP 8: Insert amenities =====
      if (formData.amenities && formData.amenities.length > 0) {
        const amenitiesData = formData.amenities.map((amenity) => ({
          property_id: propertyId,
          amenity_type: amenity,
        }))

        const { error: amenitiesError } = await supabase
          .from('property_amenities')
          .insert(amenitiesData)

        if (amenitiesError) {
          console.error('Warning: Failed to save amenities:', amenitiesError)
        }
      }

      // ===== STEP 9: Handle ID verification (if not already verified) =====
      const { data: existingVerification } = await supabase
        .from('user_verifications')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!existingVerification && idFront && idBack) {
        try {
          const frontUrl = await uploadIDDocument(idFront, userId, 'front')
          const backUrl = await uploadIDDocument(idBack, userId, 'back')

          const { error: verificationError } = await supabase
            .from('user_verifications')
            .insert([{
              user_id: userId,
              id_type: formData.id_type,
              front_image_url: frontUrl,
              back_image_url: backUrl,
              verification_status: 'pending',
            }])

          if (verificationError) {
            console.error('Warning: Failed to save verification:', verificationError)
          }
        } catch (idError) {
          console.error('Warning: Failed to upload ID documents:', idError)
        }
      }

      // ===== STEP 10: Credits (Skipped - Free listing) =====
      // Property listing is now free, no credits deducted

      // ===== STEP 11: Return success =====
      return {
        success: true,
        propertyId: propertyId,
        message: 'Property listing created successfully!',
      }
    } catch (error) {
      // If any step after property creation fails, we should consider rollback
      // For now, log the error but return partial success
      console.error('Error during property submission process:', error)

      // Try to delete the property record to maintain consistency
      try {
        await supabase.from('properties').delete().eq('id', propertyId)
      } catch (deleteError) {
        console.error('Failed to rollback property creation:', deleteError)
      }

      throw error
    }
  } catch (error) {
    console.error('Property submission error:', error)
    return {
      success: false,
      error: error.message || 'Failed to submit property listing',
    }
  } finally {
    invalidateUserPanelCache(buildUserPanelCacheKey(userId || 'guest', 'my-properties'))
    invalidateUserPanelCache(buildUserPanelCacheKey(userId || 'guest', 'dashboard'))
    invalidateUserPanelCache(getAllPropertiesCacheKey())
  }
}

/**
 * Get property details by ID
 * @param {string} propertyId - The property ID
 * @param {{ viewerId?: string | null, canViewProtected?: boolean }} viewer - Viewer context
 * @returns {Promise<Object>}
 */
export const getPropertyById = async (propertyId, viewer = {}) => {
  const cacheKey = getPropertyByIdCacheKey(propertyId, viewer)

  try {
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single()

    if (propertyError) {
      throw propertyError
    }

    let canRevealProtectedFields = Boolean(viewer?.canViewProtected)

    if (!canRevealProtectedFields && viewer?.viewerId) {
      canRevealProtectedFields =
        property.user_id === viewer.viewerId ||
        (await hasUnlockedContactView(viewer.viewerId, propertyId))
    }

    const propertyForViewer = maskProtectedPropertyFields(
      property,
      canRevealProtectedFields
    )

    if (
      !isPropertyVisible(propertyForViewer) &&
      property.user_id !== viewer?.viewerId &&
      !viewer?.canViewProtected
    ) {
      throw new Error('Property not found')
    }

    const [{ data: images }, { data: amenities }] = await Promise.all([
      supabase
        .from('property_images')
        .select('*')
        .eq('property_id', propertyId)
        .order('display_order'),
      supabase
        .from('property_amenities')
        .select('amenity_type')
        .eq('property_id', propertyId),
    ])

    // Transform to nested structure expected by UI
    const normalizedProperty = {
      id: propertyForViewer.id,
      property_id_number: propertyForViewer.property_id_number,
      category: propertyForViewer.category,
      property_type: propertyForViewer.property_type,
      // Root level fields for backward compatibility
      dining_rooms: propertyForViewer.dining_rooms || 0,
      living_rooms: propertyForViewer.living_rooms || 0,
      total_bathrooms: propertyForViewer.total_bathrooms,
      total_balcony: propertyForViewer.balcony,
      total_kitchen: propertyForViewer.total_kitchen || null,
      floor_level: propertyForViewer.floor_level,
      room_size: propertyForViewer.room_size_sqft,
      occupancy: propertyForViewer.occupancy || null,
      protected_contact_unlocked: canRevealProtectedFields,
      // Nested structure
      specifications: {
        dining_rooms: propertyForViewer.dining_rooms || 0,
        living_rooms: propertyForViewer.living_rooms || 0,
        total_bathrooms: propertyForViewer.total_bathrooms,
        total_balcony: propertyForViewer.balcony,
        total_kitchen: propertyForViewer.total_kitchen || null,
        floor_level: propertyForViewer.floor_level,
        room_size: propertyForViewer.room_size_sqft,
      },
      pricing: {
        rent_amount_bdt: propertyForViewer.rent_amount_bdt,
        rent_period: propertyForViewer.rent_period,
      },
      location: {
        state_district: propertyForViewer.state_district,
        area: propertyForViewer.area,
        sub_area: propertyForViewer.sub_area || null,
        contact_number: propertyForViewer.contact_number,
        short_description: propertyForViewer.short_description,
        sector: propertyForViewer.sector,
        road: propertyForViewer.road,
        house_plot: propertyForViewer.house_plot,
      },
      amenities: (amenities || []).map((a) => a.amenity_type),
      availability: {
        available_from: propertyForViewer.available_from,
        deadline: propertyForViewer.deadline,
      },
      images: getNormalizedImages(images),
      primary_image: getNormalizedImages(images)[0] || null,
      lat: propertyForViewer.lat,
      lng: propertyForViewer.lng,
      status: propertyForViewer.status,
      is_active: propertyForViewer.is_active !== false,
      is_pinned: Boolean(propertyForViewer.is_pinned),
      created_at: propertyForViewer.created_at,
      createdAt: propertyForViewer.created_at,
    }

    writeSnapshot(cacheKey, normalizedProperty)

    return normalizedProperty
  } catch (error) {
    console.error('Error fetching property:', error)

    const cachedProperty = readSnapshot(cacheKey)
    if (cachedProperty) {
      console.warn('Using cached property details after fetch error:', propertyId)
      return cachedProperty
    }

    throw error
  }
}

/**
 * Update property listing
 * @param {string} propertyId - The property ID
 * @param {Object} updates - Updated fields
 * @returns {Promise<boolean>}
 */
export const updateProperty = async (propertyId, updates) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', propertyId)
      .select('id, user_id')
      .single()

    if (error) {
      throw error
    }

    invalidateUserPanelCache(buildUserPanelCacheKey(data?.user_id || 'guest', 'my-properties'))
    invalidateUserPanelCache(buildUserPanelCacheKey(data?.user_id || 'guest', 'dashboard'))
    invalidateUserPanelCacheByPrefix(getPropertyByIdCacheKey(propertyId))
    invalidateUserPanelCache(getAllPropertiesCacheKey())

    return true
  } catch (error) {
    console.error('Error updating property:', error)
    throw error
  }
}

/**
 * Update property with images and amenities (for editing)
 * @param {string} propertyId - The property ID to update
 * @param {Object} formData - Complete form data from all 4 screens
 * @param {File[]} newImageFiles - New image files to upload (empty array if no new images)
 * @param {string[]} existingImageUrls - Existing image URLs to keep
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
export const updatePropertyWithImages = async (
  propertyId,
  formData,
  newImageFiles = [],
  existingImageUrls = []
) => {
  let currentUserId = null

  try {
    console.log('updatePropertyWithImages called with:', { propertyId, formDataKeys: Object.keys(formData) })

    // Validate user is authenticated
    const storedUser = localStorage.getItem('user')
    const isAuthenticatedUser = storedUser ? JSON.parse(storedUser) : null
    currentUserId = isAuthenticatedUser?.id || null

    if (!isAuthenticatedUser) {
      throw new Error('Please login to edit a property')
    }

    if (!propertyId) {
      throw new Error('Property ID is required')
    }

    // First, get the current property to verify ownership
    console.log('Fetching property for ownership check...')
    const { data: currentProperty, error: fetchError } = await supabase
      .from('properties')
      .select('user_id')
      .eq('id', propertyId)
      .single()

    console.log('Property fetch result:', { currentProperty, fetchError })

    if (fetchError) {
      console.error('Error fetching property:', fetchError)
      throw new Error(`Property not found or access denied: ${fetchError.message}`)
    }

    if (!currentProperty) {
      throw new Error('Property not found')
    }

    // Verify ownership
    if (currentProperty.user_id !== isAuthenticatedUser.id) {
      throw new Error('You do not have permission to edit this property')
    }

    // Prepare property data for update
    const propertyData = {
      category: formData.category,
      property_type: formData.property_type || 'Apartment',
      dining_rooms: formData.dining_rooms || 0,
      living_rooms: formData.living_rooms || 0,
      total_bathrooms: formData.total_bathrooms,
      balcony: formData.balcony,
      total_kitchen: formData.kitchen || 0,
      floor_level: formData.floor_level,
      occupancy: formData.occupancy,
      room_size_sqft: formData.room_size_sqft || null,
      rent_amount_bdt: formData.rent_amount_bdt,
      rent_period: formData.rent_period,
      state_district: formData.state_district,
      area: formData.area,
      contact_number: formData.contact_number,
      short_description: formData.short_description,
      sub_area: formData.sub_area || null,
      sector: formData.sector || null,
      road: formData.road || null,
      house_plot: formData.house_plot || null,
      lat: formData.lat,
      lng: formData.lng,
      available_from: formData.available_from,
      deadline: formData.deadline,
    }

    // Update property record
    const { error: updateError } = await supabase
      .from('properties')
      .update(propertyData)
      .eq('id', propertyId)

    if (updateError) {
      throw new Error(`Failed to update property: ${updateError.message}`)
    }

    // Handle images - delete old images and insert new ones
    // Delete existing images
    await supabase
      .from('property_images')
      .delete()
      .eq('property_id', propertyId)

    // Combine existing URLs with new uploads
    let allImageUrls = [...existingImageUrls]

    // Upload new images if provided
    if (newImageFiles.length > 0) {
      const newImageUrls = await uploadMultipleImages(newImageFiles, propertyId)
      allImageUrls = [...allImageUrls, ...newImageUrls]
    }

    // Ensure we have at least 1 image
    if (allImageUrls.length < 1) {
      throw new Error('Please upload at least 1 image')
    }

    // Insert all image records
    const propertyImagesData = allImageUrls.map((url, index) => ({
      property_id: propertyId,
      image_url: url,
      is_thumbnail: index === 0,
      display_order: index,
    }))

    const { error: imagesError } = await supabase
      .from('property_images')
      .insert(propertyImagesData)

    if (imagesError) {
      throw new Error(`Failed to save image records: ${imagesError.message}`)
    }

    // Update amenities - delete old and insert new
    await supabase
      .from('property_amenities')
      .delete()
      .eq('property_id', propertyId)

    if (formData.amenities && formData.amenities.length > 0) {
      const amenitiesData = formData.amenities.map((amenity) => ({
        property_id: propertyId,
        amenity_type: amenity,
      }))

      const { error: amenitiesError } = await supabase
        .from('property_amenities')
        .insert(amenitiesData)

      if (amenitiesError) {
        console.error('Warning: Failed to save amenities:', amenitiesError)
      }
    }

    return {
      success: true,
      propertyId: propertyId,
      message: 'Property updated successfully!',
    }
  } catch (error) {
    console.error('Property update error:', error)
    return {
      success: false,
      error: error.message || 'Failed to update property',
    }
  } finally {
    invalidateUserPanelCache(buildUserPanelCacheKey(currentUserId || 'guest', 'my-properties'))
    invalidateUserPanelCache(buildUserPanelCacheKey(currentUserId || 'guest', 'dashboard'))
    invalidateUserPanelCacheByPrefix(getPropertyByIdCacheKey(propertyId))
    invalidateUserPanelCache(getAllPropertiesCacheKey())
  }
}

/**
 * Get property for editing with all related data
 * @param {string} propertyId - The property ID
 * @returns {Promise<Object>} - Property data with images and amenities
 */
export const getPropertyForEdit = async (propertyId) => {
  try {
    // Check if propertyId is provided
    if (!propertyId) {
      throw new Error('Property ID is missing')
    }

    console.log('Fetching property for edit:', propertyId)

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single()

    if (propertyError) {
      console.error('Supabase error fetching property:', propertyError)
      throw new Error('Property not found. Please check if the property exists.')
    }

    if (!property) {
      throw new Error('Property not found')
    }

    // Verify ownership
    const storedUser = localStorage.getItem('user')
    const isAuthenticatedUser = storedUser ? JSON.parse(storedUser) : null

    if (!isAuthenticatedUser) {
      throw new Error('Please login to edit this property')
    }

    if (property.user_id !== isAuthenticatedUser.id) {
      throw new Error('You do not have permission to edit this property')
    }

    const [{ data: images }, { data: amenities }] = await Promise.all([
      supabase
        .from('property_images')
        .select('*')
        .eq('property_id', propertyId)
        .order('display_order'),
      supabase
        .from('property_amenities')
        .select('amenity_type')
        .eq('property_id', propertyId),
    ])

    return {
      id: property.id,
      category: property.category,
      property_type: property.property_type,
      dining_rooms: property.dining_rooms || 0,
      living_rooms: property.living_rooms || 0,
      total_bathrooms: property.total_bathrooms,
      balcony: property.balcony,
      kitchen: property.total_kitchen || 0,
      floor_level: property.floor_level,
      occupancy: property.occupancy,
      room_size_sqft: property.room_size_sqft || '',
      rent_amount_bdt: property.rent_amount_bdt,
      rent_period: property.rent_period,
      state_district: property.state_district,
      area: property.area,
      contact_number: property.contact_number,
      short_description: property.short_description,
      sub_area: property.sub_area || '',
      sector: property.sector || '',
      road: property.road || '',
      house_plot: property.house_plot || '',
      lat: property.lat,
      lng: property.lng,
      available_from: property.available_from,
      deadline: property.deadline,
      images: getNormalizedImages(images),
      primary_image: getNormalizedImages(images)[0] || null,
      amenities: (amenities || []).map((a) => a.amenity_type),
      status: property.status,
      is_active: property.is_active !== false,
      is_pinned: Boolean(property.is_pinned),
    }
  } catch (error) {
    console.error('Error fetching property for edit:', error)
    throw error
  }
}

/**
 * Delete property listing
 * @param {string} propertyId - The property ID
 * @returns {Promise<boolean>}
 */
export const deleteProperty = async (propertyId) => {
  try {
    const { data: existingProperty } = await supabase
      .from('properties')
      .select('id, user_id')
      .eq('id', propertyId)
      .maybeSingle()

    // Note: Due to foreign key constraints, related records will be deleted automatically
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)

    if (error) {
      throw error
    }

    invalidateUserPanelCache(buildUserPanelCacheKey(existingProperty?.user_id || 'guest', 'my-properties'))
    invalidateUserPanelCache(buildUserPanelCacheKey(existingProperty?.user_id || 'guest', 'dashboard'))
    invalidateUserPanelCache(getAllPropertiesCacheKey())

    return true
  } catch (error) {
    console.error('Error deleting property:', error)
    throw error
  }
}

/**
 * Get properties by user ID
 * @param {string} userId - The user ID to filter by
 * @returns {Promise<Array>} - Array of user's properties in nested format
 */
export const getUserProperties = async (userId) => {
  const cacheKey = buildUserPanelCacheKey(userId || 'guest', 'my-properties')

  try {
    if (!userId) {
      throw new Error('User ID is required')
    }

    const entry = await revalidateUserPanelResource({
      cacheKey,
      policy: getUserPanelCachePolicy('my-properties'),
      fetcher: async () => {
        const { data: properties, error: propertiesError } = await supabase
          .from('properties')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (propertiesError) {
          throw propertiesError
        }

        if (!properties || properties.length === 0) {
          return []
        }

        const propertyIds = properties.map((p) => p.id)
        const [{ data: allImages }, { data: allAmenities }] = await Promise.all([
          supabase
            .from('property_images')
            .select('*')
            .in('property_id', propertyIds)
            .order('display_order'),
          supabase
            .from('property_amenities')
            .select('property_id, amenity_type')
            .in('property_id', propertyIds),
        ])

        const imagesByProperty = groupPropertyImages(allImages)
        const amenitiesByProperty = {}

        ;(allAmenities || []).forEach((amenity) => {
          if (!amenitiesByProperty[amenity.property_id]) {
            amenitiesByProperty[amenity.property_id] = []
          }
          amenitiesByProperty[amenity.property_id].push(amenity.amenity_type)
        })

        return properties.map((property) => ({
          id: property.id,
          property_id_number: property.property_id_number,
          category: property.category,
          property_type: property.property_type || 'Apartment',
          total_rooms: property.total_rooms || 0,
          dining_rooms: property.dining_rooms || 0,
          living_rooms: property.living_rooms || 0,
          total_bathrooms: property.total_bathrooms,
          total_balcony: property.balcony,
          total_kitchen: property.total_kitchen || null,
          floor_level: property.floor_level,
          room_size: property.room_size_sqft,
          room_size_sqft: property.room_size_sqft,
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
          },
          location: {
            state_district: property.state_district,
            area: property.area,
            sub_area: property.sub_area || null,
            contact_number: property.contact_number,
            short_description: property.short_description,
            sector: property.sector,
            road: property.road,
            house_plot: property.house_plot,
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
        }))
      },
    })

    return entry?.data || []
  } catch (error) {
    console.error('Error fetching user properties:', error)
    throw error
  }
}

/**
 * Get all properties with images and amenities
 * Transforms flat Supabase data to nested structure for UI compatibility
 * @returns {Promise<Array>} - Array of properties in nested format
 */
export const getAllProperties = async (options = {}) => {
  const cacheKey = getAllPropertiesCacheKey(options)

  try {
    const limit =
      Number.isInteger(options.limit) && options.limit > 0 ? options.limit : null
    const offset =
      Number.isInteger(options.offset) && options.offset >= 0 ? options.offset : 0

    // Fetch only approved properties for public display
    // Order by created_at descending to show newest properties first
    let propertiesQuery = supabase
      .from('properties')
      .select('*')
      .eq('status', 'approved')
      .neq('is_active', false)
      .order('created_at', { ascending: false })

    if (limit) {
      propertiesQuery = propertiesQuery.range(offset, offset + limit - 1)
    }

    const { data: properties, error: propertiesError } = await propertiesQuery

    if (propertiesError) {
      throw propertiesError
    }

    if (!properties || properties.length === 0) {
      return []
    }

    // Get all property IDs
    const propertyIds = properties.map((p) => p.id)

    // Fetch images for all properties
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

    // Group images and amenities by property_id
    const imagesByProperty = groupPropertyImages(allImages)
    const amenitiesByProperty = {}

    ;(allAmenities || []).forEach((amenity) => {
      if (!amenitiesByProperty[amenity.property_id]) {
        amenitiesByProperty[amenity.property_id] = []
      }
      amenitiesByProperty[amenity.property_id].push(amenity.amenity_type)
    })

    // Transform to nested structure expected by UI
    const transformedProperties = properties.map((property) => ({
      id: property.id,
      property_id_number: property.property_id_number,
      category: property.category,
      property_type: property.property_type || 'Apartment',
      // Root level for compatibility
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
      },
      location: {
        state_district: property.state_district,
        area: property.area,
        sub_area: property.sub_area || null,
        contact_number: property.contact_number,
        short_description: property.short_description,
        sector: property.sector,
        road: property.road,
        house_plot: property.house_plot,
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
    }))

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
