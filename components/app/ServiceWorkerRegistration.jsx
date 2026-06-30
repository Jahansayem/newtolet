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

const getServiceWorkerRegistrations = async () => {
  if (!navigator.serviceWorker.getRegistrations) {
    const registration = await navigator.serviceWorker.getRegistration()
    return registration ? [registration] : []
  }

  return navigator.serviceWorker.getRegistrations()
}

const unregisterServiceWorkers = async (registrations) => {
  await Promise.all(registrations.map((registration) => registration.unregister()))
}

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    const cleanup = async () => {
      try {
        let registrations = await getServiceWorkerRegistrations()

        if (process.env.NODE_ENV === 'production' && registrations.length > 0) {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            updateViaCache: 'none',
          })
          await registration.update().catch(() => null)
          registrations = await getServiceWorkerRegistrations()
        }

        await unregisterServiceWorkers(registrations)
        await clearAppCaches()
      } catch (error) {
        console.error('[SW] Failed to clean up service workers:', error)
      }
    }

    if (document.readyState === 'complete') {
      cleanup()
      return
    }

    window.addEventListener('load', cleanup)

    return () => {
      window.removeEventListener('load', cleanup)
    }
  }, [])

  return null
}
