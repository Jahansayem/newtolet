'use client'

import { useEffect } from 'react'

const clearAppCaches = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return
  }

  const cacheKeys = await window.caches.keys()
  await Promise.all(
    cacheKeys
      .filter((cacheKey) => cacheKey.startsWith('newtolet-'))
      .map((cacheKey) => window.caches.delete(cacheKey))
  )
}

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .then(() => clearAppCaches())
        .catch((error) => {
          console.error('[SW] Failed to clean up service workers for development:', error)
        })

      return
    }

    const handleLoad = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.update().catch(() => null)

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing

            if (!newWorker) {
              return
            }

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' })
                console.log('[SW] New content is available; please refresh.')
              }
            })
          })
        })
        .catch((error) => {
          console.error('[SW] Service worker registration failed:', error)
        })
    }

    window.addEventListener('load', handleLoad)

    return () => {
      window.removeEventListener('load', handleLoad)
    }
  }, [])

  return null
}
