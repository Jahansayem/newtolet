'use client'

import { useEffect, useMemo, useRef, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Navber from '../../src/Component/Home/Navber.jsx'
import Footer from '../../src/Component/Home/Footer.jsx'
import FloatingQuickRail from './FloatingQuickRail.jsx'
import HomePageSkeleton from './HomePageSkeleton.jsx'
import { getRoutePage } from '../../src/lib/routePaths.js'

const STANDALONE_PAGES = new Set([
  'dashboard',
  'admin',
  'admin-dashboard',
  'book-buy-credits',
  'payment-confirm',
  'login',
  'registration',
  'forgot-password',
  'reset-password',
  'my-orders',
  'my-properties',
])

// Inner component that uses useSearchParams - wrapped in Suspense
function SiteChromeInner({ children }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previousPathnameRef = useRef(pathname)

  // Memoize the page check to avoid recalculating on every render
  const page = useMemo(() => {
    return getRoutePage(pathname, searchParams)
  }, [pathname, searchParams])

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
    return <div className="min-h-screen bg-gray-50">{children}</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navber />
      <FloatingQuickRail />
      <div className="max-w-full mx-auto">{children}</div>
      <Footer />
    </div>
  )
}

export default function SiteChrome({ children }) {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <SiteChromeInner>{children}</SiteChromeInner>
    </Suspense>
  )
}
