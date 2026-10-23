export const SUPPORTED_LANGUAGES = ['en', 'bn']
export const DEFAULT_LANGUAGE = 'en'
export const LANGUAGE_STORAGE_KEY = 'appLanguage'
export const LANGUAGE_EVENT = 'app-language-updated'

export const normalizeLanguage = (value) =>
  SUPPORTED_LANGUAGES.includes(value) ? value : DEFAULT_LANGUAGE

export const readStoredLanguage = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
  } catch {
    return DEFAULT_LANGUAGE
  }
}

export const getServerLanguage = () => DEFAULT_LANGUAGE

export const applyLanguage = (value) => {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE
  }

  const language = normalizeLanguage(value)

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch (error) {
    console.error('Failed to persist app language locally:', error)
  }

  document.documentElement.lang = language
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: { language } }))

  return language
}

export const subscribeToLanguage = (callback) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleStorage = (event) => {
    if (!event.key || event.key === LANGUAGE_STORAGE_KEY) {
      callback()
    }
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(LANGUAGE_EVENT, callback)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(LANGUAGE_EVENT, callback)
  }
}
