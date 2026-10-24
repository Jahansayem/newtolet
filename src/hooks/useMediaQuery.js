'use client'

import { useEffect, useState } from 'react'

/** True when the media query matches; updates on change. SSR-safe (false until mounted). */
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false)
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
