'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
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
