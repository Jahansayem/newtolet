'use client'

import React, { Suspense, startTransition, useEffect, useRef, useState } from 'react'

/**
 * Mounts its children once the section scrolls near the viewport, or after `mountAfterMs`,
 * whichever comes first. The timer covers clients that never deliver an intersection: crawlers
 * and previews that do not scroll, and hidden tabs (no rendering frames, so no observer
 * callbacks). Pass `mountAfterMs={null}` for content that must only load when seen (ads).
 * Where IntersectionObserver does not exist the children mount straight away.
 *
 * Children are wrapped in their own Suspense boundary so a lazily loaded child
 * (e.g. a `next/dynamic` component whose chunk has not been fetched yet) suspends
 * inside this section — keeping the placeholder height — instead of bubbling up to
 * the page-level boundary, which would swap the whole page for a skeleton, collapse
 * the document height and reset the user's scroll position.
 */
const DeferredSection = ({
  children,
  fallback = null,
  className = '',
  rootMargin = '300px 0px',
  mountAfterMs = 4000,
}) => {
  const containerRef = useRef(null)
  const isMountedRef = useRef(true)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (isVisible || !containerRef.current) {
      return undefined
    }

    const reveal = () => {
      if (isMountedRef.current) {
        // A transition lets React keep showing the placeholder while the child loads.
        startTransition(() => setIsVisible(true))
      }
    }

    if (typeof IntersectionObserver === 'undefined') {
      reveal()
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal()
          observer.disconnect()
        }
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    )

    observer.observe(containerRef.current)

    const hasTimer = Number.isFinite(mountAfterMs) && mountAfterMs >= 0
    const timerId = hasTimer ? setTimeout(reveal, mountAfterMs) : null

    return () => {
      observer.disconnect()
      if (timerId !== null) clearTimeout(timerId)
    }
  }, [isVisible, rootMargin, mountAfterMs])

  return (
    <div ref={containerRef} className={className}>
      {isVisible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  )
}

export default DeferredSection
