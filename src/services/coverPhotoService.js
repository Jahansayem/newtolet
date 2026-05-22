// Cover Photo Service - Using Supabase Database with Storage support
// This service manages cover photos for the homepage banner

import { supabase } from './supabaseClient'
import { readSnapshot, writeSnapshot } from './cacheService'

const SUPABASE_BUCKET = 'cover-photos'
export const getActiveCoverPhotosCacheKey = (limit = 6) => `cover-photos:active:${limit}`

// Banner image requirements
const BANNER_MIN_WIDTH = 1600
const BANNER_MIN_HEIGHT = 500
const BANNER_RECOMMENDED_WIDTH = 1920
const BANNER_RECOMMENDED_HEIGHT = 640
const BANNER_TARGET_LONG_EDGE = 2560
const BANNER_MAX_SIZE_KB = 1200
const BANNER_OUTPUT_QUALITY = 0.92

export const COVER_BANNER_GUIDANCE = {
  minimumWidth: BANNER_MIN_WIDTH,
  minimumHeight: BANNER_MIN_HEIGHT,
  recommendedWidth: BANNER_RECOMMENDED_WIDTH,
  recommendedHeight: BANNER_RECOMMENDED_HEIGHT,
  targetLongEdge: BANNER_TARGET_LONG_EDGE,
  maxSizeKB: BANNER_MAX_SIZE_KB,
  outputQualityPercent: Math.round(BANNER_OUTPUT_QUALITY * 100)
}

let imageCompressionPromise
const activeCoverPhotoRequests = new Map()

const loadImageCompression = async () => {
  if (!imageCompressionPromise) {
    imageCompressionPromise = import('browser-image-compression').then(
      (module) => module.default
    )
  }

  return imageCompressionPromise
}

// Get all cover photos from Supabase
export const getCoverPhotos = async () => {
  try {
    const { data, error } = await supabase
      .from('cover_photos')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching cover photos:', error)
    return { data: [], error }
  }
}

// Get active cover photos only (optimized for homepage)
export const getActiveCoverPhotos = async (limit = 6) => {
  const cacheKey = getActiveCoverPhotosCacheKey(limit)

  if (activeCoverPhotoRequests.has(cacheKey)) {
    return activeCoverPhotoRequests.get(cacheKey)
  }

  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('cover_photos')
        .select('id, image_url, order_index')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .limit(limit)

      if (error) throw error
      const activePhotos = data || []
      writeSnapshot(cacheKey, activePhotos)
      return { data: activePhotos, error: null }
    } catch (error) {
      console.error('Error fetching active cover photos:', error)

      const cachedPhotos = readSnapshot(cacheKey)
      if (cachedPhotos) {
        return { data: cachedPhotos, error: null }
      }

      return { data: [], error }
    } finally {
      activeCoverPhotoRequests.delete(cacheKey)
    }
  })()

  activeCoverPhotoRequests.set(cacheKey, request)
  return request
}

// Add a new cover photo to Supabase
export const addCoverPhoto = async (imageUrl, orderIndex) => {
  try {
    // If no order index provided, get the max and add 1
    if (orderIndex === undefined || orderIndex === null) {
      const { data: existingPhotos } = await supabase
        .from('cover_photos')
        .select('order_index')
        .order('order_index', { ascending: false })
        .limit(1)

      orderIndex = existingPhotos && existingPhotos.length > 0
        ? existingPhotos[0].order_index + 1
        : 0
    }

    const { data, error } = await supabase
      .from('cover_photos')
      .insert([{
        image_url: imageUrl,
        order_index: orderIndex,
        is_active: true
      }])
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error adding cover photo:', error)
    return { data: null, error }
  }
}

// Update a cover photo
export const updateCoverPhoto = async (id, imageUrl) => {
  try {
    const { data, error } = await supabase
      .from('cover_photos')
      .update({
        image_url: imageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating cover photo:', error)
    return { data: null, error }
  }
}

// Delete a cover photo
export const deleteCoverPhoto = async (id) => {
  try {
    const { error } = await supabase
      .from('cover_photos')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting cover photo:', error)
    return { error }
  }
}

// Toggle active status
export const toggleCoverPhotoStatus = async (id, isActive) => {
  try {
    const { data, error } = await supabase
      .from('cover_photos')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error toggling cover photo status:', error)
    return { data: null, error }
  }
}

// Update order of cover photos
export const updateCoverPhotoOrder = async (updates) => {
  try {
    // Update each photo's order in Supabase
    const promises = updates.map(({ id, order_index }) =>
      supabase
        .from('cover_photos')
        .update({ order_index, updated_at: new Date().toISOString() })
        .eq('id', id)
    )

    await Promise.all(promises)
    return { error: null }
  } catch (error) {
    console.error('Error updating cover photo order:', error)
    return { error }
  }
}

/**
 * Validate cover image dimensions
 * @param {File} file - The image file to validate
 * @returns {Promise<{valid: boolean, error?: string, width?: number, height?: number}>}
 */
export const validateCoverImage = async (file) => {
  return new Promise((resolve) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      resolve({ valid: false, error: 'File must be an image (PNG, JPG, WEBP, etc.)' })
      return
    }

    // Create image element to check dimensions
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      if (img.width < BANNER_MIN_WIDTH || img.height < BANNER_MIN_HEIGHT) {
        resolve({
          valid: false,
          error: `Image must be at least ${BANNER_MIN_WIDTH}x${BANNER_MIN_HEIGHT}px. Your image is ${img.width}x${img.height}px.`,
          width: img.width,
          height: img.height
        })
        return
      }

      resolve({
        valid: true,
        width: img.width,
        height: img.height,
        isBelowRecommended:
          img.width < BANNER_RECOMMENDED_WIDTH || img.height < BANNER_RECOMMENDED_HEIGHT
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ valid: false, error: 'Failed to load image. File may be corrupted.' })
    }

    img.src = url
  })
}

