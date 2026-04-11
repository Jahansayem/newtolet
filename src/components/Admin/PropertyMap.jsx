import React from 'react';
import { FiMapPin, FiExternalLink } from 'react-icons/fi';

/**
 * PropertyMap Component
 * Displays a map preview for a property using OpenStreetMap (free, no API key required)
 */
const PropertyMap = ({ lat, lng, address, className = '' }) => {
  // Default to Dhaka if no coordinates provided
  const mapLat = lat || 23.8103;
  const mapLng = lng || 90.4125;

  // OpenStreetMap embed URL (free, no API key needed)
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.01}%2C${mapLat - 0.01}%2C${mapLng + 0.01}%2C${mapLat + 0.01}&layer=mapnik&marker=${mapLat}%2C${mapLng}`;

  // Google Maps link for opening in new tab
  const googleMapsUrl = `https://www.google.com/maps?q=${mapLat},${mapLng}`;

  const hasValidCoordinates = lat && lng && !isNaN(lat) && !isNaN(lng);

  if (!hasValidCoordinates) {
    return (
      <div className={`bg-gray-100 rounded-lg p-4 text-center ${className}`}>
        <FiMapPin className="text-gray-400 text-2xl mx-auto mb-2" />
        <p className="text-sm text-gray-500">No location coordinates set</p>
      </div>
    );
  }

  return (
    <div className={`property-map ${className}`}>
      <div className="relative">
        {/* OpenStreetMap iframe */}
        <iframe
          src={osmEmbedUrl}
          title="Property Location Map"
          className="w-full h-48 rounded-lg border border-gray-200"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* View on Google Maps button */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 bg-white px-3 py-1.5 rounded-lg shadow-md text-xs font-medium text-gray-700 hover:text-primary-600 hover:shadow-lg transition-all flex items-center gap-1"
        >
          <FiExternalLink size={12} />
          Open in Maps
        </a>
      </div>

      {/* Location details */}
      {address && (
        <div className="mt-2 flex items-start gap-2 text-sm text-gray-600">
          <FiMapPin className="text-primary-600 mt-0.5 flex-shrink-0" />
          <span className="truncate">{address}</span>
        </div>
      )}

      {/* Coordinates display */}
      <div className="mt-1 text-xs text-gray-400">
        {mapLat.toFixed(4)}, {mapLng.toFixed(4)}
      </div>
    </div>
  );
};

/**
 * CompactPropertyMap Component
 * Smaller version for property cards
 */
const CompactPropertyMap = ({ lat, lng, className = '' }) => {
  const mapLat = lat || 23.8103;
  const mapLng = lng || 90.4125;

  const hasValidCoordinates = lat && lng && !isNaN(lat) && !isNaN(lng);

  if (!hasValidCoordinates) {
    return (
      <div className={`bg-gray-100 rounded-lg p-2 text-center ${className}`}>
        <FiMapPin className="text-gray-400 text-lg mx-auto" />
      </div>
    );
  }

  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.005}%2C${mapLat - 0.005}%2C${mapLng + 0.005}%2C${mapLat + 0.005}&layer=mapnik&marker=${mapLat}%2C${mapLng}`;

  return (
    <div className={`relative ${className}`}>
      <iframe
        src={osmEmbedUrl}
        title="Property Location"
        className="w-full h-24 rounded-lg border border-gray-200"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="absolute bottom-1 right-1 bg-white/90 px-1.5 py-0.5 rounded text-[10px] text-gray-600">
        <FiMapPin size={10} />
      </div>
    </div>
  );
};

export { PropertyMap, CompactPropertyMap };
export default PropertyMap;
