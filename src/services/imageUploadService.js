import { supabase } from './supabaseClient'

const BUCKET_NAME = 'property-images'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

let imageCompressionPromise

const loadImageCompression = async () => {
  if (!imageCompressionPromise) {
    imageCompressionPromise = import('browser-image-compression').then(
      (module) => module.default
    )
  }

  return imageCompressionPromise
}

/**
 * Compress a single image file
 * @param {File} file - The image file to compress
 * @returns {Promise<File>} - Compressed file
 */
export const compressImage = async (file) => {
  try {
    if (file.size <= COMPRESSION_OPTIONS.maxSizeMB * 1024 * 1024) {
      return file
    }

    const imageCompression = await loadImageCompression()
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS)
    return compressed
  } catch (error) {
    console.error('Image compression error:', error)
    throw new Error(`Failed to compress image: ${error.message}`)
  }
}

/**
 * Upload a single image to Supabase Storage
 * @param {File} file - The image file to upload
 * @param {string} propertyId - The property ID (for folder structure)
 * @returns {Promise<string>} - Public URL of uploaded image
 */
export const uploadPropertyImage = async (file, propertyId) => {
  try {
    // Compress image first
    const compressedFile = await compressImage(file)

    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const filename = `${propertyId}/${timestamp}-${random}-${file.name}`

    // Upload to Supabase Storage
    // Cache for 1 year (31536000 seconds) - filenames are unique (timestamp-random-name)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, compressedFile, {
        cacheControl: '31536000', // 1 year - immutable unique filenames
        upsert: false,
      })

    if (error) {
      // Provide helpful error message
      if (error.message?.includes('The resource was not found') || error.message?.includes('bucket not found')) {
        throw new Error(`Storage bucket '${BUCKET_NAME}' not found. Please create it in Supabase Storage.`)
      }
      throw error
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename)

    return publicData.publicUrl
  } catch (error) {
    console.error('Image upload error:', error)

    // Check for common issues
    if (error.message?.includes('Unexpected token')) {
      throw new Error('Storage bucket not configured. Please create "property-images" bucket in Supabase Storage with public access.')
    }

    throw new Error(`Failed to upload image: ${error.message}`)
  }
}

/**
 * Upload multiple images in parallel
 * @param {File[]} files - Array of image files
 * @param {string} propertyId - The property ID
 * @returns {Promise<string[]>} - Array of public URLs
 */
export const uploadMultipleImages = async (files, propertyId) => {
  try {
    const uploadPromises = files.map((file) =>
      uploadPropertyImage(file, propertyId)
    )

    const urls = await Promise.all(uploadPromises)
    return urls
  } catch (error) {
    console.error('Multiple image upload error:', error)
    throw new Error(`Failed to upload images: ${error.message}`)
  }
}

/**
 * Upload ID document to private bucket
 * @param {File} file - The ID document file
 * @param {string} userId - The user ID
 * @param {string} side - 'front' or 'back'
 * @returns {Promise<string>} - Public URL of uploaded document
 */
export const uploadIDDocument = async (file, userId, side) => {
  try {
    const compressedFile = await compressImage(file)

    const timestamp = Date.now()
    const filename = `${userId}/${side}-${timestamp}-${file.name}`

    const { data, error } = await supabase.storage
      .from('id-documents')
      .upload(filename, compressedFile, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      throw error
    }

    // Get private URL (for private bucket)
    const { data: publicData } = supabase.storage
      .from('id-documents')
      .getPublicUrl(filename)

    return publicData.publicUrl
  } catch (error) {
    console.error('ID document upload error:', error)
    throw new Error(`Failed to upload ID document: ${error.message}`)
  }
}

/**
 * Delete an image from storage
 * @param {string} publicUrl - Public URL of the image to delete
 * @returns {Promise<boolean>}
 */
export const deletePropertyImage = async (publicUrl) => {
  try {
    // Extract file path from public URL
    const urlParts = publicUrl.split('/storage/v1/object/public/')
    if (urlParts.length !== 2) {
      throw new Error('Invalid public URL format')
    }

    const filePath = urlParts[1].replace(`${BUCKET_NAME}/`, '')

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath])

    if (error) {
      throw error
    }

    return true
  } catch (error) {
    console.error('Image deletion error:', error)
    return false
  }
}

/**
 * Validate image file before upload
 * @param {File} file - The file to validate
 * @returns {Object} - { isValid: boolean, error: string|null }
 */
export const validateImageFile = (file) => {
  const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

  if (!validImageTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Only JPEG, PNG, WebP, and GIF images are allowed',
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size must be less than 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    }
  }

  return { isValid: true, error: null }
}
