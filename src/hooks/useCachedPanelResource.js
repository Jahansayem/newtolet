'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildUserPanelCacheKey,
  getUserPanelCacheSnapshot,
  revalidateUserPanelResource,
} from '../services/cacheService'
import { getUserPanelCachePolicy } from '../services/userPanelCacheConfig'

const EMPTY_STATE = Object.freeze({
  data: null,
  error: null,
  isLoading: false,
  isRefreshing: false,
  hasCachedData: false,
  isOffline: false,
  lastUpdated: null,
})

const getInitialState = (cacheKey, enabled) => {
  if (!enabled || !cacheKey) {
    return EMPTY_STATE
  }

  const snapshot = getUserPanelCacheSnapshot(cacheKey)

  if (!snapshot?.data) {
    return {
      ...EMPTY_STATE,
      isLoading: true,
      isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
    }
  }

  return {
    data: snapshot.data,
    error: null,
    isLoading: false,
    isRefreshing: false,
    hasCachedData: true,
    isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
    lastUpdated: snapshot.savedAt || null,
  }
}

export default function useCachedPanelResource({
  userId,
  resourceKey,
  loader,
  enabled = true,
  policy = null,
  revalidateOnFocus = false,
  refreshKey = 0,
}) {
  const resolvedPolicy = useMemo(
    () => ({ ...getUserPanelCachePolicy(resourceKey), ...(policy || {}) }),
    [policy, resourceKey]
  )
  const cacheKey = useMemo(() => {
    if (!enabled || !resourceKey) {
      return null
    }

    return buildUserPanelCacheKey(userId || 'guest', resourceKey)
  }, [enabled, resourceKey, userId])

  const [state, setState] = useState(() => getInitialState(cacheKey, enabled))
  const requestVersionRef = useRef(0)
  const loaderRef = useRef(loader)

  useEffect(() => {
    loaderRef.current = loader
  }, [loader])

  useEffect(() => {
    if (!enabled || !cacheKey || typeof loaderRef.current !== 'function') {
      setState(EMPTY_STATE)
      return undefined
    }

    let isMounted = true
    requestVersionRef.current += 1
    const requestVersion = requestVersionRef.current

    const applySnapshot = (snapshot) => {
      if (!isMounted || requestVersionRef.current !== requestVersion) {
        return
      }

      setState((current) => ({
        ...current,
        data: snapshot?.data ?? current.data,
        hasCachedData: Boolean(snapshot?.data ?? current.data),
        isLoading: false,
        lastUpdated: snapshot?.savedAt || current.lastUpdated || null,
        isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
      }))
    }

    const runLoad = async ({ force = false } = {}) => {
      const snapshot = getUserPanelCacheSnapshot(cacheKey)
      const hasCachedData = snapshot?.data !== null && snapshot?.data !== undefined
      const shouldRevalidate = force || !hasCachedData || snapshot.isStale || snapshot.isExpired

      applySnapshot(snapshot)

      if (!shouldRevalidate) {
        setState((current) => ({
          ...current,
          error: null,
          isRefreshing: false,
        }))
        return
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false && hasCachedData) {
        setState((current) => ({
          ...current,
          isLoading: false,
          isRefreshing: false,
          isOffline: true,
        }))
        return
      }

      setState((current) => ({
        ...current,
        error: force ? null : current.error,
        isLoading: current.hasCachedData ? false : true,
        isRefreshing: current.hasCachedData,
        isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
      }))

      try {
        const result = await revalidateUserPanelResource({
          cacheKey,
          policy: resolvedPolicy,
          fetcher: () => loaderRef.current(),
          force,
        })

        if (!isMounted || requestVersionRef.current !== requestVersion) {
          return
        }

        setState({
          data: result.data,
          error: null,
          isLoading: false,
          isRefreshing: false,
          hasCachedData: result.data !== null && result.data !== undefined,
          isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
          lastUpdated: result.savedAt || Date.now(),
        })
      } catch (error) {
        if (!isMounted || requestVersionRef.current !== requestVersion) {
          return
        }

        setState((current) => ({
          ...current,
          error,
          isLoading: false,
          isRefreshing: false,
          isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
        }))
      }
    }

    void runLoad()

    const handleFocus = () => {
      if (!revalidateOnFocus) {
        return
      }

      const snapshot = getUserPanelCacheSnapshot(cacheKey)
      if (!snapshot?.isStale && !snapshot?.isExpired) {
        return
      }

      void runLoad({ force: true })
    }

    const handleOnline = () => {
      const snapshot = getUserPanelCacheSnapshot(cacheKey)
      if (!snapshot?.data && snapshot?.data !== 0) {
        return
      }

      setState((current) => ({
        ...current,
        isOffline: false,
      }))

      if (snapshot.isStale || snapshot.isExpired) {
        void runLoad({ force: true })
      }
    }

    if (revalidateOnFocus) {
      window.addEventListener('focus', handleFocus)
      document.addEventListener('visibilitychange', handleFocus)
    }
    window.addEventListener('online', handleOnline)

    return () => {
      isMounted = false
      if (revalidateOnFocus) {
        window.removeEventListener('focus', handleFocus)
        document.removeEventListener('visibilitychange', handleFocus)
      }
      window.removeEventListener('online', handleOnline)
    }
  }, [cacheKey, enabled, refreshKey, resolvedPolicy, revalidateOnFocus])

  return state
}
