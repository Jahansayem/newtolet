'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FiColumns } from 'react-icons/fi'
import { buildPageHref, getRoutePage } from '../../src/lib/routePaths.js'
import { useLanguage } from '../../src/i18n/useLanguage.js'
import {
  COMPARE_PROPERTIES_BROWSER_EVENT,
  COMPARE_PROPERTIES_STORAGE_KEY,
  MAX_COMPARE_ITEMS,
  getComparedPropertyIds,
} from '../../src/services/propertyCompareService.js'

// Pages where a floating button would cover a form or is pointless.
const HIDDEN_ON = new Set(['compare', 'addproperty', 'edit-property', 'dashboard', 'orderhome', 'book'])

/**
 * Floating "Compare (n)" link shown once the visitor has added at least one listing to compare.
 * On phones it sits above the bottom tab bar (FloatingQuickRail, ~4.5rem tall).
 */
const CompareTray = () => {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [count, setCount] = useState(0)

  useEffect(() => {
    const sync = () => setCount(getComparedPropertyIds().length)
    sync()
    const onStorage = (event) => {
      if (event.key === null || event.key === COMPARE_PROPERTIES_STORAGE_KEY) sync()
    }
    window.addEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  if (count === 0 || HIDDEN_ON.has(getRoutePage(pathname))) {
    return null
  }

  return (
    <Link
      href={buildPageHref('compare')}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-overlay transition-colors hover:bg-brand sm:bottom-6 sm:right-6"
      aria-label={t('compareTray.label', { count, max: MAX_COMPARE_ITEMS })}
    >
      <FiColumns className="text-base" aria-hidden="true" />
      <span>{t('compareTray.text', { count })}</span>
    </Link>
  )
}

export default CompareTray
