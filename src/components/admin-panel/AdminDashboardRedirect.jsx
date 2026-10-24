'use client'

import { useEffect } from 'react'

/**
 * /admin-dashboard is a compatibility alias; /admin is canonical. The site is a
 * static export, so the redirect happens client-side (nginx also answers 301
 * when configured). Query and hash are preserved so `?tab=` bookmarks survive.
 */
export default function AdminDashboardRedirect() {
  useEffect(() => {
    const { search, hash } = window.location
    window.location.replace(`/admin/${search}${hash}`)
  }, [])

  return (
    <p className="sr-only" role="status">
      Redirecting to the admin panel…
    </p>
  )
}
