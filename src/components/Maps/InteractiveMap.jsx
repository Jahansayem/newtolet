import React, { useState, useEffect } from 'react'
import { FiExternalLink, FiNavigation, FiMaximize2, FiMinimize2 } from 'react-icons/fi'

/**
 * InteractiveMap Component
 * Displays an interactive OpenStreetMap using Leaflet (no API key required)
 */
const InteractiveMap = ({
  lat,
  lng,
  width = '100%',
  height = '400px',
  zoom = 15,
  showMarker = true,
  markerColor = '#1E73B8',
  alt = 'Location map',
  className = '',
  showNavigationLinks = true,
  propertyInfo = null
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  // Check if coordinates are provided
  if (!lat || !lng) {
    return (
      <div className='bg-gray-100 border border-gray-300 rounded-lg p-6 text-center text-gray-600' style={{ height }}>
        <svg className='w-12 h-12 mx-auto mb-3 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' />
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 11a3 3 0 11-6 0 3 3 0 016 0z' />
        </svg>
        <p className='font-medium'>Location coordinates not available</p>
        <p className='text-sm mt-1'>This property does not have map coordinates set.</p>
      </div>
    )
  }

  // Generate navigation links
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=${zoom}`
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`

  // Create OpenStreetMap embed URL
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01}%2C${lat-0.01}%2C${lng+0.01}%2C${lat+0.01}&layer=mapnik&marker=${lat}%2C${lng}`

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-white'
    : `relative ${className}`

  const mapHeight = isFullscreen ? '100vh' : height

  return (
    <div className={containerClass}>
      {/* Map Container */}
      <div className='relative overflow-hidden rounded-lg' style={{ height: mapHeight, width: isFullscreen ? '100%' : width }}>
        <iframe
          title={alt}
          src={embedUrl}
          width='100%'
          height='100%'
          style={{ border: 0 }}
          allowFullScreen
          loading='lazy'
          referrerPolicy='no-referrer-when-downgrade'
          className='w-full h-full'
          onLoad={() => setMapReady(true)}
        />

        {/* Fullscreen Toggle */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className='absolute top-3 right-3 p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition z-10'
          title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
        >
          {isFullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
        </button>

        {/* Property info overlay */}
        {propertyInfo && !isFullscreen && (
          <div className='absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg max-w-xs'>
            <h4 className='font-bold text-gray-900'>{propertyInfo.title}</h4>
            {propertyInfo.subtitle && (
              <p className='text-sm text-gray-600 mt-0.5'>{propertyInfo.subtitle}</p>
            )}
            {propertyInfo.price && (
              <p className='text-sm font-bold text-[#1E73B8] mt-1'>{propertyInfo.price}</p>
            )}
          </div>
        )}

        {/* Close button in fullscreen mode */}
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className='absolute top-3 left-3 px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition font-medium z-10'
          >
            Close Map
          </button>
        )}
      </div>

      {/* Navigation Links */}
      {showNavigationLinks && !isFullscreen && (
        <div className='flex flex-wrap gap-3 mt-3'>
          <a
            href={googleMapsUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium text-sm'
          >
            <FiExternalLink size={18} />
            Google Maps
          </a>
          <a
            href={directionsUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium text-sm'
          >
            <FiNavigation size={18} />
            Get Directions
          </a>
          <a
            href={osmUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition font-medium text-sm'
          >
            <FiExternalLink size={18} />
            OpenStreetMap
          </a>
        </div>
      )}

      {/* Coordinates display */}
      {!isFullscreen && (
        <div className='mt-2 text-xs text-gray-500 text-center'>
          Coordinates: {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}
        </div>
      )}
    </div>
  )
}

export default InteractiveMap
