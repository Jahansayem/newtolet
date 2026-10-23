import { DEFAULT_LANGUAGE, normalizeLanguage } from './config'
import en from './locales/en'
import bn from './locales/bn'

const locales = { en, bn }

const reportedMissingKeys = new Set()

const getPath = (source, path) => {
  if (!source || typeof path !== 'string') {
    return undefined
  }

  return path.split('.').reduce((current, segment) => {
    if (current === null || current === undefined) {
      return undefined
    }
    return current[segment]
  }, source)
}

const warnMissingKey = (language, key) => {
  if (process.env.NODE_ENV === 'production') {
    return
  }

  const token = `${language}:${key}`
  if (reportedMissingKeys.has(token)) {
    return
  }

  reportedMissingKeys.add(token)
  console.warn(`[i18n] Missing "${language}" translation for "${key}"`)
}

export const interpolate = (template, vars) => {
  if (typeof template !== 'string' || !vars) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined || vars[name] === null ? match : String(vars[name])
  )
}

const lookup = (language, key) => {
  const localized = getPath(locales[language], key)
  if (localized !== undefined) {
    return localized
  }

  if (language !== DEFAULT_LANGUAGE) {
    warnMissingKey(language, key)
    const fallback = getPath(locales[DEFAULT_LANGUAGE], key)
    if (fallback !== undefined) {
      return fallback
    }
  } else {
    warnMissingKey(language, key)
  }

  return undefined
}

/**
 * Translate a dot-path key with optional `{var}` interpolation.
 * Falls back to English, then to the key itself so gaps are visible.
 */
export const translate = (language, key, vars) => {
  const value = lookup(normalizeLanguage(language), key)
  if (typeof value === 'string') {
    return interpolate(value, vars)
  }
  return value === undefined ? key : value
}

/**
 * Translate a database/enum value by namespace. Returns the raw value when
 * there is no mapping, never the key path.
 */
export const translateValue = (language, namespace, value) => {
  if (value === null || value === undefined || value === '') {
    return value
  }

  const lang = normalizeLanguage(language)
  const localized = getPath(locales[lang], `values.${namespace}.${value}`)
  if (typeof localized === 'string') {
    return localized
  }

  const fallback = getPath(locales[DEFAULT_LANGUAGE], `values.${namespace}.${value}`)
  return typeof fallback === 'string' ? fallback : String(value)
}

/**
 * Count-aware translation. Looks for `${key}_one` / `${key}_other`, then `key`.
 */
export const translateCount = (language, key, count, vars) => {
  const lang = normalizeLanguage(language)
  const numeric = Number(count) || 0
  const suffix = numeric === 1 ? '_one' : '_other'
  const mergedVars = { count: numeric, ...vars }

  const specific = getPath(locales[lang], `${key}${suffix}`)
  if (typeof specific === 'string') {
    return interpolate(specific, mergedVars)
  }

  const base = getPath(locales[lang], key)
  if (typeof base === 'string') {
    return interpolate(base, mergedVars)
  }

  return translate(DEFAULT_LANGUAGE, `${key}${suffix}`, mergedVars)
}

export const getDictionary = (language) => locales[normalizeLanguage(language)] || locales[DEFAULT_LANGUAGE]

export const getLocales = () => locales
