'use client'

import { useLanguage } from '../i18n/useLanguage'

const SIZE_CLASSES = {
  xs: 'h-8 text-xs px-2.5',
  sm: 'h-10 min-w-11 text-xs px-3',
  md: 'h-10 text-sm px-3.5',
  lg: 'h-12 min-w-12 text-base px-4',
  xl: 'h-14 min-w-14 text-lg px-5',
}

const OPTIONS = [
  { value: 'en', label: 'EN', lang: 'en' },
  { value: 'bn', label: 'বাং', lang: 'bn' },
]

/**
 * EN / বাং language switch. Persists to localStorage via LanguageProvider.
 */
const LanguageToggle = ({ size = 'sm', className = '', variant = 'light' }) => {
  const { language, setLanguage, t } = useLanguage()
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm
  const isDark = variant === 'dark'

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={`inline-flex shrink-0 items-center overflow-hidden rounded-full border p-0.5 ${
        isDark ? 'border-white/20 bg-white/10' : 'border-slate-200 bg-slate-50'
      } ${className}`}
    >
      {OPTIONS.map((option) => {
        const isActive = language === option.value
        return (
          <button
            key={option.value}
            type="button"
            lang={option.lang}
            aria-pressed={isActive}
            onClick={() => setLanguage(option.value)}
            className={`inline-flex items-center justify-center rounded-full font-semibold leading-none transition ${sizeClass} ${
              isActive
                ? 'bg-brand text-white shadow-sm'
                : isDark
                  ? 'text-slate-200 hover:text-white'
                  : 'text-slate-600 hover:text-brand'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default LanguageToggle
