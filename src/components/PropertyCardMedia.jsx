import React, { useEffect, useState } from 'react'
import { formatRentAmount } from '../utils/rentDisplay'

const getFallbackType = ({ propertyType, category } = {}) => {
  const normalizedPropertyType = typeof propertyType === 'string' ? propertyType.trim() : ''
  const normalizedCategory = typeof category === 'string' ? category.trim() : ''

  return normalizedPropertyType || normalizedCategory || 'Property'
}

const getFallbackRent = ({ pricing, rentText } = {}) => {
  const normalizedRentText = typeof rentText === 'string' ? rentText.trim() : ''

  if (normalizedRentText) {
    return normalizedRentText
  }

  return formatRentAmount(pricing, { fallback: 'N/A' })
}

export const PropertyThumbnailFallback = ({
  propertyType,
  category,
  pricing = {},
  rentText = '',
  className = '',
  textClassName = '',
  style = {},
  compact = false,
}) => (
  <div
    className={`flex h-full w-full items-center justify-center bg-black text-center text-white ${compact ? 'px-1 py-1' : 'px-3 py-4'} ${className}`}
    style={style}
  >
    <div className={`max-w-full space-y-1 font-bold leading-tight ${textClassName}`}>
      <p className={`break-words ${compact ? 'text-[0.55rem]' : 'text-[clamp(0.875rem,3.7vw,1.25rem)]'}`}>
        {getFallbackType({ propertyType, category })}
      </p>
      <p className={`break-words ${compact ? 'text-[0.5rem]' : 'text-[clamp(0.75rem,3vw,1rem)]'}`}>
        Rent : {getFallbackRent({ pricing, rentText })}
      </p>
    </div>
  </div>
)

export const PropertyThumbnailImage = ({
  src,
  alt,
  propertyType,
  category,
  pricing = {},
  rentText = '',
  className = 'h-full w-full object-cover',
  fallbackClassName = '',
  fallbackTextClassName = '',
  loading = 'lazy',
  decoding = 'async',
  style = {},
  compact = false,
}) => {
  const [hasImageError, setHasImageError] = useState(false)
  const normalizedSrc = typeof src === 'string' ? src.trim() : ''

  useEffect(() => {
    setHasImageError(false)
  }, [normalizedSrc])

  const showImage = Boolean(normalizedSrc) && !hasImageError

  if (showImage) {
    return (
      <img
        src={normalizedSrc}
        alt={alt}
        className={className}
        style={style}
        loading={loading}
        decoding={decoding}
        onError={() => {
          setHasImageError(true)
        }}
      />
    )
  }

  return (
    <PropertyThumbnailFallback
      propertyType={propertyType}
      category={category}
      pricing={pricing}
      rentText={rentText}
      className={fallbackClassName}
      textClassName={fallbackTextClassName}
      style={style}
      compact={compact}
    />
  )
}

const PropertyCardMedia = ({
  src,
  alt,
  eager = false,
  propertyType,
  category,
  pricing = {},
  rentText = '',
}) => {
  return (
    <div className="relative">
      <PropertyThumbnailImage
        src={src}
        alt={alt}
        propertyType={propertyType}
        category={category}
        pricing={pricing}
        rentText={rentText}
        className="w-full object-cover"
        fallbackClassName="w-full"
        loading={eager ? 'eager' : 'lazy'}
        style={{ aspectRatio: '3/2' }}
      />
    </div>
  )
}

export default PropertyCardMedia
