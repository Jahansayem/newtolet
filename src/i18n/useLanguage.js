import { useContext, useMemo, useSyncExternalStore } from 'react'
import { LanguageContext } from './LanguageContext'
import { getServerLanguage, readStoredLanguage, subscribeToLanguage } from './config'
import { getDictionary, translate, translateCount, translateValue } from './translate'
import { formatDate, formatDateTime } from './format'

/**
 * Access the active language and translation helpers.
 * Usage: const { t, tv, language, setLanguage } = useLanguage()
 *
 * The language is read with useSyncExternalStore *in each consumer* rather than once
 * in the provider. During hydration React then uses the server snapshot ('en', which
 * matches the server-rendered HTML) for every consumer — including those inside
 * Suspense boundaries that hydrate later — and switches to the stored language right
 * after. Reading it once in the provider caused late-hydrating subtrees to render the
 * stored language against English HTML, which React treats as a hydration mismatch and
 * answers by regenerating the subtree (visible as a page-skeleton flash and a scroll reset).
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }

  const language = useSyncExternalStore(subscribeToLanguage, readStoredLanguage, getServerLanguage)
  const { setLanguage, toggleLanguage } = context

  return useMemo(
    () => ({
      language,
      isBengali: language === 'bn',
      setLanguage,
      toggleLanguage,
      t: (key, vars) => translate(language, key, vars),
      tv: (namespace, rawValue) => translateValue(language, namespace, rawValue),
      tc: (key, count, vars) => translateCount(language, key, count, vars),
      fd: (date, options) => formatDate(date, language, options),
      fdt: (date, options) => formatDateTime(date, language, options),
      dict: getDictionary(language),
    }),
    [language, setLanguage, toggleLanguage]
  )
}

/** Alias kept short for components that only translate. */
export const useT = useLanguage

export default useLanguage
