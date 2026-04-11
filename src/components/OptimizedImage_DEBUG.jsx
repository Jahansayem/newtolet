import React from 'react';

/**
 * SIMPLIFIED DEBUG VERSION - Use this if OptimizedImage has issues
 * Just replace: import OptimizedImage from './OptimizedImage'
 * With: import OptimizedImage from './OptimizedImage_DEBUG'
 */
const OptimizedImage = ({
  src,
  alt = '',
  width = 300,
  height = 200,
  className = '',
  priority = false,
  objectFit = 'cover',
  onError,
  ...props
}) => {
  // Inline SVG fallback (never causes 404 errors)
  const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="150"%3E%3Crect width="300" height="150" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';

  console.log('🖼️ OptimizedImage rendering:', { src, alt, width, height });

  if (!src) {
    console.warn('⚠️ No src provided to OptimizedImage');
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={{ width: '100%', height: `${height}px` }}
      >
        <span className="text-gray-400 text-xs">No Image</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onError={(e) => {
          console.error('❌ Image failed to load:', src);
          console.error('   Using fallback image');
          e.target.src = FALLBACK_IMAGE;
          onError?.(e);
        }}
        onLoad={() => console.log('✅ Image loaded:', src?.substring(0, 50))}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectFit }}
      />
    </div>
  );
};

export default OptimizedImage;