/**
 * Optimize cover image for web (resize and compress to WebP)
 * @param {File} file - The image file to optimize
 * @returns {Promise<{data?: File, error?: string, metadata?: object}>}
 */
export const optimizeCoverImage = async (file) => {
  try {
    // First validate the image
    const validation = await validateCoverImage(file)
    if (!validation.valid) {
      return { data: null, error: validation.error }
    }

    const { width, height } = validation

    // Calculate target dimensions (preserve aspect ratio)
    let targetWidth = width
    let targetHeight = height
    const longEdge = Math.max(width, height)

    if (longEdge > BANNER_TARGET_LONG_EDGE) {
      const scale = BANNER_TARGET_LONG_EDGE / longEdge
      targetWidth = Math.round(width * scale)
      targetHeight = Math.round(height * scale)
    }

    // Compression options
    const options = {
      maxWidthOrHeight: Math.max(targetWidth, targetHeight),
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: BANNER_OUTPUT_QUALITY,
      maxSizeMB: BANNER_MAX_SIZE_KB / 1024,
      maxIteration: 10,
      alwaysKeepResolution: false
    }

    // Compress the image
    const imageCompression = await loadImageCompression()
    const compressedFile = await imageCompression(file, options)

    // Get final size info
    const originalSizeKB = (file.size / 1024).toFixed(2)
    const compressedSizeKB = (compressedFile.size / 1024).toFixed(2)
    const savings = ((1 - compressedFile.size / file.size) * 100).toFixed(1)

    return {
      data: compressedFile,
      error: null,
      metadata: {
        originalDimensions: { width, height },
        targetDimensions: { width: targetWidth, height: targetHeight },
        originalSizeKB: parseFloat(originalSizeKB),
        compressedSizeKB: parseFloat(compressedSizeKB),
        savingsPercent: parseFloat(savings),
        isBelowRecommended: validation.isBelowRecommended
      }
    }
  } catch (error) {
    console.error('Error optimizing image:', error)
    return { data: null, error: `Image optimization failed: ${error.message}` }
  }
}

// Upload image to Supabase Storage (with automatic optimization)
export const uploadCoverImageToSupabase = async (file) => {
  try {
    // Optimize the image before upload
    const optimizationResult = await optimizeCoverImage(file)

    if (optimizationResult.error) {
      return { data: null, error: new Error(optimizationResult.error) }
    }

    const optimizedFile = optimizationResult.data

    // Generate unique filename with webp extension
    const fileName = `cover_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`
    const filePath = `covers/${fileName}`

    // Upload to Supabase Storage with long cache policy (1 year for immutable file names)
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(filePath, optimizedFile, {
        cacheControl: '31536000', // 1 year cache for immutable file names
        upsert: false,
        contentType: 'image/webp'
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return { data: null, error: uploadError }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(filePath)

    return {
      data: {
        url: urlData.publicUrl,
        path: filePath
      },
      error: null,
      metadata: optimizationResult.metadata // Include optimization info
    }
  } catch (error) {
    console.error('Error uploading to Supabase:', error)
    return { data: null, error }
  }
}

// Delete image from Supabase Storage
export const deleteCoverImageFromSupabase = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .remove([filePath])

    if (error) {
      console.error('Supabase delete error:', error)
      return { error }
    }

    return { error: null }
  } catch (error) {
    console.error('Error deleting from Supabase:', error)
    return { error }
  }
}

// Upload image and return URL (converts to base64 for localStorage - legacy method)
export const uploadCoverImage = async (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve({ data: { url: reader.result }, error: null })
      }
      reader.onerror = () => {
        reject({ data: null, error: new Error('Failed to read file') })
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading cover image:', error)
      reject({ data: null, error })
    }
  })
}

export default {
  getCoverPhotos,
  getActiveCoverPhotos,
  addCoverPhoto,
  updateCoverPhoto,
  deleteCoverPhoto,
  toggleCoverPhotoStatus,
  updateCoverPhotoOrder,
  uploadCoverImage,
  uploadCoverImageToSupabase,
  deleteCoverImageFromSupabase,
  validateCoverImage,
  optimizeCoverImage
}
