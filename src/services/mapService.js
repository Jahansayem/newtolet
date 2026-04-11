/**
 * Geoapify Static Maps Service
 * Utility functions for generating static map URLs and navigation links
 */

// Default configuration
const GEOAPIFY_BASE_URL = 'https://maps.geoapify.com/v1/staticmap'
const DEFAULT_STYLE = 'osm-bright'
const DEFAULT_ZOOM = 15
const DEFAULT_WIDTH = 600
const DEFAULT_HEIGHT = 400

/**
 * Get the Geoapify API key from environment variables
 */
export const getGeoapifyApiKey = () => {
  return process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || ''
}

/**
 * URL encode a color value (handles # to %23 conversion)
 * @param {string} color - Color value (e.g., '#4f46e5' or 'red')
 * @returns {string} URL-encoded color
 */
const encodeColor = (color) => {
  if (color.startsWith('#')) {
    return '%23' + color.slice(1)
  }
  return encodeURIComponent(color)
}

/**
 * Generate a Geoapify Static Map URL
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} options - Optional configuration
 * @param {number} options.width - Image width in pixels (default: 600)
 * @param {number} options.height - Image height in pixels (default: 400)
 * @param {number} options.zoom - Zoom level 1-20 (default: 15)
 * @param {string} options.style - Map style (default: 'osm-bright')
 * @param {boolean} options.showMarker - Show location marker (default: true)
 * @param {string} options.markerColor - Marker color (default: '#4f46e5')
 * @param {string} options.markerIcon - Marker icon name (default: 'home')
 * @param {number} options.markerSize - Marker size in pixels (default: 64)
 * @param {number} options.scaleFactor - Scale factor 1-2 for retina (default: 1)
 * @returns {string} Full Geoapify Static Map URL
 */
export const generateStaticMapUrl = (lat, lng, options = {}) => {
  const apiKey = getGeoapifyApiKey()

  if (!apiKey) {
    console.warn('Geoapify API key not configured')
    return ''
  }

  if (!lat || !lng) {
    console.warn('Invalid coordinates provided')
    return ''
  }

  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    zoom = DEFAULT_ZOOM,
    style = DEFAULT_STYLE,
    showMarker = true,
    markerColor = '#4f46e5',
    markerIcon = 'home',
    markerSize = 64,
    scaleFactor = 1
  } = options

  // Build base URL with required parameters
  let url = `${GEOAPIFY_BASE_URL}?style=${style}`
  url += `&width=${width}`
  url += `&height=${height}`
  url += `&center=lonlat:${lng},${lat}`
  url += `&zoom=${zoom}`

  // Add scale factor for retina displays
  if (scaleFactor > 1) {
    url += `&scaleFactor=${Math.min(scaleFactor, 2)}`
  }

  // Add marker if enabled
  if (showMarker) {
    const encodedColor = encodeColor(markerColor)
    url += `&marker=lonlat:${lng},${lat}`
    url += `;type:material`
    url += `;color:${encodedColor}`
    url += `;size:${markerSize}`
    url += `;icon:${markerIcon}`
    url += `;icontype:awesome`
    url += `;contentcolor:%23ffffff`
    url += `;whitecircle:no`
  }

  // Add API key
  url += `&apiKey=${apiKey}`

  return url
}

/**
 * Generate a Google Maps URL for external navigation
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} options - Optional configuration
 * @param {number} options.zoom - Zoom level (default: 15)
 * @returns {string} Google Maps URL
 */
export const generateGoogleMapsLink = (lat, lng, options = {}) => {
  const { zoom = 15 } = options
  return `https://www.google.com/maps?q=${lat},${lng}&z=${zoom}`
}

/**
 * Generate a Google Maps directions URL
 * @param {number} lat - Destination latitude
 * @param {number} lng - Destination longitude
 * @returns {string} Google Maps directions URL
 */
export const generateGoogleMapsDirectionsLink = (lat, lng) => {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/**
 * Check if Geoapify API key is configured
 * @returns {boolean}
 */
export const isGeoapifyConfigured = () => {
  const apiKey = getGeoapifyApiKey()
  return apiKey && apiKey.length > 0 && apiKey !== 'YOUR_API_KEY'
}

/**
 * Available map styles
 */
export const MAP_STYLES = {
  OSM_BRIGHT: 'osm-bright',
  OSM_BRIGHT_GREY: 'osm-bright-grey',
  OSM_BRIGHT_SMOOTH: 'osm-bright-smooth',
  TONER_GREY: 'toner-grey',
  OSM_LIBERTY: 'osm-liberty',
  OSM_CARTO: 'osm-carto',
  DARK_MATTER: 'dark-matter',
  DARK_MATTER_BROWN: 'dark-matter-brown'
}

/**
 * Default coordinates for Bangladesh (Dhaka)
 */
export const DEFAULT_COORDINATES = {
  lat: 23.8103,
  lng: 90.4125
}
