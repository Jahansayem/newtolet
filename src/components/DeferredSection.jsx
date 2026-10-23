'use client'

import React, { Suspense, startTransition, useEffect, useRef, useState } from 'react'

/**
 * Mounts its children only once the section scrolls near the viewport.
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (isMountedRef.current) {
            // A transition lets React keep showing the placeholder while the child loads.
            startTransition(() => setIsVisible(true))
          }
          observer.disconnect()
        }
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [isVisible, rootMargin])

  return (
    <div ref={containerRef} className={className}>
      {isVisible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  )
}

export default DeferredSection
