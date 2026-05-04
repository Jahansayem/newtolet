'use client'

import NextLink from 'next/link'
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { canonicalizeInternalHref } from './routePaths.js'

const NAVIGATION_STATE_PREFIX = '__next_navigation_state__:'

const normalizeToHref = (to) => {
  if (typeof to === 'string') {
    return canonicalizeInternalHref(to)
  }

  if (to && typeof to === 'object') {
    const pathname = to.pathname || '/'
    const search = to.search || ''
    const hash = to.hash || ''
    return canonicalizeInternalHref(`${pathname}${search}${hash}`)
  }

  return '/'
}

const getNavigationStateKey = (href) => {
  if (typeof window === 'undefined') {
    return null
  }

  const url = new URL(href, window.location.origin)
  return `${NAVIGATION_STATE_PREFIX}${url.pathname}${url.search}`
}

const storeNavigationState = (href, state) => {
  if (typeof window === 'undefined' || typeof state === 'undefined') {
    return
  }

  const key = getNavigationStateKey(href)

  if (!key) {
    return
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to store navigation state:', error)
  }
}

const readAndClearNavigationState = (pathname, search) => {
  if (typeof window === 'undefined') {
    return null
  }

  const key = `${NAVIGATION_STATE_PREFIX}${pathname}${search}`

  try {
    const raw = sessionStorage.getItem(key)

    if (!raw) {
      return null
    }

    sessionStorage.removeItem(key)
    return JSON.parse(raw)
  } catch (error) {
    console.error('Failed to read navigation state:', error)
    return null
  }
}

export function Link({ to, href, replace, state, onClick, children, ...rest }) {
  const targetHref = href || normalizeToHref(to)

  const handleClick = useCallback(
    (event) => {
      if (!event.defaultPrevented && typeof state !== 'undefined') {
        storeNavigationState(targetHref, state)
      }

      if (onClick) {
        onClick(event)
      }
    },
    [onClick, state, targetHref]
  )

  return (
    <NextLink href={targetHref} replace={replace} onClick={handleClick} {...rest}>
      {children}
    </NextLink>
  )
}

export function useNavigate() {
  const router = useRouter()

  return useCallback(
    (to, options = {}) => {
      if (typeof to === 'number') {
        window.history.go(to)
        return
      }

      const href = normalizeToHref(to)

      if (typeof options.state !== 'undefined') {
        storeNavigationState(href, options.state)
      }

      if (options.replace) {
        router.replace(href)
        return
      }

      router.push(href)
    },
    [router]
  )
}

export function useParams() {
  return useNextParams()
}

export function useSearchParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useNextSearchParams()

  const params = useMemo(
    () => new URLSearchParams(searchParams?.toString() || ''),
    [searchParams]
  )

  const setSearchParams = useCallback(
    (nextInit, options = {}) => {
      const nextValue =
        typeof nextInit === 'function'
          ? nextInit(new URLSearchParams(searchParams?.toString() || ''))
          : nextInit

      const nextParams = new URLSearchParams(nextValue)
      const queryString = nextParams.toString()
      const href = queryString ? `${pathname}?${queryString}` : pathname

      if (options.replace === false) {
        router.push(href)
        return
      }

      router.replace(href)
    },
    [pathname, router, searchParams]
  )

  return [params, setSearchParams]
}

export function useLocation() {
  const pathname = usePathname()
  const searchParams = useNextSearchParams()
  const [hash, setHash] = useState('')
  const [state, setState] = useState(null)

  const search = useMemo(() => {
    const queryString = searchParams?.toString() || ''
    return queryString ? `?${queryString}` : ''
  }, [searchParams])

  useEffect(() => {
    const updateHash = () => {
      setHash(window.location.hash || '')
    }

    updateHash()
    window.addEventListener('hashchange', updateHash)

    return () => {
      window.removeEventListener('hashchange', updateHash)
    }
  }, [])

  useEffect(() => {
    setState(readAndClearNavigationState(pathname, search))
  }, [pathname, search])

  return {
    pathname,
    search,
    hash,
    state,
    href: `${pathname}${search}${hash}`,
  }
}

export function Navigate({ to, replace = false, state = undefined }) {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(to, { replace, state })
  }, [navigate, replace, state, to])

  return null
}

export function Outlet() {
  return null
}
