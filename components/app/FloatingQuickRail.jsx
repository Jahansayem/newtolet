'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDeferredSearchParams } from '../../src/lib/useDeferredSearchParams.jsx'
import { FiHome, FiPackage, FiPlus, FiSearch, FiUser } from 'react-icons/fi'
import { buildDashboardHref, buildPageHref, getRoutePage } from '../../src/lib/routePaths.js'
import { OPEN_SEARCH_OVERLAY_EVENT } from '../../src/lib/homeScrollChrome.js'
import { useLanguage } from '../../src/i18n/useLanguage.js'

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
  const page = getRoutePage(pathname, searchParams)
  const { t } = useLanguage()

  const isHomeActive = pathname === '/'
  const isOrderHomeActive = page === 'orderhome'
  const isAccountActive = page === 'dashboard'

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

        <Link href={buildPageHref('orderhome')} className={tabClassName(isOrderHomeActive)} aria-current={isOrderHomeActive ? 'page' : undefined}>
          <span className={tabIconClassName(isOrderHomeActive)}>
            <FiPackage className="text-lg" aria-hidden="true" />
          </span>
          <span className="whitespace-nowrap tracking-tight">{t('quickRail.orderHome')}</span>
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
