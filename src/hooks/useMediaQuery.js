'use client'

import { useEffect, useState } from 'react'

/**
 * True when the media query matches; updates on change. SSR-safe (false until
 * mounted). `eager` reads the query on the first client render instead, for
 * components that only ever render in the browser: they then start in the
 * right layout instead of switching after mount.
 */
export const useMediaQuery = (query, { eager = false } = {}) => {
  const [matches, setMatches] = useState(() => (eager && typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)
    const handleChange = (event) => setMatches(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [query])
  return matches
}

export default useMediaQuery
