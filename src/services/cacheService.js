const CACHE_PREFIX = 'newtolet-cache:v1'
const USER_PANEL_CACHE_NAMESPACE = 'user-panel:v3'

const userPanelMemoryCache = new Map()
const userPanelInflightRequests = new Map()

const getStorageKey = (key) => `${CACHE_PREFIX}:${key}`

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const isDevEnvironment = () => process.env.NODE_ENV !== 'production'

const logUserPanelCacheEvent = (event, cacheKey, details = null) => {
  if (!isDevEnvironment()) {
    return
  }

  if (details) {
    console.info(`[user-panel-cache] ${event}`, cacheKey, details)
    return
  }

  console.info(`[user-panel-cache] ${event}`, cacheKey)
}

const readStorageValue = (key) => {
  if (!canUseStorage() || !key) {
    return null
  }

  try {
    const rawValue = localStorage.getItem(getStorageKey(key))
    return rawValue ? JSON.parse(rawValue) : null
  } catch (error) {
    console.error('Failed to read cached snapshot:', error)
    return null
  }
}

const writeStorageValue = (key, data) => {
  if (!canUseStorage() || !key) {
    return
  }

  try {
    localStorage.setItem(getStorageKey(key), JSON.stringify(data))
  } catch (error) {
    console.error('Failed to write cached snapshot:', error)
  }
}

const removeStorageValue = (key) => {
  if (!canUseStorage() || !key) {
    return
  }

  try {
    localStorage.removeItem(getStorageKey(key))
  } catch (error) {
    console.error('Failed to remove cached snapshot:', error)
  }
}

const normalizeUserPanelEntry = (cacheKey, entry, policy = {}) => {
  if (!entry || entry.data === undefined) {
    return null
  }

  const savedAt = Number(entry.savedAt || Date.now())
  const staleAt = Number(entry.staleAt || savedAt + Number(policy.staleTimeMs || 0))
  const expiresAt = Number(entry.expiresAt || savedAt + Number(policy.expiresInMs || 0))

  return {
    version: entry.version || USER_PANEL_CACHE_NAMESPACE,
    cacheKey,
    data: entry.data,
    savedAt,
    staleAt,
    expiresAt,
    isStale: Date.now() >= staleAt,
    isExpired: Date.now() >= expiresAt,
  }
}

const writeUserPanelCacheEntry = (cacheKey, data, policy = {}) => {
  const now = Date.now()
  const entry = {
    version: USER_PANEL_CACHE_NAMESPACE,
    data,
    savedAt: now,
    staleAt: now + Number(policy.staleTimeMs || 0),
    expiresAt: now + Number(policy.expiresInMs || 0),
  }

  userPanelMemoryCache.set(cacheKey, entry)
  writeStorageValue(cacheKey, entry)
  logUserPanelCacheEvent('write', cacheKey, {
    staleAt: entry.staleAt,
    expiresAt: entry.expiresAt,
  })

  return normalizeUserPanelEntry(cacheKey, entry, policy)
}

export const buildUserPanelCacheKey = (userId, resourceKey) =>
  `${USER_PANEL_CACHE_NAMESPACE}:${userId || 'guest'}:${resourceKey || 'unknown'}`

export const getUserPanelCacheSnapshot = (cacheKey, policy = {}) => {
  if (!cacheKey) {
    return null
  }

  const memoryEntry = userPanelMemoryCache.get(cacheKey)
  const normalizedMemoryEntry = normalizeUserPanelEntry(cacheKey, memoryEntry, policy)

  if (normalizedMemoryEntry) {
    logUserPanelCacheEvent('memory-hit', cacheKey, {
      isStale: normalizedMemoryEntry.isStale,
      isExpired: normalizedMemoryEntry.isExpired,
    })
    return normalizedMemoryEntry
  }

  const storageEntry = readStorageValue(cacheKey)
  const normalizedStorageEntry = normalizeUserPanelEntry(cacheKey, storageEntry, policy)

  if (normalizedStorageEntry) {
    userPanelMemoryCache.set(cacheKey, storageEntry)
    logUserPanelCacheEvent('storage-hit', cacheKey, {
      isStale: normalizedStorageEntry.isStale,
      isExpired: normalizedStorageEntry.isExpired,
    })
    return normalizedStorageEntry
  }

  logUserPanelCacheEvent('miss', cacheKey)
  return null
}

export const revalidateUserPanelResource = async ({
  cacheKey,
  policy = {},
  fetcher,
  force = false,
}) => {
  if (!cacheKey || typeof fetcher !== 'function') {
    throw new Error('A cache key and fetcher are required.')
  }

  const snapshot = getUserPanelCacheSnapshot(cacheKey, policy)

  if (!force && snapshot && !snapshot.isStale && !snapshot.isExpired) {
    return snapshot
  }

  if (!force && userPanelInflightRequests.has(cacheKey)) {
    logUserPanelCacheEvent('dedupe', cacheKey)
    return userPanelInflightRequests.get(cacheKey)
  }

  const request = (async () => {
    try {
      const data = await fetcher()
      return writeUserPanelCacheEntry(cacheKey, data, policy)
    } finally {
      userPanelInflightRequests.delete(cacheKey)
    }
  })()

  userPanelInflightRequests.set(cacheKey, request)
  return request
}

export const invalidateUserPanelCache = (cacheKey) => {
  if (!cacheKey) {
    return
  }

  userPanelMemoryCache.delete(cacheKey)
  userPanelInflightRequests.delete(cacheKey)
  removeStorageValue(cacheKey)
  logUserPanelCacheEvent('invalidate', cacheKey)
}

export const invalidateUserPanelCacheByPrefix = (prefix) => {
  if (!prefix) {
    return
  }

  Array.from(userPanelMemoryCache.keys())
    .filter((cacheKey) => cacheKey.startsWith(prefix))
    .forEach((cacheKey) => {
      userPanelMemoryCache.delete(cacheKey)
      userPanelInflightRequests.delete(cacheKey)
    })

  if (canUseStorage()) {
    const scopedPrefix = getStorageKey(prefix)
    const keysToRemove = []

    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index)
      if (storageKey?.startsWith(scopedPrefix)) {
        keysToRemove.push(storageKey)
      }
    }

    keysToRemove.forEach((storageKey) => localStorage.removeItem(storageKey))
  }

  logUserPanelCacheEvent('invalidate-prefix', prefix)
}

export const clearUserPanelCache = (userId) => {
  invalidateUserPanelCacheByPrefix(buildUserPanelCacheKey(userId, ''))
}

export const readSnapshot = (key) => {
  if (!key) {
    return null
  }

  const parsedValue = readStorageValue(key)
  return parsedValue?.data ?? null
}

export const writeSnapshot = (key, data) => {
  if (!key) {
    return
  }

  writeStorageValue(key, {
    savedAt: Date.now(),
    data,
  })
}

export const removeSnapshot = (key) => {
  if (!key) {
    return
  }

  removeStorageValue(key)
}
