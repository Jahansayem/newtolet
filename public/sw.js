const CACHE_PREFIX = 'newtolet-'

const clearNewtoletCaches = async () => {
  if (!self.caches) {
    return
  }

  const cacheNames = await caches.keys()

  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName))
  )
}

const reloadControlledClients = async () => {
  const clients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  })

  await Promise.all(
    clients.map((client) => {
      if ('navigate' in client && client.url) {
        return client.navigate(client.url)
      }

      return undefined
    })
  )
}

const unregister = async () => {
  await clearNewtoletCaches()
  await self.registration.unregister()
  await reloadControlledClients()
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(clearNewtoletCaches())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(unregister())
})

self.addEventListener('fetch', () => {
  return
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING' || event.data?.type === 'UNREGISTER') {
    event.waitUntil(unregister())
  }
})
