import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiCheck, FiEye, FiFilter, FiSearch, FiStar, FiTrash2, FiUsers, FiX } from 'react-icons/fi'
import {
  getAdminPropertiesPage,
  getAdminPropertyCounts,
  updatePropertyStatus,
  deleteProperty,
  togglePropertyFeatured,
  getDashboardStats,
  getAutoApproveProperties,
  toggleAutoApproveProperties,
} from '../../services/adminService'
import { readSnapshot, removeSnapshot, writeSnapshot } from '../../services/cacheService'

const PAGE_SIZE = 20
const PROPERTY_FILTERS = ['all', 'pending', 'approved', 'rejected']

const getAdminPropertiesCacheKey = (status, pageSize = PAGE_SIZE) =>
  `admin-properties:${status}:${pageSize}`

const buildEmptyPropertyCounts = () => ({
  total: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
})

const matchesPropertySearch = (property, search) => {
  if (!search) {
    return true
  }

  const cleanQuery = search.replace('#', '').trim().toLowerCase()

  if (!cleanQuery) {
    return true
  }

  const propertyIdNumber = (property.property_id_number || '').toString().toLowerCase()
  const databaseId = (property.id || '').toString().toLowerCase()
  const searchableText = [
    property.short_description,
    property.area,
    property.state_district,
    property.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    propertyIdNumber === cleanQuery ||
    databaseId === cleanQuery ||
    propertyIdNumber.includes(cleanQuery) ||
    databaseId.includes(cleanQuery) ||
    searchableText.includes(cleanQuery)
  )
}

const mergeUniqueProperties = (...propertyGroups) => {
  const merged = []
  const seenIds = new Set()

  propertyGroups.forEach((propertyGroup) => {
    ;(propertyGroup || []).forEach((property) => {
      if (!property?.id || seenIds.has(property.id)) {
        return
      }

      seenIds.add(property.id)
      merged.push(property)
    })
  })

  return merged
}

