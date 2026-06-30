import React from 'react';

/**
 * NewTolet.com Logo Component
 * Usage: <NewToletLogo size="large" /> or <NewToletLogo size="small" variant="light" />
 */
export const NewToletLogo = ({
  size = 'medium',
  variant = 'dark', // 'dark' for light text, 'light' for dark text
  showIcon = true,
  className = '',
}) => {
  const sizes = {
    small: { height: 24, fontSize: '14px', iconSize: 24 },
    medium: { height: 32, fontSize: '18px', iconSize: 32 },
    large: { height: 48, fontSize: '28px', iconSize: 48 },
    xlarge: { height: 64, fontSize: '36px', iconSize: 64 },
  };

  const { height, fontSize, iconSize } = sizes[size] || sizes.medium;

  const textColor = variant === 'dark' ? '#ffffff' : '#1a1a2e';

  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ height }}>
      {/* Icon - Stylized "L" shape with gradient */}
      {showIcon && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 64 64" fill="none">
          {/* Background circle */}
          <rect width="64" height="64" rx="12" fill="#1a1a2e" />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>

          {/* Main L-shaped element */}
          <path
            d="M20 12 L32 12 L32 36 L44 36 L44 44 L20 44 Z"
            fill="url(#blueGradient)"
          />

          {/* Diagonal accent */}
          <path d="M32 12 L44 24 L40 28 L28 16 Z" fill="#60a5fa" opacity={0.8} />

          {/* 2x2 grid squares (window pattern) */}
          <rect x="46" y="12" width="6" height="6" rx="1" fill="#3b82f6" />
          <rect x="54" y="12" width="6" height="6" rx="1" fill="#1d4ed8" />
          <rect x="46" y="20" width="6" height="6" rx="1" fill="#2563eb" />
          <rect x="54" y="20" width="6" height="6" rx="1" fill="#1e40af" />
        </svg>
      )}

      {/* Text Logo */}
      <div className="flex flex-col">
        <span
          className="font-bold tracking-tight leading-none"
          style={{ color: textColor, fontSize }}
        >
          NewTolet<span className="font-normal opacity-80">.Com</span>
        </span>
      </div>
    </div>
  );
};

/**
 * Horizontal Logo with Icon and Text side by side
 */
export const NewToletLogoHorizontal = ({ variant = 'dark', className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="12" fill="#1a1a2e" />
      <defs>
        <linearGradient id="blueGradientH" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M20 12 L32 12 L32 36 L44 36 L44 44 L20 44 Z" fill="url(#blueGradientH)" />
      <path d="M32 12 L44 24 L40 28 L28 16 Z" fill="#60a5fa" opacity={0.8} />
    </svg>
    <span
      className={`text-xl font-bold tracking-tight ${
        variant === 'dark' ? 'text-white' : 'text-gray-900'
      }`}
    >
      NewTolet<span className="font-normal opacity-80">.Com</span>
    </span>
  </div>
);

/**
 * Text-only Logo (no icon)
 */
export const NewToletLogoText = ({ variant = 'dark', size = 'medium', className = '' }) => {
  const sizes = {
    small: 'text-sm',
    medium: 'text-xl',
    large: 'text-3xl',
    xlarge: 'text-4xl',
  };

  return (
    <span
      className={`font-bold tracking-tight ${sizes[size]} ${
        variant === 'dark' ? 'text-white' : 'text-gray-900'
      } ${className}`}
    >
      NewTolet<span className="font-normal opacity-80">.Com</span>
    </span>
  );
};

/**
 * Icon-only Logo (no text)
 */
export const NewToletLogoIcon = ({ size = 40, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
    <rect width="64" height="64" rx="12" fill="#1a1a2e" />
    <defs>
      <linearGradient id="blueGradientIcon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
    </defs>
    <path d="M20 12 L32 12 L32 36 L44 36 L44 44 L20 44 Z" fill="url(#blueGradientIcon)" />
    <path d="M32 12 L44 24 L40 28 L28 16 Z" fill="#60a5fa" opacity={0.8} />
    <rect x="46" y="12" width="6" height="6" rx="1" fill="#3b82f6" />
    <rect x="54" y="12" width="6" height="6" rx="1" fill="#1d4ed8" />
    <rect x="46" y="20" width="6" height="6" rx="1" fill="#2563eb" />
    <rect x="54" y="20" width="6" height="6" rx="1" fill="#1e40af" />
  </svg>
);

export default NewToletLogo;
