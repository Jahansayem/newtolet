'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Navber from '../../src/Component/Home/Navber.jsx'
import Footer from '../../src/Component/Home/Footer.jsx'
import FloatingQuickRail from './FloatingQuickRail.jsx'
import { getRoutePage } from '../../src/lib/routePaths.js'

const STANDALONE_PAGES = new Set(['dashboard', 'admin', 'admin-dashboard', 'payment-confirm'])

export default function SiteChrome({ children }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams?.toString() || ''}`
  const page = getRoutePage(pathname, searchParams)
  const hideChrome = STANDALONE_PAGES.has(page)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [routeKey])

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
