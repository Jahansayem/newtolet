'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDeferredSearchParams } from '../../src/lib/useDeferredSearchParams.jsx'
import { useEffect, useRef, useState } from 'react'
import { FiHeart, FiHome, FiPlus, FiSearch, FiUser } from 'react-icons/fi'
import { buildDashboardHref, buildPageHref, getRoutePage } from '../../src/lib/routePaths.js'
import { OPEN_SEARCH_OVERLAY_EVENT } from '../../src/lib/homeScrollChrome.js'
import { useLanguage } from '../../src/i18n/useLanguage.js'

const SAVED_PROPERTIES_EVENT = 'saved-properties-updated'

const getSavedPropertiesCount = () => {
  if (typeof window === 'undefined') {
    return 0
  }

  try {
    const saved = JSON.parse(localStorage.getItem('savedProperties') || '[]')
    return Array.isArray(saved) ? saved.length : 0
  } catch (error) {
    console.error('Failed to read saved properties for quick rail:', error)
    return 0
  }
}

const tabClassName = (active) =>
  `flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-xs font-medium transition-colors ${
    active ? 'text-brand' : 'text-muted hover:text-ink'
  }`

const tabIconClassName = (active) =>
  `flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
    active ? 'bg-brand-soft text-brand' : 'text-current'
  }`

/**
 * Mobile bottom tab bar (the only floating UI on phones). Desktop uses the header actions.
 */
const FloatingQuickRail = () => {
  const pathname = usePathname()
  const [searchParams, searchParamsBridge] = useDeferredSearchParams()
  const routeKey = `${pathname}?${searchParams?.toString() || ''}`
  const page = getRoutePage(pathname, searchParams)
  const { t } = useLanguage()
  const [savedCount, setSavedCount] = useState(0)
  const isMountedRef = useRef(true)
  const lastRouteKeyRef = useRef('')

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Only refresh saved count when routeKey actually changes
  useEffect(() => {
    if (lastRouteKeyRef.current === routeKey) {
      return
    }
    lastRouteKeyRef.current = routeKey

    if (isMountedRef.current) {
      setSavedCount(getSavedPropertiesCount())
    }
  }, [routeKey])

  useEffect(() => {
    const refresh = () => {
      if (isMountedRef.current) {
        setSavedCount(getSavedPropertiesCount())
      }
    }

    const handleStorage = (event) => {
      if (!event.key || event.key === 'savedProperties') {
        refresh()
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(SAVED_PROPERTIES_EVENT, refresh)
    window.addEventListener('focus', refresh)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(SAVED_PROPERTIES_EVENT, refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const isHomeActive = pathname === '/'
  const isSavedActive = page === 'dashboard' && searchParams?.get('tab') === 'saved'
  const isAccountActive = page === 'dashboard' && !isSavedActive
  const badge = savedCount > 99 ? '99+' : savedCount > 0 ? String(savedCount) : null

  return (
    <>
    {searchParamsBridge}
    <nav
      aria-label={t('quickRail.quickAccess')}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-white/95 px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur sm:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between gap-1">
        <Link href="/" className={tabClassName(isHomeActive)} aria-current={isHomeActive ? 'page' : undefined}>
          <span className={tabIconClassName(isHomeActive)}>
            <FiHome className="text-lg" aria-hidden="true" />
          </span>
          <span>{t('quickRail.home')}</span>
        </Link>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SEARCH_OVERLAY_EVENT))}
          className={tabClassName(false)}
          aria-haspopup="dialog"
        >
          <span className={tabIconClassName(false)}>
            <FiSearch className="text-lg" aria-hidden="true" />
          </span>
          <span>{t('quickRail.search')}</span>
        </button>

        <Link href={buildPageHref('addproperty')} className={tabClassName(page === 'addproperty')} aria-current={page === 'addproperty' ? 'page' : undefined}>
          <span className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-raised">
            <FiPlus className="text-2xl" aria-hidden="true" />
          </span>
          <span className="font-semibold text-brand">{t('quickRail.add')}</span>
        </Link>

        <Link href={buildDashboardHref('saved')} className={tabClassName(isSavedActive)} aria-current={isSavedActive ? 'page' : undefined}>
          <span className={`relative ${tabIconClassName(isSavedActive)}`}>
            <FiHeart className="text-lg" aria-hidden="true" />
            {badge ? (
              <span className="absolute -right-1.5 -top-1 min-w-5 rounded-full bg-ink px-1 text-center text-[11px] font-semibold leading-5 text-white" aria-hidden="true">
                {badge}
              </span>
            ) : null}
          </span>
          <span>{t('quickRail.saved')}</span>
          {badge ? <span className="sr-only">{badge}</span> : null}
        </Link>

        <Link href={buildDashboardHref('profile')} className={tabClassName(isAccountActive)} aria-current={isAccountActive ? 'page' : undefined}>
          <span className={tabIconClassName(isAccountActive)}>
            <FiUser className="text-lg" aria-hidden="true" />
          </span>
          <span>{t('quickRail.account')}</span>
        </Link>
      </div>
    </nav>
    </>
  )
}

export default FloatingQuickRail
