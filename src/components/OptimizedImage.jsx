import React, { useState, useEffect, useRef } from 'react';
import { getOptimizedImageUrl, generateBlurDataURL, isSupabaseImage } from '../utils/imageOptimization';

/**
 * OptimizedImage component with lazy loading, blur placeholder, and responsive images
 *
 * @param {string} src - Original image URL
 * @param {string} alt - Alt text for accessibility
 * @param {number} width - Target display width in pixels
 * @param {number} height - Target display height in pixels
 * @param {string} className - CSS classes
 * @param {boolean} priority - Load with high priority (first visible images)
 * @param {string} objectFit - CSS object-fit value
 * @param {function} onError - Error callback
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority); // Priority images start as "in view"
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01,
      }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority]);

  // Generate responsive image URLs using Supabase transforms
  const generateSrcSet = () => {
    if (!src || hasError) return '';

    // Only generate srcset for Supabase images
    if (!isSupabaseImage(src)) return ''; // Let browser use single src for non-Supabase images

    const sizes = [
      { width: Math.round(width * 0.5), descriptor: '1x' },
      { width: Math.round(width), descriptor: '2x' },
      { width: Math.round(width * 1.5), descriptor: '3x' },
    ];

    return sizes
      .map(({ width: w, descriptor }) => {
        const url = getOptimizedImageUrl(src, { width: w, format: 'webp' });
        return `${url} ${descriptor}`;
      })
      .join(', ');
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = (e) => {
    setHasError(true);
    setIsLoaded(true); // Show fallback immediately
    onError?.(e);
  };

  // Optimized image URL (WebP, resized)
  // Use online placeholder if local one doesn't exist
  const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="150"%3E%3Crect width="300" height="150" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';

  const optimizedSrc = hasError
    ? FALLBACK_IMAGE
    : (src ? getOptimizedImageUrl(src, { width, format: 'webp' }) : FALLBACK_IMAGE);

  // Blur placeholder (inline SVG for zero network requests)
  const blurPlaceholder = generateBlurDataURL();

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: `${width} / ${height}`,
        backgroundColor: '#f3f4f6', // gray-100 fallback
      }}
      {...props}
    >
      {/* Blur placeholder - shown until image loads */}
      {!isLoaded && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            backgroundImage: `url("${blurPlaceholder}")`,
            backgroundSize: 'cover',
            filter: 'blur(20px)',
            transform: 'scale(1.1)', // Prevent blur edges
          }}
        />
      )}

      {/* Actual image - only load when in viewport (unless priority) */}
      {isInView && (
        <img
          src={optimizedSrc}
          srcSet={generateSrcSet()}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={handleLoad}
          onError={handleError}
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ objectFit }}
        />
      )}

      {/* Loading skeleton animation */}
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}
    </div>
  );
};

export default OptimizedImage;
