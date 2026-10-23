import { normalizeLanguage } from './config'

const DATE_LOCALES = {
  en: 'en-US',
  bn: 'bn-BD',
}

export const getDateLocale = (language) => DATE_LOCALES[normalizeLanguage(language)] || DATE_LOCALES.en

/**
 * Locale-aware date formatting that keeps Western (Latin) digits in Bengali.
 * Returns an empty string for invalid input so callers can show a fallback.
 */
export const formatDate = (value, language, options = {}) => {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  try {
    return new Intl.DateTimeFormat(getDateLocale(language), {
      numberingSystem: 'latn',
      ...options,
    }).format(date)
  } catch {
    return date.toLocaleDateString('en-US', options)
  }
}

export const formatDateTime = (value, language, options = {}) =>
  formatDate(value, language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  })

export const formatMonthYear = (value, language) =>
  formatDate(value, language, { month: 'long', year: 'numeric' })
