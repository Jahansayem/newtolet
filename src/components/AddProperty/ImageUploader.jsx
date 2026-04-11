import React, { useCallback, useRef } from 'react'
import { validateImageFile } from '../../services/imageUploadService'

const ImageUploader = ({
  images = [],
  onImagesChange,
  error = null,
  existingImages = [], // Array of image URLs for edit mode
}) => {
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = React.useState(false)

  const handleImageSelect = useCallback(
    (files) => {
      const fileArray = Array.from(files)

      // Validate each file
      for (const file of fileArray) {
        const validation = validateImageFile(file)
        if (!validation.isValid) {
          alert(validation.error)
          return
        }
      }

      // Add files to state (store as File objects)
      onImagesChange([...images, ...fileArray])

      // Reset file input so same files can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [images, onImagesChange]
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      handleImageSelect(e.dataTransfer.files)
    },
    [handleImageSelect]
  )

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    // Only remove drag state if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false)
    }
  }, [])

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleImageSelect(e.target.files)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const removeImage = (index) => {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  const removeExistingImage = (url) => {
    // This will be handled by parent component
    // For now, just filter it out from the existing images
    // The parent component should track this separately
    onImagesChange(images, { removeExistingUrl: url })
  }

  const moveImage = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= images.length) return

    const newImages = [...images]
    ;[newImages[fromIndex], newImages[toIndex]] = [
      newImages[toIndex],
      newImages[fromIndex],
    ]
    onImagesChange(newImages)
  }

  const getTotalImageCount = () => {
    return images.length + existingImages.length
  }

  return (
    <div className='space-y-3 md:space-y-4'>
      {/* Upload Area */}
      <div
        onClick={handleUploadClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-4 md:p-6 lg:p-8 text-center cursor-pointer transition-all active:scale-[0.98] ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : error
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 active:bg-blue-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept='image/*'
          onChange={handleFileInputChange}
          className='hidden'
          id='image-input'
        />
        <div className='pointer-events-none'>
          <svg
            className='w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 text-gray-400'
            fill='currentColor'
            viewBox='0 0 20 20'
          >
            <path d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z' />
          </svg>
          <p className='text-base md:text-lg font-semibold text-gray-700 mb-1'>
            {existingImages.length > 0 ? 'Add more images' : 'Tap here to upload photos'}
          </p>
          <p className='text-xs md:text-sm text-gray-600 mb-2'>
            or drag and drop images
          </p>
          <p className='text-xs text-gray-500'>
            {getTotalImageCount()} / 10 images{images.length > 0 && ` (${images.length} new, ${existingImages.length} existing)`}
          </p>
          <p className='text-xs text-gray-500 mt-1'>
            Max 5MB per image • JPG, PNG, WebP
          </p>
        </div>
      </div>

      {error && <p className='text-red-500 text-xs md:text-sm'>{error}</p>}

      {/* Existing Images (for edit mode) */}
      {existingImages.length > 0 && (
        <div className='space-y-2 md:space-y-3'>
          <h4 className='font-semibold text-sm md:text-base text-gray-800'>
            Current Images ({existingImages.length})
          </h4>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            {existingImages.map((url, index) => (
              <div
                key={`existing-${index}`}
                className='flex items-center gap-2 md:gap-3 p-2 md:p-2.5 bg-blue-50 rounded-lg border border-blue-200'
              >
                {/* Thumbnail */}
                <div className='w-14 h-14 md:w-16 md:h-16 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden'>
                  <img
                    src={url}
                    alt={`Current image ${index + 1}`}
                    className='w-full h-full object-cover'
                  />
                </div>

                {/* File Info */}
                <div className='flex-1 min-w-0'>
                  <p className='text-xs md:text-sm font-medium text-gray-800 truncate'>
                    Image {index + 1}
                  </p>
                  <p className='text-xs text-gray-500'>
                    Server
                  </p>
                  {index === 0 && (
                    <p className='text-[10px] md:text-xs font-semibold text-green-600'>
                      📌 Thumbnail
                    </p>
                  )}
                </div>

                {/* Delete button */}
                <button
                  type='button'
                  onClick={() => removeExistingImage(url)}
                  className='p-2 md:p-2.5 text-red-600 hover:bg-red-100 rounded active:bg-red-200 min-w-[40px] min-h-[40px] flex items-center justify-center'
                  title='Remove this image'
                >
                  <svg className='w-4 h-4 md:w-5 md:h-5' fill='currentColor' viewBox='0 0 20 20'>
                    <path
                      fillRule='evenodd'
                      d='M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z'
                      clipRule='evenodd'
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Image Previews */}
      {images.length > 0 && (
        <div className='space-y-2 md:space-y-3'>
          <h4 className='font-semibold text-sm md:text-base text-gray-800'>
            New Images ({images.length})
          </h4>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            {images.map((image, index) => (
              <div
                key={index}
                className='flex items-center gap-2 md:gap-3 p-2 md:p-2.5 bg-gray-50 rounded-lg border border-gray-200'
              >
                {/* Thumbnail */}
                <div className='w-14 h-14 md:w-16 md:h-16 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden'>
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Preview ${index + 1}`}
                    className='w-full h-full object-cover'
                  />
                </div>

                {/* File Info */}
                <div className='flex-1 min-w-0'>
                  <p className='text-xs md:text-sm font-medium text-gray-800 truncate'>
                    {image.name || `Image ${index + 1}`}
                  </p>
                  <p className='text-xs text-gray-500'>
                    {(image.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                  {existingImages.length === 0 && index === 0 && (
                    <p className='text-[10px] md:text-xs font-semibold text-green-600'>
                      📌 Thumbnail
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className='flex items-center gap-1 flex-shrink-0'>
                  {/* Move Up */}
                  <button
                    type='button'
                    onClick={() => moveImage(index, index - 1)}
                    disabled={index === 0}
                    className='p-2 text-gray-600 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50 rounded active:bg-gray-300 min-w-[36px] h-9 flex items-center justify-center'
                    title='Move up'
                  >
                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                      <path
                        fillRule='evenodd'
                        d='M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </button>

                  {/* Move Down */}
                  <button
                    type='button'
                    onClick={() => moveImage(index, index + 1)}
                    disabled={index === images.length - 1}
                    className='p-2 text-gray-600 hover:bg-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50 rounded active:bg-gray-300 min-w-[36px] h-9 flex items-center justify-center'
                    title='Move down'
                  >
                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                      <path
                        fillRule='evenodd'
                        d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    type='button'
                    onClick={() => removeImage(index)}
                    className='p-2 text-red-600 hover:bg-red-100 rounded active:bg-red-200 min-w-[36px] h-9 flex items-center justify-center'
                    title='Delete'
                  >
                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                      <path
                        fillRule='evenodd'
                        d='M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      {getTotalImageCount() > 0 && (
        <div className='bg-blue-50 border border-blue-200 rounded-lg p-2.5 md:p-3'>
          <p className='text-xs md:text-sm text-blue-800'>
            <strong>ℹ️ Note:</strong> First image will be your property thumbnail
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className='bg-green-50 border border-green-200 rounded-lg p-2.5 md:p-3'>
        <div className='text-xs md:text-sm text-green-800 grid grid-cols-2 gap-1'>
          <div>✓ Min 1 image</div>
          <div>✓ Max 10 images</div>
          <div>✓ First = thumbnail</div>
          <div>✓ Max 5MB each</div>
        </div>
      </div>
    </div>
  )
}

export default ImageUploader
