const CACHE_VERSION = 'v3'
const CACHE_PREFIX = `newtolet-${CACHE_VERSION}`
const DOCUMENT_CACHE = `${CACHE_PREFIX}-documents`
const STATIC_CACHE = `${CACHE_PREFIX}-static`
const IMAGE_CACHE = `${CACHE_PREFIX}-images`
const DATA_CACHE = `${CACHE_PREFIX}-data`
const IS_LOCAL_DEV =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1'

const CACHEABLE_DOCUMENT_PREFIXES = [
  '/',
  '/about',
  '/contact',
  '/earnmoney',
  '/propertylist',
  '/propertylist2',
  '/listdetails',
  '/orderhome',
  '/dashboard',
  '/my-orders',
  '/my-properties',
]

const BLOCKED_DOCUMENT_PREFIXES = [
  '/login',
  '/registration',
  '/forgot-password',
  '/reset-password',
  '/admin',
  '/admin-dashboard',
  '/addproperty',
  '/edit-property',
  '/payment-confirm',
]

const SUPABASE_PUBLIC_TABLES = new Set([
  'properties',
  'property_images',
  'property_amenities',
  'cover_photos',
  'feedback',
])

const isBlockedDocument = (pathname) =>
  BLOCKED_DOCUMENT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

const isEligibleDocument = (pathname) =>
  !isBlockedDocument(pathname) &&
  CACHEABLE_DOCUMENT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

const getSupabaseTableName = (pathname) => {
  const marker = '/rest/v1/'
  const markerIndex = pathname.indexOf(marker)

  if (markerIndex === -1) {
    return null
  }

  return pathname.slice(markerIndex + marker.length).split('/')[0] || null
}

// A signed-in request carries the user's own token instead of the public key.
// Its response depends on who is asking (owner rows, admin-only columns), so it
// must never be stored in, or answered from, the shared data cache.
const hasUserSession = (request) => {
  const authorization = request.headers.get('authorization')

  if (!authorization) {
    return false
  }

  const apiKey = request.headers.get('apikey')

  return !apiKey || authorization.trim() !== `Bearer ${apiKey}`
}

const isPublicSupabaseRequest = (request, url) => {
  if (request.method !== 'GET') {
    return false
  }

  if (hasUserSession(request)) {
    return false
  }

  const tableName = getSupabaseTableName(url.pathname)

  if (!tableName || !SUPABASE_PUBLIC_TABLES.has(tableName)) {
    return false
  }

  if (tableName === 'properties') {
    return url.search.includes('status=eq.approved')
  }

  if (tableName === 'cover_photos') {
    return url.search.includes('is_active=eq.true')
  }

  if (tableName === 'feedback') {
    return url.search.includes('status=eq.approved')
  }

  return true
}

const isStaticAssetRequest = (request, url) =>
  request.method === 'GET' &&
  url.origin === self.location.origin &&
  (
    url.pathname.startsWith('/_next/static/') ||
    ['script', 'style', 'font', 'worker', 'manifest'].includes(request.destination)
  )

const isImageRequest = (request, url) => {
  if (request.method !== 'GET' || request.destination !== 'image') {
    return false
  }

  const isSameOriginImage = url.origin === self.location.origin
  const isSupabaseStorageImage =
    url.pathname.includes('/storage/v1/object/public/') ||
    url.pathname.includes('/storage/v1/render/image/public/')

  return isSameOriginImage || isSupabaseStorageImage
}

const isSameOriginJsonRequest = (request, url) =>
  request.method === 'GET' &&
  url.origin === self.location.origin &&
  url.pathname.endsWith('.json')

const clearNewtoletCaches = async () => {
  const cacheNames = await caches.keys()

  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith('newtolet-'))
      .map((cacheName) => caches.delete(cacheName))
  )
}

// The Cache API rejects partial responses: PostgREST answers a paged list with
// 206 Partial Content, and cache.put() throws a TypeError for it.
const isCacheableResponse = (response) =>
  response && response.status !== 206 && (response.ok || response.type === 'opaque')

// Storing a copy is an optimisation. A failure here (206, quota, Vary: *) must
// never replace the good network response the page is waiting for.
const putInCache = async (cacheName, request, response) => {
  if (!isCacheableResponse(response)) {
    return response
  }

  try {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
  } catch {
    // keep the network response
  }

  return response
}

const fetchAndCache = async (cacheName, request) => {
  const response = await fetch(request)
  return putInCache(cacheName, request, response)
}

const offlineDocumentResponse = async () => {
  const cachedHome = await caches.match('/')

  if (cachedHome) {
    return cachedHome
  }

  return new Response(
    '<!doctype html><html><head><meta charset="utf-8"><title>Offline</title></head><body><h1>Offline</h1><p>Reconnect to continue browsing.</p></body></html>',
    {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    }
  )
}

const staleWhileRevalidate = async (event, cacheName) => {
  const { request } = event
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  const networkPromise = fetchAndCache(cacheName, request).catch(() => null)

  if (cachedResponse) {
    event.waitUntil(networkPromise)
    return cachedResponse
  }

  const networkResponse = await networkPromise

  if (networkResponse) {
    return networkResponse
  }

  if (request.mode === 'navigate') {
    return offlineDocumentResponse()
  }

  // The network request itself failed and nothing is cached: report a network
  // error to the page instead of inventing an HTTP status the server never sent.
  return Response.error()
}

const cacheFirstWithRefresh = async (event, cacheName) => {
  const { request } = event
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    event.waitUntil(fetchAndCache(cacheName, request).catch(() => null))
    return cachedResponse
  }

  try {
    return await fetchAndCache(cacheName, request)
  } catch (error) {
    return Response.error()
  }
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (IS_LOCAL_DEV) {
        await clearNewtoletCaches()
        await self.registration.unregister()
        return
      }

      const cacheNames = await caches.keys()

      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('newtolet-') && !cacheName.startsWith(CACHE_PREFIX))
          .map((cacheName) => caches.delete(cacheName))
      )

      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  if (IS_LOCAL_DEV) {
    return
  }

  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return
  }

  if (
    request.mode === 'navigate' &&
    url.origin === self.location.origin &&
    isEligibleDocument(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(event, DOCUMENT_CACHE))
    return
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirstWithRefresh(event, STATIC_CACHE))
    return
  }

  if (isImageRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(event, IMAGE_CACHE))
    return
  }

  if (isSameOriginJsonRequest(request, url) || isPublicSupabaseRequest(request, url)) {
    event.respondWith(staleWhileRevalidate(event, DATA_CACHE))
  }
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
