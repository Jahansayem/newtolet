'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAdminQueueCounts, readQueueCountsSnapshot, resetQueueCountsMemory } from '../../../services/admin/dashboard'
import { ADMIN_CACHE_EVENT } from '../../../services/admin/adminCache'

/**
 * Pending-queue counts for sidebar badges and dashboard tiles.
 * Paints from the last snapshot immediately, refreshes on mount, on an
 * interval, when the tab becomes visible, and after any admin mutation.
 */
export const useAdminQueueCounts = ({ refreshMs = 60000, enabled = true } = {}) => {
  const [counts, setCounts] = useState(() => (typeof window !== 'undefined' ? readQueueCountsSnapshot() : null))
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const refresh = useCallback(async ({ force = false } = {}) => {
    if (force) resetQueueCountsMemory()
    const result = await getAdminQueueCounts({ force })
    if (!mountedRef.current) return
    if (result.data) {
      setCounts(result.data)
      setError(null)
    } else if (result.error) {
      setError(result.error)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (!enabled) return undefined
    void refresh()
    const interval = setInterval(() => void refresh({ force: true }), refreshMs)
    const onInvalidate = () => void refresh({ force: true })
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh({ force: true })
    }
    window.addEventListener(ADMIN_CACHE_EVENT, onInvalidate)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
      window.removeEventListener(ADMIN_CACHE_EVENT, onInvalidate)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, refresh, refreshMs])

  return { counts, error, refresh }
}

export default useAdminQueueCounts
