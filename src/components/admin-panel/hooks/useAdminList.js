'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ADMIN_CACHE_EVENT, buildListKey, readAdminSnapshot, writeAdminSnapshot } from '../../../services/admin/adminCache'
import { clearSupabaseConnectionFailureMark } from '../../../services/supabaseClient'
import { useDebouncedValue } from './useDebouncedValue'

/**
 * Server-paginated list state for admin sections.
 *
 * fetcher(params, { signal }) -> { data, error, totalCount, hasMore, page, pageSize }
 * params: { page, pageSize, sort, filters, search } (search is debounced)
 *
 * status: 'loading' | 'refreshing' | 'ready' | 'empty' | 'error' | 'permission-denied'
 */
export const useAdminList = ({
  domain,
  fetcher,
  initialSort = { column: 'created_at', dir: 'desc' },
  initialFilters = {},
  initialPageSize = 20,
  debounceMs = 300,
  enabled = true,
  cache = true,
}) => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [sort, setSortState] = useState(initialSort)
  const [filters, setFiltersState] = useState(initialFilters)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, debounceMs)

  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('loading')
  const [isStale, setIsStale] = useState(false)

  const requestIdRef = useRef(0)
  const abortRef = useRef(null)
  const mountedRef = useRef(true)
  // Callers often pass inline arrow fetchers; reading through a ref keeps `load`
  // stable so a new function identity never triggers a refetch loop.
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const params = useMemo(
    () => ({ page, pageSize, sort, filters, search: debouncedSearch.trim() }),
    [page, pageSize, sort, filters, debouncedSearch]
  )
  const cacheKey = cache && domain && page === 1 && !params.search ? buildListKey(domain, { pageSize, sort, filters }) : null

  const load = useCallback(
    async ({ background = false } = {}) => {
      if (!enabled) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const requestId = ++requestIdRef.current

      if (!background) {
        const snapshot = cacheKey ? readAdminSnapshot(cacheKey) : null
        if (snapshot?.items) {
          setItems(snapshot.items)
          setTotalCount(snapshot.totalCount || snapshot.items.length)
          setHasMore(Boolean(snapshot.hasMore))
          setIsStale(true)
          setStatus('refreshing')
        } else {
          setStatus((current) => (current === 'ready' || current === 'empty' ? 'refreshing' : 'loading'))
        }
      } else {
        setStatus((current) => (current === 'loading' ? 'loading' : 'refreshing'))
      }

      const result = await fetcherRef.current(params, { signal: controller.signal })
      if (!mountedRef.current || requestId !== requestIdRef.current || controller.signal.aborted) return

      if (result.error) {
        if (result.error.code === 'ABORTED') return
        setError(result.error)
        setIsStale(false)
        setStatus(result.error.permissionDenied ? 'permission-denied' : 'error')
        return
      }

      const rows = result.data || []
      setItems(rows)
      setTotalCount(result.totalCount ?? rows.length)
      setHasMore(Boolean(result.hasMore))
      setError(null)
      setIsStale(false)
      setStatus(rows.length === 0 && (result.totalCount ?? 0) === 0 ? 'empty' : 'ready')
      if (cacheKey) writeAdminSnapshot(cacheKey, { items: rows, totalCount: result.totalCount ?? rows.length, hasMore: Boolean(result.hasMore) })
    },
    [enabled, params, cacheKey]
  )

  useEffect(() => {
    mountedRef.current = true
    void load()
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [load])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onInvalidate = (event) => {
      if (!event.detail?.domain || event.detail.domain === domain) void load({ background: true })
    }
    window.addEventListener(ADMIN_CACHE_EVENT, onInvalidate)
    return () => window.removeEventListener(ADMIN_CACHE_EVENT, onInvalidate)
  }, [domain, load])

  const setSort = useCallback((next) => {
    setSortState(typeof next === 'function' ? next : () => next)
    setPage(1)
  }, [])

  const setFilters = useCallback((next) => {
    setFiltersState((current) => (typeof next === 'function' ? next(current) : { ...current, ...next }))
    setPage(1)
  }, [])

  const setFilter = useCallback((key, value) => setFilters({ [key]: value }), [setFilters])

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters)
    setSearch('')
    setPage(1)
  }, [initialFilters])

  const handleSearch = useCallback((value) => {
    setSearch(value)
    setPage(1)
  }, [])

  const retry = useCallback(() => {
    clearSupabaseConnectionFailureMark?.()
    void load()
  }, [load])

  return {
    status,
    items,
    totalCount,
    hasMore,
    page,
    pageSize,
    sort,
    filters,
    search,
    error,
    isStale,
    isLoading: status === 'loading',
    isRefreshing: status === 'refreshing',
    setPage,
    setPageSize: (size) => {
      setPageSize(size)
      setPage(1)
    },
    setSort,
    setFilters,
    setFilter,
    resetFilters,
    setSearch: handleSearch,
    refresh: () => load({ background: true }),
    retry,
  }
}

export default useAdminList
