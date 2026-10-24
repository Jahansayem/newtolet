// Snapshot cache for admin lists and counts (stale-while-revalidate), built on
// the shared localStorage snapshot helpers in cacheService.js.
//
// Keys:  admin:v2:list:<domain>:<hash>   first page of a list (no search)
//        admin:v2:counts:queue           sidebar / dashboard queue counts
//        admin:v2:dashboard              dashboard metrics
// Every successful mutation calls invalidateAdminSnapshots(<domain>), which
// also clears counts + dashboard and notifies open hooks.

import { readSnapshot, removeSnapshotsByPrefix, writeSnapshot } from '../cacheService'

export const ADMIN_CACHE_PREFIX = 'admin:v2:'
export const ADMIN_CACHE_EVENT = 'admin-cache-invalidated'
export const ADMIN_QUEUE_COUNTS_KEY = `${ADMIN_CACHE_PREFIX}counts:queue`
export const ADMIN_DASHBOARD_KEY = `${ADMIN_CACHE_PREFIX}dashboard`

// Stable, order-independent hash of list params for cache keys.
export const hashParams = (params = {}) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
  return entries.join('&') || 'default'
}

export const buildListKey = (domain, params) => `${ADMIN_CACHE_PREFIX}list:${domain}:${hashParams(params)}`

export const readAdminSnapshot = (key) => readSnapshot(key)
export const writeAdminSnapshot = (key, data) => writeSnapshot(key, data)

export const invalidateAdminSnapshots = (domain = null) => {
  if (domain) {
    removeSnapshotsByPrefix(`${ADMIN_CACHE_PREFIX}list:${domain}:`)
  } else {
    removeSnapshotsByPrefix(`${ADMIN_CACHE_PREFIX}list:`)
  }
  removeSnapshotsByPrefix(`${ADMIN_CACHE_PREFIX}counts:`)
  removeSnapshotsByPrefix(ADMIN_DASHBOARD_KEY)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_CACHE_EVENT, { detail: { domain } }))
  }
}

// One-time cleanup of the pre-v2 property snapshot keys.
if (typeof window !== 'undefined') {
  try {
    removeSnapshotsByPrefix('admin-properties:')
  } catch {
    /* ignore */
  }
}
