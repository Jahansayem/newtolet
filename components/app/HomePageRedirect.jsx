'use client'

import { useEffect, useRef, Suspense } from 'react'
import { usePathname } from 'next/navigation'
import HomeShellRouter from './HomeShellRouter.jsx'
import { resolveLegacyPageHref } from '../../src/lib/routePaths.js'

function HomePageRedirectInner() {
  const pathname = usePathname()
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    // SSR guard - ensure window is available
    if (typeof window === 'undefined') {
      return
    }

    // Only run on home page and if not already redirected
    if (pathname !== '/' || hasRedirectedRef.current) {
      return
    }

    // Check for page parameter in URL (read synchronously to avoid dependency)
    const searchParams = new URLSearchParams(window.location.search)
    const pageParam = searchParams.get('page')

    if (!pageParam) {
      return // No redirect needed - continue to home page
    }

    // Only redirect if the target is different from current page
    const params = new URLSearchParams(window.location.search)
    params.delete('page')
    const targetHref = resolveLegacyPageHref(pageParam, params)

    // Check if target is different from current location
    const currentPath = window.location.pathname + window.location.search
    if (targetHref === currentPath || targetHref === window.location.pathname) {
      // Already at the target, just remove the page param from URL
      params.delete('page')
      const newUrl = params.toString() ? '/' + params.toString() : '/'
      window.history.replaceState({}, '', newUrl)
      hasRedirectedRef.current = true
      return
    }

    // Mark as redirected - do NOT reset on error
    hasRedirectedRef.current = true

    // Perform redirect
    window.location.replace(targetHref)
  }, [pathname]) // Only depend on pathname

  return <HomeShellRouter />
}

export default function HomePageRedirect() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <HomePageRedirectInner />
    </Suspense>
  )
}
