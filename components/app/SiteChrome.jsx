'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Navber from '../../src/Component/Home/Navber.jsx'
import Footer from '../../src/Component/Home/Footer.jsx'
import FloatingQuickRail from './FloatingQuickRail.jsx'
import CompareTray from './CompareTray.jsx'
import AuthHeader from './AuthHeader.jsx'
import HomePageSkeleton from './HomePageSkeleton.jsx'
import { getRoutePage } from '../../src/lib/routePaths.js'
import { useLanguage } from '../../src/i18n/useLanguage'

const STANDALONE_PAGES = new Set([
  'admin',
  'admin-dashboard',
  'book-buy-credits',
  'payment-confirm',
  'login',
  'registration',
  'forgot-password',
  'reset-password',
])

const AUTH_PAGES = new Set(['login', 'registration', 'forgot-password', 'reset-password'])

// Reads only the pathname: useSearchParams() here would make the static export render every
// page as an empty Suspense fallback (no crawlable HTML). Legacy '/?page=x' URLs are redirected
// by HomePageRedirect on the home route.
export default function SiteChrome({ children }) {
  const pathname = usePathname()
  const previousPathnameRef = useRef(pathname)
  const { t } = useLanguage()

  // Memoize the page check to avoid recalculating on every render
  const page = useMemo(() => {
    return getRoutePage(pathname)
  }, [pathname])

  const hideChrome = STANDALONE_PAGES.has(page)

  useEffect(() => {
    // Only scroll to top when pathname actually changes
    // This prevents unwanted scrolls during search param changes
    if (pathname !== previousPathnameRef.current) {
      window.scrollTo(0, 0)
      previousPathnameRef.current = pathname
    }
  }, [pathname])

  if (hideChrome) {
    // Standalone pages (auth, admin, checkout) render their own landmarks. Auth pages still get a
    // slim header so a lost visitor can get back to Home or Search.
    return (
      <div className="min-h-screen bg-gray-50">
        {AUTH_PAGES.has(page) ? <AuthHeader /> : null}
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    )
  }

  return (
    <div className="site-main min-h-screen bg-gray-50">
      <a href="#main-content" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <Navber />
      <FloatingQuickRail />
      <CompareTray />
      <main id="main-content" tabIndex={-1} className="max-w-full mx-auto outline-none">
        {/* Pages that read the query string suspend here at build time; header and footer stay. */}
        <Suspense fallback={<HomePageSkeleton />}>{children}</Suspense>
      </main>
      <Footer />
    </div>
  )
}

