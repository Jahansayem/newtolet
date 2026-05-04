'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import HomeShellRouter from './HomeShellRouter.jsx'
import { resolveLegacyPageHref } from '../../src/lib/routePaths.js'

export default function HomePageRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname !== '/') {
      return
    }

    const page = searchParams.get('page')
    if (!page) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    router.replace(resolveLegacyPageHref(page, params))
  }, [pathname, router, searchParams])

  return <HomeShellRouter />
}
