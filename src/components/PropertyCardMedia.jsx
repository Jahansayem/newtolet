import React, { useEffect, useState } from 'react'

const PropertyCardMedia = ({ src, alt, eager = false }) => {
  const [hasImageError, setHasImageError] = useState(false)
  const normalizedSrc = typeof src === 'string' ? src.trim() : ''

  useEffect(() => {
    setHasImageError(false)
  }, [normalizedSrc])

  const showImage = Boolean(normalizedSrc) && !hasImageError

  return (
    <div className="relative">
      {showImage ? (
        <img
          src={normalizedSrc}
          alt={alt}
          className="w-full object-cover"
          style={{ aspectRatio: '3/2' }}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => {
            setHasImageError(true)
          }}
        />
      ) : (
        <div
          className="w-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-500"
          style={{ aspectRatio: '3/2' }}
        >
          <div className="text-center p-4">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <p className="text-sm font-medium">No Image</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PropertyCardMedia
