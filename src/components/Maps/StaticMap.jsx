import React from 'react'
import { FiExternalLink, FiNavigation } from 'react-icons/fi'
import {
  generateStaticMapUrl,
  generateGoogleMapsLink,
  generateGoogleMapsDirectionsLink,
  isGeoapifyConfigured
} from '../../services/mapService'

/**
 * StaticMap Component
 * Displays a static map image from Geoapify with optional marker and navigation links
 */
const StaticMap = ({
  lat,
  lng,
  width = 600,
  height = 400,
  zoom = 15,
  style = 'osm-bright',
  showMarker = true,
  markerColor = '#4f46e5',
  markerIcon = 'home',
  markerSize = 64,
  scaleFactor = 1,
  alt = 'Location map',
  className = '',
  showNavigationLinks = true,
  showAttribution = true,
  propertyInfo = null
}) => {
  // Check if API is configured
  if (!isGeoapifyConfigured()) {
    return (
      <div className='bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded text-yellow-800'>
        <p className='font-bold text-lg mb-3'>Map Not Available</p>
        <p className='mb-4'>
          Map functionality requires Geoapify API configuration.
        </p>
        <div className='bg-white p-4 rounded border border-yellow-300 mb-4'>
          <p className='text-sm font-mono text-gray-700 mb-2'>
            Add to .env.local file:
          </p>
          <p className='text-sm font-mono text-gray-700 bg-gray-100 p-2 rounded'>
            VITE_GEOAPIFY_API_KEY=your_api_key
          </p>
        </div>
        {lat && lng && (
          <p className='text-yellow-700 text-sm'>
            <strong>Coordinates:</strong> {lat.toFixed(4)}, {lng.toFixed(4)}
          </p>
        )}
      </div>
    )
  }

  // Check if coordinates are provided
  if (!lat || !lng) {
    return (
      <div className='bg-gray-100 border border-gray-300 rounded-lg p-6 text-center text-gray-600'>
        <p className='font-medium'>Location coordinates not available</p>
        <p className='text-sm mt-1'>
          This property does not have map coordinates set.
        </p>
      </div>
    )
  }

  // Generate map URL
  const mapUrl = generateStaticMapUrl(lat, lng, {
    width,
    height,
    zoom,
    style,
    showMarker,
    markerColor,
    markerIcon,
    markerSize,
    scaleFactor
  })

  // Generate navigation links
  const googleMapsUrl = generateGoogleMapsLink(lat, lng, { zoom })
  const directionsUrl = generateGoogleMapsDirectionsLink(lat, lng)

  return (
    <div className={`relative ${className}`}>
      {/* Map Image */}
      <div className='relative overflow-hidden rounded-lg'>
        <img
          src={mapUrl}
          alt={alt}
          width={width}
          height={height}
          className='w-full h-auto object-cover'
          loading='lazy'
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
          }}
        />
        {/* Error fallback */}
        <div
          className='hidden items-center justify-center bg-gray-200 text-gray-500'
          style={{ width: '100%', height: `${height}px` }}
        >
          <p>Failed to load map</p>
        </div>

        {/* Property info overlay */}
        {propertyInfo && (
          <div className='absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg max-w-xs'>
            <h4 className='font-bold text-gray-900'>{propertyInfo.title}</h4>
            {propertyInfo.subtitle && (
              <p className='text-sm text-gray-600 mt-0.5'>
                {propertyInfo.subtitle}
              </p>
            )}
            {propertyInfo.price && (
              <p className='text-sm font-bold text-primary-600 mt-1'>
                {propertyInfo.price}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      {showNavigationLinks && (
        <div className='flex gap-3 mt-3'>
          <a
            href={googleMapsUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition font-medium text-sm'
          >
            <FiExternalLink size={18} />
            Open in Google Maps
          </a>
          <a
            href={directionsUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium text-sm'
          >
            <FiNavigation size={18} />
            Get Directions
          </a>
        </div>
      )}

      {/* Attribution */}
      {showAttribution && (
        <div className='mt-2 text-xs text-gray-500 text-center'>
          Powered by{' '}
          <a
            href='https://www.geoapify.com/'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary-600 hover:underline'
          >
            Geoapify
          </a>{' '}
          |{' '}
          <a
            href='https://www.openstreetmap.org/copyright'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary-600 hover:underline'
          >
            © OpenStreetMap
          </a>{' '}
          |{' '}
          <a
            href='http://openmaptiles.org/'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary-600 hover:underline'
          >
            © OpenMapTiles
          </a>
        </div>
      )}
    </div>
  )
}

export default StaticMap
