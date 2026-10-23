import React, { useEffect, useState } from 'react'
import { FiHome } from 'react-icons/fi'
import { formatRentAmount } from '../utils/rentDisplay'
import { useLanguage } from '../i18n/useLanguage'

const getFallbackType = ({ propertyType, category, tv, fallbackLabel } = {}) => {
  const normalizedPropertyType = typeof propertyType === 'string' ? propertyType.trim() : ''
  const normalizedCategory = typeof category === 'string' ? category.trim() : ''

  return (
    tv('propertyTypes', normalizedPropertyType) ||
    tv('categories', normalizedCategory) ||
    fallbackLabel
  )
}

const getFallbackRent = ({ pricing, rentText, fallback, negotiableLabel } = {}) => {
  const normalizedRentText = typeof rentText === 'string' ? rentText.trim() : ''

  if (normalizedRentText) {
    return normalizedRentText
  }

  return formatRentAmount(pricing, { fallback, negotiableLabel })
}

/**
 * Neutral placeholder for listings without a photo. `showRent` is on by default for the
 * thumbnails in dashboards/admin; the listing card hides it because the rent is in the card body.
 */
export const PropertyThumbnailFallback = ({
  propertyType,
  category,
  pricing = {},
  rentText = '',
  className = '',
  textClassName = '',
  style = {},
  compact = false,
  showRent = true,
}) => {
  const { t, tv } = useLanguage()

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-slate-200 text-center text-ink ${compact ? 'px-1 py-1' : 'px-3 py-4'} ${className}`}
      style={style}
    >
      <div className={`max-w-full space-y-1 font-semibold leading-tight ${textClassName}`}>
        {compact ? null : <FiHome className="mx-auto mb-1 text-2xl text-muted" aria-hidden="true" />}
        <p className={`break-words ${compact ? 'text-[0.55rem]' : 'text-[clamp(0.875rem,3.2vw,1.05rem)]'}`}>
          {getFallbackType({
            propertyType,
            category,
            tv,
            fallbackLabel: t('listing.media.fallbackType'),
          })}
        </p>
        {showRent ? (
          <p className={`break-words text-muted ${compact ? 'text-[0.5rem]' : 'text-[clamp(0.75rem,2.6vw,0.9rem)]'}`}>
            {t('listing.media.rent', {
              rent: getFallbackRent({
                pricing,
                rentText,
                fallback: t('common.na'),
                negotiableLabel: t('listing.negotiable'),
              }),
            })}
          </p>
        ) : null}
      </div>
    </div>
  )
}

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
  showRent = true,
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
      showRent={showRent}
    />
  )
}

/**
 * Listing-card media: 4:3 photo (phone cameras shoot 4:3, so uploads crop least) with at most one
 * overlay — the "promoted" badge. Price and status live in the card body, never on the photo.
 */
const PropertyCardMedia = ({
  src,
  alt,
  eager = false,
  propertyType,
  category,
  pricing = {},
  rentText = '',
  isPinned = false,
}) => {
  const { t } = useLanguage()

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
      <PropertyThumbnailImage
        src={src}
        alt={alt}
        propertyType={propertyType}
        category={category}
        pricing={pricing}
        rentText={rentText}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        fallbackClassName="h-full w-full"
        loading={eager ? 'eager' : 'lazy'}
        showRent={false}
      />
      {isPinned ? (
        <span className="ui-badge ui-badge-promoted absolute left-2.5 top-2.5 shadow-card">
          {t('listing.card.pinned')}
        </span>
      ) : null}
    </div>
  )
}

export default PropertyCardMedia
