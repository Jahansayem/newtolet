'use client'

import { createContext, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  applyLanguage,
  getServerLanguage,
  normalizeLanguage,
  readStoredLanguage,
  subscribeToLanguage,
} from './config'

export const LanguageContext = createContext(null)

/**
 * Provides the language setters and keeps <html lang> in sync.
 * Translation helpers and the current language are produced by `useLanguage()` in
 * each consumer (see useLanguage.js for why), so the context value is stable and
 * does not depend on the language itself.
 */
export const LanguageProvider = ({ children }) => {
  // Server snapshot is always 'en' so hydration matches the static HTML.
  const language = useSyncExternalStore(subscribeToLanguage, readStoredLanguage, getServerLanguage)

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement.lang !== language) {
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = useCallback((next) => {
    applyLanguage(normalizeLanguage(next))
  }, [])

  const toggleLanguage = useCallback(() => {
    applyLanguage(readStoredLanguage() === 'bn' ? 'en' : 'bn')
  }, [])

  const value = useMemo(() => ({ setLanguage, toggleLanguage }), [setLanguage, toggleLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export default LanguageProvider