const PropertyManagement = () => {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [warningMessage, setWarningMessage] = useState('')
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false)
  const [totalUsers, setTotalUsers] = useState(0)
  const [updating, setUpdating] = useState(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [filteredTotalCount, setFilteredTotalCount] = useState(0)
  const [propertyCounts, setPropertyCounts] = useState(buildEmptyPropertyCounts())

  const propertiesRef = useRef([])
  const pageRef = useRef(0)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(true)
  const loadingMoreRef = useRef(false)
  const requestIdRef = useRef(0)
  const loadMoreTriggerRef = useRef(null)

  const cacheKey = useMemo(
    () => getAdminPropertiesCacheKey(statusFilter, PAGE_SIZE),
    [statusFilter]
  )

  useEffect(() => {
    propertiesRef.current = properties
  }, [properties])

  useEffect(() => {
    pageRef.current = page
  }, [page])

  useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  useEffect(() => {
    loadingMoreRef.current = loadingMore
  }, [loadingMore])

  const visibleProperties = useMemo(
    () => properties.filter((property) => matchesPropertySearch(property, searchTerm)),
    [properties, searchTerm]
  )

  const persistCachedSnapshot = useCallback(
    (snapshot) => {
      writeSnapshot(cacheKey, {
        ...snapshot,
        activeFilter: statusFilter,
        pageSize: PAGE_SIZE,
        savedAt: Date.now(),
      })
    },
    [cacheKey, statusFilter]
  )

  const invalidatePropertyCache = useCallback(() => {
    PROPERTY_FILTERS.forEach((filter) => {
      removeSnapshot(getAdminPropertiesCacheKey(filter, PAGE_SIZE))
    })
  }, [])

  const fetchUserStats = useCallback(async () => {
    const result = await getDashboardStats()

    if (result.data) {
      setTotalUsers(result.data.totalUsers || 0)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    const result = await getAutoApproveProperties()
    setAutoApproveEnabled(Boolean(result.data?.auto_approve_properties))

    if (result.meta?.isFallback) {
      setWarningMessage(
        result.meta?.missingTable
          ? 'Supabase site_settings table is missing. Auto-approve is currently stored only in this browser until the SQL fix is applied.'
          : 'Auto-approve is currently using a local fallback instead of a shared Supabase setting.'
      )
      return
    }

    setWarningMessage('')
  }, [])

  const fetchPropertyCounts = useCallback(async () => {
    const result = await getAdminPropertyCounts()

    if (result.data) {
      setPropertyCounts(result.data)
    }
  }, [])

  const applySnapshot = useCallback((snapshot) => {
    const cachedItems = Array.isArray(snapshot?.items) ? snapshot.items : []
    const cachedPage = Math.max(0, Number(snapshot?.page) || 0)
    const cachedHasMore =
      typeof snapshot?.hasMore === 'boolean' ? snapshot.hasMore : cachedItems.length > 0
    const cachedTotalCount = Number(snapshot?.totalCount) || 0

    setProperties(cachedItems)
    setPage(cachedPage)
    setHasMore(cachedHasMore)
    setFilteredTotalCount(cachedTotalCount)
    setLoading(false)
    setLoadingMore(false)

    propertiesRef.current = cachedItems
    pageRef.current = cachedPage
    hasMoreRef.current = cachedHasMore
    loadingRef.current = false
    loadingMoreRef.current = false
  }, [])

  const loadPropertiesPage = useCallback(
    async ({ pageToLoad = 1, reset = false, background = false } = {}) => {
      if (!reset) {
        if (loadingRef.current || loadingMoreRef.current || !hasMoreRef.current) {
          return
        }

        if (pageToLoad <= pageRef.current) {
          return
        }
      }

      const requestId = ++requestIdRef.current

      if (reset) {
        if (!background) {
          setLoading(true)
          loadingRef.current = true
        }

        setLoadingMore(false)
        loadingMoreRef.current = false
      } else {
        setLoadingMore(true)
        loadingMoreRef.current = true
      }

      const result = await getAdminPropertiesPage({
        page: pageToLoad,
        pageSize: PAGE_SIZE,
        status: statusFilter,
      })

      if (requestId !== requestIdRef.current) {
        return
      }

      if (result.data) {
        const existingItems = reset
          ? background
            ? propertiesRef.current
            : []
          : propertiesRef.current

        let nextItems = reset
          ? background
            ? mergeUniqueProperties(result.data, existingItems)
            : result.data
          : mergeUniqueProperties(existingItems, result.data)

        const totalCount = Math.max(0, Number(result.totalCount) || 0)
        const trimmedItems =
          totalCount === 0
            ? []
            : nextItems.length > totalCount
              ? nextItems.slice(0, totalCount)
              : nextItems

        const nextPage = reset
          ? background
            ? Math.max(pageRef.current, pageToLoad)
            : pageToLoad
          : pageToLoad
        const nextHasMore = totalCount > 0 && totalCount > trimmedItems.length

        setProperties(trimmedItems)
        setPage(nextPage)
        setHasMore(nextHasMore)
        setFilteredTotalCount(totalCount)

        propertiesRef.current = trimmedItems
        pageRef.current = nextPage
        hasMoreRef.current = nextHasMore

        persistCachedSnapshot({
          items: trimmedItems,
          page: nextPage,
          nextPage: nextHasMore ? nextPage + 1 : nextPage,
          hasMore: nextHasMore,
          totalCount,
        })
      }

      setLoading(false)
      setLoadingMore(false)
      loadingRef.current = false
      loadingMoreRef.current = false
    },
    [persistCachedSnapshot, statusFilter]
  )

  useEffect(() => {
    fetchSettings()
    fetchUserStats()
    fetchPropertyCounts()
  }, [fetchPropertyCounts, fetchSettings, fetchUserStats])

  useEffect(() => {
    setSelectedProperty(null)

    const cachedSnapshot = readSnapshot(cacheKey)

    if (cachedSnapshot) {
      applySnapshot(cachedSnapshot)
    } else {
      setProperties([])
      setPage(0)
      setHasMore(true)
      setFilteredTotalCount(0)
      setLoading(true)

      propertiesRef.current = []
      pageRef.current = 0
      hasMoreRef.current = true
      loadingRef.current = true
      loadingMoreRef.current = false
    }

    loadPropertiesPage({
      pageToLoad: 1,
      reset: true,
      background: Boolean(cachedSnapshot),
    })
  }, [applySnapshot, cacheKey, loadPropertiesPage])

  useEffect(() => {
    const sentinel = loadMoreTriggerRef.current

    if (!sentinel || !hasMore || loading || loadingMore) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]

        if (entry?.isIntersecting) {
          loadPropertiesPage({ pageToLoad: pageRef.current + 1 })
        }
      },
      {
        rootMargin: '320px 0px',
      }
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, loadPropertiesPage])

  const refreshCurrentFilter = useCallback(
    async ({ clearCache = false } = {}) => {
      if (clearCache) {
        invalidatePropertyCache()
      }

      await Promise.all([
        loadPropertiesPage({ pageToLoad: 1, reset: true }),
        fetchPropertyCounts(),
      ])
    },
    [fetchPropertyCounts, invalidatePropertyCache, loadPropertiesPage]
  )

  const handleStatusChange = async (propertyId, newStatus) => {
    setUpdating(propertyId)
    const result = await updatePropertyStatus(propertyId, newStatus)

    if (result.data) {
      setSuccessMessage(`Property ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully`)
      await refreshCurrentFilter({ clearCache: true })
      setTimeout(() => setSuccessMessage(''), 3000)
    }

    setUpdating(null)
  }

  const handleDeleteProperty = async (propertyId) => {
    const result = await deleteProperty(propertyId)

    if (result.error === null) {
      setSuccessMessage('Property deleted successfully')
      await refreshCurrentFilter({ clearCache: true })
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  const handleToggleFeatured = async (propertyId, currentFeatured) => {
    const result = await togglePropertyFeatured(propertyId, !currentFeatured)

    if (result.data) {
      setSuccessMessage(!currentFeatured ? 'Property marked as featured' : 'Property removed from featured')
      await refreshCurrentFilter({ clearCache: true })
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  const handleToggleAutoApprove = async () => {
    const newValue = !autoApproveEnabled
    const result = await toggleAutoApproveProperties(newValue)
    const persistedValue = Boolean(result.data?.auto_approve_properties)

    setAutoApproveEnabled(persistedValue)

    if (result.meta?.isFallback) {
      setSuccessMessage('')
      setWarningMessage(
        result.meta?.missingTable
          ? 'Supabase site_settings table is missing. This toggle changed only in this browser. Run CREATE_SITE_SETTINGS_TABLE.sql in Supabase to make it shared.'
          : 'Auto-approve could not be persisted to Supabase. This toggle changed only in this browser.'
      )
      return
    }

    setWarningMessage('')
    setSuccessMessage(
      persistedValue
        ? 'Auto-approve enabled: Properties will be approved automatically'
        : 'Auto-approve disabled: Manual approval required'
    )
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const getStatusBadge = (status) => {
    const styles = {
      approved: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800',
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.pending}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Pending'}
      </span>
    )
  }

  const stats = {
    total: propertyCounts.total,
    approved: propertyCounts.approved,
    pending: propertyCounts.pending,
    rejected: propertyCounts.rejected,
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-green-600 hover:text-green-800"
            type="button"
          >
            x
          </button>
        </div>
      )}

      {warningMessage && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg">
          <p className="font-medium">{warningMessage}</p>
          <p className="mt-1 text-sm text-amber-800">
            Run CREATE_SITE_SETTINGS_TABLE.sql in Supabase SQL editor or through Supabase MCP, then refresh this page.
          </p>
        </div>
      )}

      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-6 text-white border-2 border-purple-400">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <FiCheck className="text-white text-3xl" />
            </div>
            <div>
              <p className="text-purple-100 text-sm font-bold uppercase tracking-wider">Auto-Approve Properties</p>
              <p className="text-2xl font-black leading-tight mt-1">
                {autoApproveEnabled ? 'ENABLED' : 'DISABLED'}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <p className="text-purple-100 text-sm max-w-xs">
              {autoApproveEnabled
                ? 'Properties are automatically approved upon submission'
                : 'Admin must manually approve each property'}
            </p>
            <button
              onClick={handleToggleAutoApprove}
              className="flex items-center gap-3 bg-white/20 hover:bg-white/30 px-6 py-3 rounded-xl transition-all border-2 border-white/30"
              type="button"
            >
              <span className="text-lg font-black">
                {autoApproveEnabled ? 'ON' : 'OFF'}
              </span>
              <div
                className={`relative w-16 h-8 rounded-full transition-colors ${
                  autoApproveEnabled ? 'bg-green-400' : 'bg-gray-400'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ${
                    autoApproveEnabled ? 'left-8' : 'left-1'
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FiUsers className="text-white text-xl" />
            </div>
            <div>
              <p className="text-gray-900 text-xs font-medium uppercase tracking-wide">Total Users</p>
              <p className="text-2xl font-bold leading-tight">{totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FiCheck className="text-white text-xl" />
            </div>
            <div>
              <p className="text-green-100 text-xs font-medium uppercase tracking-wide">Approved</p>
              <p className="text-2xl font-bold leading-tight">{stats.approved}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FiEye className="text-white text-xl" />
            </div>
            <div>
              <p className="text-yellow-100 text-xs font-medium uppercase tracking-wide">Pending</p>
              <p className="text-2xl font-bold leading-tight">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FiX className="text-white text-xl" />
            </div>
            <div>
              <p className="text-red-100 text-xs font-medium uppercase tracking-wide">Rejected</p>
              <p className="text-2xl font-bold leading-tight">{stats.rejected}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="#100000, title, area, or category..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="all">All Properties</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <button
            onClick={() => refreshCurrentFilter({ clearCache: true })}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-500">
          <p>
            Loaded {properties.length} of {filteredTotalCount} properties for{' '}
            <span className="font-semibold text-gray-700">
              {statusFilter === 'all' ? 'all statuses' : statusFilter}
            </span>
          </p>
          <p>
            {searchTerm
              ? `${visibleProperties.length} loaded matches for "${searchTerm.trim()}"`
              : `${stats.total} total properties across all statuses`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : visibleProperties.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg">No properties found</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visibleProperties.map((property) => (
              <div key={property.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
                <div className="relative h-48 bg-gray-200">
                  {property.images && property.images.length > 0 ? (
                    <img
                      src={property.images[0]}
                      alt={property.short_description}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-300">
                      <span className="text-gray-500">No Image</span>
                    </div>
                  )}
                  {property.is_featured && (
                    <div className="absolute top-3 left-3 bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <FiStar size={12} />
                      Featured
                    </div>
                  )}
                  <div className="absolute top-3 right-3">{getStatusBadge(property.status)}</div>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    {property.property_id_number && (
                      <p className="text-xs font-bold text-[#1E73B8] mb-1">
                        #{property.property_id_number}
                      </p>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                      {property.short_description || 'No title'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {property.category} | {property.area}, {property.state_district}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-primary-600">
                      BDT {property.rent_amount_bdt?.toLocaleString()}
                      <span className="text-sm font-normal text-gray-600">/{property.rent_period || 'month'}</span>
                    </span>
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
                    {property.status === 'pending' && !autoApproveEnabled && (
                      <>
                        <button
                          onClick={() => handleStatusChange(property.id, 'approved')}
                          disabled={updating === property.id}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-medium disabled:opacity-50"
                          type="button"
                        >
                          <FiCheck size={16} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(property.id, 'rejected')}
                          disabled={updating === property.id}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm font-medium disabled:opacity-50"
                          type="button"
                        >
                          <FiX size={16} />
                          Reject
                        </button>
                      </>
                    )}
                    {property.status === 'approved' && (
                      <>
                        <button
                          onClick={() => handleToggleFeatured(property.id, property.is_featured)}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg transition text-sm font-medium ${
                            property.is_featured
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          type="button"
                        >
                          <FiStar size={16} />
                          {property.is_featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <button
                          onClick={() => setSelectedProperty(property)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
                          type="button"
                        >
                          <FiEye size={16} />
                          View
                        </button>
                      </>
                    )}
                    {property.status === 'rejected' && (
                      <button
                        onClick={() => handleStatusChange(property.id, 'approved')}
                        disabled={updating === property.id}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-medium disabled:opacity-50"
                        type="button"
                      >
                        <FiCheck size={16} />
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedProperty(property)}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                      type="button"
                    >
                      <FiEye size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteProperty(property.id)}
                      className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                      type="button"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div ref={loadMoreTriggerRef} className="h-4" />

          {loadingMore && (
            <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center gap-3 text-gray-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
              <span>Loading more properties...</span>
            </div>
          )}

          {!hasMore && properties.length > 0 && (
            <div className="text-center text-sm text-gray-500">
              All available properties for this filter are loaded.
            </div>
          )}
        </div>
      )}

      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onApprove={() => {
            handleStatusChange(selectedProperty.id, 'approved')
            setSelectedProperty(null)
          }}
          onReject={() => {
            handleStatusChange(selectedProperty.id, 'rejected')
            setSelectedProperty(null)
          }}
          onToggleFeatured={() => {
            handleToggleFeatured(selectedProperty.id, selectedProperty.is_featured)
            setSelectedProperty(null)
          }}
          onDelete={() => {
            handleDeleteProperty(selectedProperty.id)
            setSelectedProperty(null)
          }}
        />
      )}
    </div>
  )
}

const PropertyDetailModal = ({ property, onClose, onApprove, onReject, onToggleFeatured, onDelete }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{property.short_description || 'Property'}</h2>
              <p className="text-gray-600">
                {property.category} in {property.area}, {property.state_district}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              type="button"
            >
              x
            </button>
          </div>

          {property.images && property.images.length > 0 && (
            <div className="mb-6">
              <img
                src={property.images[0]}
                alt={property.short_description}
                className="w-full h-64 object-cover rounded-lg"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Rent Amount</label>
              <p className="text-lg font-semibold text-gray-900">
                BDT {property.rent_amount_bdt?.toLocaleString()} / {property.rent_period || 'month'}
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Status</label>
              <p className="text-lg font-semibold capitalize">{property.status || 'Pending'}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Bedrooms</label>
              <p className="text-lg font-semibold">{property.bedrooms || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Bathrooms</label>
              <p className="text-lg font-semibold">{property.bathrooms || 'N/A'}</p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Full Description</label>
              <p className="text-gray-700">{property.full_description || 'No description'}</p>
            </div>
            {property.amenities && (
              <div className="col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Amenities</label>
                <p className="text-gray-700">{property.amenities}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {property.status === 'pending' && (
              <>
                <button
                  onClick={onApprove}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                  type="button"
                >
                  Approve
                </button>
                <button
                  onClick={onReject}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                  type="button"
                >
                  Reject
                </button>
              </>
            )}
            {property.status === 'approved' && (
              <button
                onClick={onToggleFeatured}
                className={`flex-1 px-4 py-2 rounded-lg transition font-medium ${
                  property.is_featured
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
                type="button"
              >
                {property.is_featured ? 'Remove from Featured' : 'Mark as Featured'}
              </button>
            )}
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium"
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PropertyManagement
