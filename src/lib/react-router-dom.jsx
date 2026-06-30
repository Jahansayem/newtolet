'use client'

import NextLink from 'next/link'
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

export function Link({ to, href, replace, state, onClick, children, prefetch = false, ...rest }) {
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
    <NextLink href={targetHref} replace={replace} prefetch={prefetch} onClick={handleClick} {...rest}>
      {children}
    </NextLink>
  )
}

const getCurrentHref = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

const hrefMatchesCurrentLocation = (href) => {
  if (typeof window === 'undefined') {
    return false
  }

  const targetUrl = new URL(href, window.location.origin)
  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}` === getCurrentHref()
}

const cancelScheduledTask = (taskId) => {
  if (taskId === null) {
    return
  }

  if (typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(taskId)
  } else {
    clearTimeout(taskId)
  }
}

export function useNavigate() {
  const router = useRouter()
  const isMountedRef = useRef(true)
  const routerRef = useRef(router)
  const isReadyRef = useRef(false)
  const pendingNavIdRef = useRef(null)

  useEffect(() => {
    isMountedRef.current = true
    routerRef.current = router
    // Set isReady when router is fully initialized
    // Next.js router is ready when mounted and has push/replace methods
    if (router && typeof router.push === 'function' && typeof router.replace === 'function') {
      // Use setTimeout to ensure router is fully ready
      const readyTimer = setTimeout(() => {
        if (isMountedRef.current) {
          isReadyRef.current = true
        }
      }, 0)
      return () => {
        clearTimeout(readyTimer)
        isMountedRef.current = false
        isReadyRef.current = false
        // Clean up any pending navigation on unmount/HMR
        cancelScheduledTask(pendingNavIdRef.current)
        pendingNavIdRef.current = null
      }
    }
    return () => {
      isMountedRef.current = false
      isReadyRef.current = false
      // Clean up any pending navigation on unmount/HMR
      cancelScheduledTask(pendingNavIdRef.current)
      pendingNavIdRef.current = null
    }
  }, [router])

  return useCallback(
    (to, options = {}) => {
      if (typeof to === 'number') {
        if (typeof window !== 'undefined') {
          window.history.go(to)
        }
        return
      }

      const href = normalizeToHref(to)

      if (hrefMatchesCurrentLocation(href)) {
        return
      }

      if (typeof options.state !== 'undefined') {
        storeNavigationState(href, options.state)
      }

      const runNavigation = () => {
        if (hrefMatchesCurrentLocation(href)) return

        try {
          const currentRouter = routerRef.current
          // Check router is ready AND has the required methods
          if (!currentRouter ||
              typeof currentRouter.replace !== 'function' ||
              typeof currentRouter.push !== 'function') {
            return // Router not ready (likely during HMR)
          }

          if (options.replace) {
            currentRouter.replace(href)
          } else {
            currentRouter.push(href)
          }
          return true
        } catch {
          // Silently fail during HMR
          return false
        }
      }

      if (runNavigation()) {
        return
      }

      // Defer only when the router is not ready yet. This keeps overlay/search
      // submits from being cancelled when the submitting component unmounts.
      const scheduleNavigation = () => {
        if (!isMountedRef.current || !isReadyRef.current) return
        runNavigation()
      }

      cancelScheduledTask(pendingNavIdRef.current)

      // Use requestIdleCallback or setTimeout to defer navigation
      if (typeof requestIdleCallback !== 'undefined') {
        pendingNavIdRef.current = requestIdleCallback(scheduleNavigation)
      } else {
        pendingNavIdRef.current = setTimeout(scheduleNavigation, 0)
      }
    },
    [] // Empty deps - uses ref instead
  )
}

export function useParams() {
  return useNextParams()
}

export function useSearchParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useNextSearchParams()
  const isMountedRef = useRef(true)
  const isReadyRef = useRef(false)
  const pendingNavIdRef = useRef(null)
  const routerRef = useRef(router)
  const pathnameRef = useRef(pathname)

  // Single unified effect for setup and cleanup
  useEffect(() => {
    isMountedRef.current = true
    routerRef.current = router
    pathnameRef.current = pathname

    // Set isReady when router is fully initialized
    const readyTimer = setTimeout(() => {
      if (isMountedRef.current && router && typeof router.replace === 'function' && typeof router.push === 'function') {
        isReadyRef.current = true
      }
    }, 0)

    return () => {
      isMountedRef.current = false
      isReadyRef.current = false
      clearTimeout(readyTimer)

      // Clean up any pending navigation on unmount/HMR
      cancelScheduledTask(pendingNavIdRef.current)
      pendingNavIdRef.current = null
    }
  }, [router, pathname])

  const params = useMemo(
    () => new URLSearchParams(searchParams?.toString() || ''),
    [searchParams]
  )

  const setSearchParams = useCallback(
    (nextInit, options = {}) => {
      const currentPathname = pathnameRef.current

      // Get the current search params from the URL directly
      const currentSearchParams = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : ''
      )
      const nextValue =
        typeof nextInit === 'function'
          ? nextInit(currentSearchParams)
          : nextInit

      const nextParams = new URLSearchParams(nextValue)
      const queryString = nextParams.toString()
      const href = queryString ? `${currentPathname}?${queryString}` : currentPathname

      if (hrefMatchesCurrentLocation(href)) {
        return
      }

      const runNavigation = () => {
        if (hrefMatchesCurrentLocation(href)) return

        try {
          const currentRouter = routerRef.current
          // Check router is ready AND has the required methods
          if (!currentRouter ||
              typeof currentRouter.replace !== 'function' ||
              typeof currentRouter.push !== 'function') {
            return // Router not ready (likely during HMR)
          }

          if (options.replace === false) {
            currentRouter.push(href)
          } else {
            currentRouter.replace(href)
          }
          return true
        } catch {
          // Silently fail during HMR
          return false
        }
      }

      if (runNavigation()) {
        return
      }

      // Defer only when the router is not ready yet.
      const scheduleNavigation = () => {
        if (!isMountedRef.current || !isReadyRef.current) return
        runNavigation()
      }

      cancelScheduledTask(pendingNavIdRef.current)

      // Use requestIdleCallback or setTimeout to defer navigation
      if (typeof requestIdleCallback !== 'undefined') {
        pendingNavIdRef.current = requestIdleCallback(scheduleNavigation)
      } else {
        pendingNavIdRef.current = setTimeout(scheduleNavigation, 0)
      }
    },
    [] // Empty deps - uses refs instead
  )

  return [params, setSearchParams]
}

export function useLocation() {
  const pathname = usePathname()
  const searchParams = useNextSearchParams()
  const [hash, setHash] = useState('')
  const [state, setState] = useState(null)
  const isMountedRef = useRef(true)
  const pathnameRef = useRef(pathname)
  const searchRef = useRef('')
  const pendingStateIdRef = useRef(null)
  const lastReadKeyRef = useRef('')

  const search = useMemo(() => {
    const queryString = searchParams?.toString() || ''
    return queryString ? `?${queryString}` : ''
  }, [searchParams])

  // Combined effect for updating refs and reading navigation state
  useEffect(() => {
    isMountedRef.current = true
    pathnameRef.current = pathname
    searchRef.current = search

    // Create a unique key for this pathname+search combination
    const readKey = `${pathname}|${search}`

    // Only read navigation state if it's a new location (not just search params changing)
    if (lastReadKeyRef.current !== readKey) {
      lastReadKeyRef.current = readKey

      // Use requestIdleCallback to defer state read
      const readState = () => {
        if (isMountedRef.current) {
          setState(readAndClearNavigationState(pathnameRef.current, searchRef.current))
        }
      }

      if (typeof requestIdleCallback !== 'undefined') {
        pendingStateIdRef.current = requestIdleCallback(readState)
      } else {
        pendingStateIdRef.current = setTimeout(readState, 0)
      }
    }

    return () => {
      cancelScheduledTask(pendingStateIdRef.current)
      pendingStateIdRef.current = null
    }
  }, [pathname, search])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateHash = () => {
      if (isMountedRef.current) {
        setHash(window.location.hash || '')
      }
    }

    updateHash()
    window.addEventListener('hashchange', updateHash)

    return () => {
      isMountedRef.current = false
      window.removeEventListener('hashchange', updateHash)
    }
  }, [])

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
  const hasNavigatedRef = useRef(false)

  useEffect(() => {
    // Only navigate once, and skip if we already did
    if (hasNavigatedRef.current) return
    if (hrefMatchesCurrentLocation(normalizeToHref(to))) return

    hasNavigatedRef.current = true
    navigate(to, { replace, state })
  }, [navigate, replace, state, to])

  return null
}

export function Outlet() {
  return null
}
