'use client'

import React, { useEffect, useRef, useState } from 'react'

const DeferredSection = ({
  children,
  fallback = null,
  className = '',
  rootMargin = '300px 0px',
}) => {
  const containerRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isVisible || !containerRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
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
      {isVisible ? children : fallback}
    </div>
  )
}

export default DeferredSection
