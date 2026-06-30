/**
 * Image Optimization Utilities
 * Leverages Supabase Storage built-in image transformations
 * https://supabase.com/docs/guides/storage/image-transformations
 */

/**
 * Generate optimized image URL using Supabase transforms
 * @param {string} imageUrl - Original Supabase Storage URL
 * @param {object} options - Transformation options
 * @param {number} options.width - Target width
 * @param {number} options.height - Target height
 * @param {string} options.format - Output format (webp, avif, jpg, png)
 * @param {number} options.quality - Quality 1-100 (default 80)
 * @returns {string} Optimized image URL
 */
export const getOptimizedImageUrl = (imageUrl, options = {}) => {
  // Inline SVG placeholder (always works, no 404 errors)
  const FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="150"%3E%3Crect width="300" height="150" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';

  // Handle null, undefined, or empty URLs
  if (!imageUrl || imageUrl === '') {
    return FALLBACK;
  }

  const {
    width,
    height,
    format = 'webp',
    quality = 80,
    resize = 'cover', // cover, contain, fill
  } = options;

  if (!isSupabaseImage(imageUrl)) {
    // Not a Supabase URL, return original URL (works for external URLs, data URLs, etc.)
    return imageUrl;
  }

  // Replace /object/public with /render/image/public for transformations
  let transformUrl = imageUrl.replace(
    '/object/public/',
    '/render/image/public/'
  );

  // Build transformation parameters
  const params = new URLSearchParams();

  if (width) params.append('width', width.toString());
  if (height) params.append('height', height.toString());
  if (format) params.append('format', format);
  if (quality) params.append('quality', quality.toString());
  if (resize) params.append('resize', resize);

  // Append params to URL
  const separator = transformUrl.includes('?') ? '&' : '?';
  const optimizedUrl = `${transformUrl}${separator}${params.toString()}`;

  return optimizedUrl;
};

/**
 * Generate multiple srcset URLs for responsive images
 * @param {string} imageUrl - Original image URL
 * @param {number} baseWidth - Base width for calculations
 * @returns {string} srcset string
 */
export const generateSrcSet = (imageUrl, baseWidth = 300) => {
  const sizes = [
    { width: Math.round(baseWidth * 0.5), descriptor: '0.5x' },
    { width: baseWidth, descriptor: '1x' },
    { width: Math.round(baseWidth * 1.5), descriptor: '1.5x' },
    { width: Math.round(baseWidth * 2), descriptor: '2x' },
  ];

  return sizes
    .map(({ width, descriptor }) => {
      const url = getOptimizedImageUrl(imageUrl, { width, format: 'webp' });
      return `${url} ${descriptor}`;
    })
    .join(', ');
};

/**
 * Generate blur placeholder (inline SVG data URL)
 * @param {string} color - Base color (default: gray)
 * @returns {string} Data URL for blur placeholder
 */
export const generateBlurDataURL = (color = '#e5e7eb') => {
  // Tiny inline SVG blur placeholder - 10x10px
  const svg = `
    <svg width="10" height="10" xmlns="http://www.w3.org/2000/svg">
      <rect width="10" height="10" fill="${color}"/>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg.trim())}`;
};

/**
 * Preload critical images for better perceived performance
 * @param {string[]} imageUrls - Array of image URLs to preload
 * @param {object} options - Optimization options
 */
export const preloadImages = (imageUrls, options = {}) => {
  if (!imageUrls || imageUrls.length === 0) return;

  imageUrls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = getOptimizedImageUrl(url, { width: 300, format: 'webp', ...options });

    // Optional: Add responsive preload
    if (options.srcset) {
      link.setAttribute('imagesrcset', generateSrcSet(url, options.width || 300));
    }

    document.head.appendChild(link);
  });
};

/**
 * Check if image is from Supabase Storage
 * @param {string} url - Image URL
 * @returns {boolean}
 */
export const isSupabaseImage = (url) => {
  if (!url) return false;

  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.pathname.includes('/storage/v1/object/public/') ||
      parsedUrl.pathname.includes('/storage/v1/render/image/public/')
    );
  } catch {
    return (
      url.includes('/storage/v1/object/public/') ||
      url.includes('/storage/v1/render/image/public/')
    );
  }
};

/**
 * Get image dimensions from Supabase (requires auth)
 * For public display, we estimate based on aspect ratio
 * @param {number} width - Display width
 * @param {number} aspectRatio - Width/height ratio (default 3/2)
 * @returns {object} {width, height}
 */
export const estimateDimensions = (width, aspectRatio = 3 / 2) => {
  return {
    width,
    height: Math.round(width / aspectRatio),
  };
};

/**
 * Calculate optimal image width based on viewport and grid columns
 * @param {number} columns - Number of grid columns
 * @param {number} maxWidth - Max container width (default 1280)
 * @param {number} gap - Grid gap in pixels (default 16)
 * @returns {number} Optimal image width
 */
export const calculateOptimalWidth = (columns = 5, maxWidth = 1280, gap = 16) => {
  const totalGaps = (columns - 1) * gap;
  const availableWidth = maxWidth - totalGaps;
  return Math.round(availableWidth / columns);
};

export default {
  getOptimizedImageUrl,
  generateSrcSet,
  generateBlurDataURL,
  preloadImages,
  isSupabaseImage,
  estimateDimensions,
  calculateOptimalWidth,
};
