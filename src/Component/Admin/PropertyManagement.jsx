import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiCheck, FiEdit2, FiEye, FiFilter, FiSearch, FiStar, FiTrash2, FiUsers, FiX } from 'react-icons/fi'
import {
  getAdminDuplicatePhoneGroupsPage,
  getAdminPropertiesPage,
  getAdminPropertiesByPhoneGroup,
  getAdminPropertyCounts,
  updatePropertyStatus,
  updatePropertiesStatus,
  approveAllPendingProperties,
  deleteProperty,
  togglePropertyFeatured,
  getDashboardStats,
  getAutoApproveProperties,
  toggleAutoApproveProperties,
} from '../../services/adminService'
import { readSnapshot, removeSnapshot, writeSnapshot } from '../../services/cacheService'
import { buildEditPropertyHref, buildPageHref } from '../../lib/routePaths'
import { PropertyThumbnailImage } from '../../components/PropertyCardMedia'
import RentDisplay from '../../components/RentDisplay'

const PAGE_SIZE = 20
const PROPERTY_FILTERS = ['all', 'pending', 'approved', 'rejected', 'duplicate_pending']

const getAdminPropertyPricing = (property = {}) => ({
  rent_amount_bdt: property.rent_amount_bdt ?? property.pricing?.rent_amount_bdt,
  is_rent_negotiable: property.is_rent_negotiable ?? property.pricing?.is_rent_negotiable,
})

const AdminRentDisplay = ({ property = {} }) => {
  return (
    <RentDisplay
      pricing={getAdminPropertyPricing(property)}
      fallback="Price unavailable"
      suffix={property.rent_amount_bdt ? `/ ${property.rent_period || 'month'}` : ''}
    />
  )
}

const getAdminPropertyImageSource = (property = {}) =>
  property.images?.find((image) => typeof image === 'string' && image.trim()) ||
  property.primary_image ||
  (typeof property.image_url === 'string' && property.image_url.trim() ? property.image_url.trim() : null)

const getAdminPropertiesCacheKey = (status, pageSize = PAGE_SIZE, phoneKey = '') =>
  `admin-properties:${status}:${pageSize}:${phoneKey || 'root'}`

const buildEmptyPropertyCounts = () => ({
  total: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
  duplicatePending: 0,
})

const getFilterLabel = (filter) => {
  if (filter === 'duplicate_pending') {
    return 'duplicate pending'
  }

  return filter === 'all' ? 'all statuses' : filter
}

const getSubmitterLabel = (property = {}) => {
  const submitter = property.submitted_by || {}
  return submitter.name || submitter.email || submitter.phone || submitter.id || property.user_id || 'Unknown user'
}

const getAdminEditPropertyHref = (propertyId) =>
  buildEditPropertyHref(propertyId, {
    admin: '1',
    returnTo: buildPageHref('admin-dashboard', { tab: 'properties' }),
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
    property.contact_number,
    property.submitted_by?.name,
    property.submitted_by?.email,
    property.submitted_by?.phone,
    property.submitted_by?.id,
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

const matchesDuplicatePhoneGroupSearch = (group, search) => {
  if (!search) {
    return true
  }

  const cleanQuery = search.replace('#', '').trim().toLowerCase()

  if (!cleanQuery) {
    return true
  }

  const previewProperty = group?.previewProperty || {}
  const searchableText = [
    group?.contact_number,
    previewProperty.short_description,
    previewProperty.area,
    previewProperty.state_district,
    previewProperty.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return searchableText.includes(cleanQuery)
}

const mergeUniqueItems = (getItemKey, ...itemGroups) => {
  const merged = []
  const seenKeys = new Set()

  itemGroups.forEach((itemGroup) => {
    ;(itemGroup || []).forEach((item) => {
      const itemKey = getItemKey(item)

      if (!itemKey || seenKeys.has(itemKey)) {
        return
      }

      seenKeys.add(itemKey)
      merged.push(item)
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
  const [selectedPhoneGroup, setSelectedPhoneGroup] = useState(null)
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [warningMessage, setWarningMessage] = useState('')
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false)
  const [totalUsers, setTotalUsers] = useState(0)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [selectedPropertyIds, setSelectedPropertyIds] = useState(() => new Set())
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

  const activePhoneKey =
    statusFilter === 'duplicate_pending' ? selectedPhoneGroup?.duplicatePhoneKey || '' : ''
  const isDuplicateGroupView = statusFilter === 'duplicate_pending' && !selectedPhoneGroup
  const cacheKey = useMemo(
    () => getAdminPropertiesCacheKey(statusFilter, PAGE_SIZE, activePhoneKey),
    [activePhoneKey, statusFilter]
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

  const visibleItems = useMemo(
    () =>
      properties.filter((item) =>
        isDuplicateGroupView
          ? matchesDuplicatePhoneGroupSearch(item, searchTerm)
          : matchesPropertySearch(item, searchTerm)
      ),
    [isDuplicateGroupView, properties, searchTerm]
  )
  const loadedPendingProperties = useMemo(
    () => properties.filter((property) => property?.status === 'pending'),
    [properties]
  )
  const visiblePendingProperties = useMemo(
    () =>
      isDuplicateGroupView
        ? []
        : visibleItems.filter((property) => property?.status === 'pending'),
    [isDuplicateGroupView, visibleItems]
  )
  const selectedPendingPropertyIds = useMemo(() => {
    const loadedPendingIds = new Set(loadedPendingProperties.map((property) => property.id))

    return Array.from(selectedPropertyIds).filter((propertyId) =>
      loadedPendingIds.has(propertyId)
    )
  }, [loadedPendingProperties, selectedPropertyIds])
  const selectedPendingCount = selectedPendingPropertyIds.length
  const allVisiblePendingSelected =
    visiblePendingProperties.length > 0 &&
    visiblePendingProperties.every((property) => selectedPropertyIds.has(property.id))

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
    if (activePhoneKey) {
      removeSnapshot(getAdminPropertiesCacheKey('duplicate_pending', PAGE_SIZE, activePhoneKey))
    }
  }, [activePhoneKey])

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

      const loaderResult = isDuplicateGroupView
        ? await getAdminDuplicatePhoneGroupsPage({
            page: pageToLoad,
            pageSize: PAGE_SIZE,
          })
        : selectedPhoneGroup
          ? await getAdminPropertiesByPhoneGroup({
              phoneKey: activePhoneKey,
              page: pageToLoad,
              pageSize: PAGE_SIZE,
            })
          : await getAdminPropertiesPage({
              page: pageToLoad,
              pageSize: PAGE_SIZE,
              status: statusFilter,
            })
      const resultToApply = loaderResult

      if (requestId !== requestIdRef.current) {
        return
      }

      if (resultToApply.data) {
        const existingItems = reset
          ? background
            ? propertiesRef.current
            : []
          : propertiesRef.current
        const getItemKey = isDuplicateGroupView
          ? (item) => item?.duplicatePhoneKey
          : (item) => item?.id

        let nextItems = reset
          ? background
            ? mergeUniqueItems(getItemKey, resultToApply.data, existingItems)
            : resultToApply.data
          : mergeUniqueItems(getItemKey, existingItems, resultToApply.data)

        const totalCount = Math.max(0, Number(resultToApply.totalCount) || 0)
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
    [activePhoneKey, isDuplicateGroupView, persistCachedSnapshot, selectedPhoneGroup, statusFilter]
  )

  useEffect(() => {
    fetchSettings()
    fetchUserStats()
    fetchPropertyCounts()
  }, [fetchPropertyCounts, fetchSettings, fetchUserStats])

  useEffect(() => {
    if (statusFilter !== 'duplicate_pending' && selectedPhoneGroup) {
      setSelectedPhoneGroup(null)
    }
  }, [selectedPhoneGroup, statusFilter])

  useEffect(() => {
    setSelectedProperty(null)
    setSelectedPropertyIds(new Set())

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

  const handlePhoneGroupSelect = (phoneGroup) => {
    setSelectedPhoneGroup(phoneGroup)
    setSelectedProperty(null)
    setSelectedPropertyIds(new Set())
    setSearchTerm('')
  }

  const handlePhoneGroupClear = () => {
    setSelectedPhoneGroup(null)
    setSelectedProperty(null)
    setSelectedPropertyIds(new Set())
    setSearchTerm('')
  }

  const togglePropertySelection = (propertyId) => {
    setSelectedPropertyIds((currentSelection) => {
      const nextSelection = new Set(currentSelection)

      if (nextSelection.has(propertyId)) {
        nextSelection.delete(propertyId)
      } else {
        nextSelection.add(propertyId)
      }

      return nextSelection
    })
  }

  const toggleVisiblePendingSelection = () => {
    setSelectedPropertyIds((currentSelection) => {
      const nextSelection = new Set(currentSelection)

      if (allVisiblePendingSelected) {
        visiblePendingProperties.forEach((property) => nextSelection.delete(property.id))
      } else {
        visiblePendingProperties.forEach((property) => nextSelection.add(property.id))
      }

      return nextSelection
    })
  }

  const handleStatusChange = async (propertyId, newStatus) => {
    const result = await updatePropertyStatus(propertyId, newStatus)

    if (result.data) {
      setWarningMessage('')
      setSuccessMessage(`Property ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully`)
      await refreshCurrentFilter({ clearCache: true })
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  const handleBulkStatusChange = async (newStatus) => {
    if (!selectedPendingPropertyIds.length || bulkUpdating) {
      return
    }

    setBulkUpdating(true)
    const result = await updatePropertiesStatus(selectedPendingPropertyIds, newStatus)

    if (result.data) {
      const updatedCount = result.data.length
      setSelectedPropertyIds(new Set())
      setWarningMessage('')
      setSuccessMessage(
        `${updatedCount} ${updatedCount === 1 ? 'property' : 'properties'} ${
          newStatus === 'approved' ? 'approved' : 'rejected'
        } successfully`
      )
      await refreshCurrentFilter({ clearCache: true })
      setTimeout(() => setSuccessMessage(''), 3000)
    } else {
      setWarningMessage('Unable to update the selected pending properties. Please try again.')
    }

    setBulkUpdating(false)
  }

  const handleApproveAllPending = async () => {
    if (bulkUpdating) {
      return
    }

    setBulkUpdating(true)
    const result = await approveAllPendingProperties()

    if (result.data) {
      const approvedCount = result.data.approvedCount || 0
      setSelectedPropertyIds(new Set())
      setWarningMessage('')
      setSuccessMessage(
        `${approvedCount} pending ${approvedCount === 1 ? 'property' : 'properties'} approved successfully`
      )
      await refreshCurrentFilter({ clearCache: true })
      setTimeout(() => setSuccessMessage(''), 3000)
    } else {
      setWarningMessage('Unable to approve all pending properties. Please try again.')
    }

    setBulkUpdating(false)
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
    duplicatePending: propertyCounts.duplicatePending,
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

        <button
          onClick={() => setStatusFilter('duplicate_pending')}
          className={`rounded-xl shadow-lg p-4 text-white text-left transition ${
            statusFilter === 'duplicate_pending'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 ring-4 ring-rose-200'
              : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600'
          }`}
          type="button"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FiFilter className="text-white text-xl" />
            </div>
            <div>
              <p className="text-rose-100 text-xs font-medium uppercase tracking-wide">Duplicate Pending</p>
              <p className="text-2xl font-bold leading-tight">{stats.duplicatePending}</p>
            </div>
          </div>
        </button>
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
              <option value="duplicate_pending">Duplicate Pending</option>
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
            Loaded {properties.length} of {filteredTotalCount}{' '}
            {isDuplicateGroupView ? 'phone groups' : 'properties'} for{' '}
            <span className="font-semibold text-gray-700">
              {getFilterLabel(statusFilter)}
            </span>
          </p>
          <p>
            {searchTerm
              ? `${visibleItems.length} loaded matches for "${searchTerm.trim()}"`
              : selectedPhoneGroup
                ? `${filteredTotalCount} total properties for ${selectedPhoneGroup.contact_number || selectedPhoneGroup.duplicatePhoneKey}`
                : statusFilter === 'duplicate_pending'
                  ? `${stats.duplicatePending} total duplicate pending properties across ${filteredTotalCount} phone numbers`
                  : `${stats.total} total properties across all statuses`}
          </p>
        </div>
      </div>

      {!isDuplicateGroupView && (
        <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Pending review actions</p>
            <p className="text-sm text-gray-600">
              {selectedPendingCount} selected from {loadedPendingProperties.length} loaded pending properties
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={toggleVisiblePendingSelection}
              disabled={visiblePendingProperties.length === 0 || bulkUpdating}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              {allVisiblePendingSelected ? 'Clear Visible Pending' : 'Select Visible Pending'}
            </button>
            <button
              onClick={() => handleBulkStatusChange('approved')}
              disabled={selectedPendingCount === 0 || bulkUpdating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              <FiCheck size={16} />
              Approve Selected
            </button>
            <button
              onClick={() => handleBulkStatusChange('rejected')}
              disabled={selectedPendingCount === 0 || bulkUpdating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              <FiX size={16} />
              Reject Selected
            </button>
            <button
              onClick={handleApproveAllPending}
              disabled={stats.pending === 0 || bulkUpdating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              <FiCheck size={16} />
              Approve All Pending
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg">
            {statusFilter === 'duplicate_pending'
              ? isDuplicateGroupView
                ? 'No duplicate phone groups found'
                : 'No properties found for this phone number'
              : 'No properties found'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {selectedPhoneGroup && (
            <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-primary-700">Phone drilldown</p>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedPhoneGroup.contact_number || selectedPhoneGroup.duplicatePhoneKey}
                </h3>
                <p className="text-sm text-gray-600">
                  Showing all properties under this phone number across every status
                </p>
              </div>
              <button
                onClick={handlePhoneGroupClear}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                type="button"
              >
                Back to Duplicate Groups
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {isDuplicateGroupView &&
              visibleItems.map((group) => (
                <DuplicatePhoneGroupCard
                  key={group.duplicatePhoneKey}
                  group={group}
                  onOpen={() => handlePhoneGroupSelect(group)}
                />
              ))}

            {!isDuplicateGroupView &&
              visibleItems.map((property) => (
                <div key={property.id} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
                <div className="relative h-48 bg-gray-200">
                  <PropertyThumbnailImage
                    src={getAdminPropertyImageSource(property)}
                    alt={property.short_description || property.category || 'Property'}
                    propertyType={property.property_type}
                    category={property.category}
                    pricing={getAdminPropertyPricing(property)}
                  />
                  {property.is_featured && (
                    <div className="absolute top-3 left-3 bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <FiStar size={12} />
                      Featured
                    </div>
                  )}
                  {property.status === 'pending' && (
                    <label className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold text-gray-800 shadow">
                      <input
                        type="checkbox"
                        checked={selectedPropertyIds.has(property.id)}
                        onChange={() => togglePropertySelection(property.id)}
                        disabled={bulkUpdating}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600 disabled:cursor-not-allowed"
                      />
                      Select
                    </label>
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
                    {property.isDuplicatePhone && (
                      <p className="mb-1 inline-flex items-center rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                        Duplicate Phone x{property.duplicateCount || 0}
                      </p>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                      {property.short_description || 'No title'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {property.category} | {property.area}, {property.state_district}
                    </p>
                    {property.contact_number && (
                      <p className="text-xs text-gray-500 mt-1">Phone: {property.contact_number}</p>
                    )}
                    <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      <p className="font-semibold text-gray-800">Submitted by {getSubmitterLabel(property)}</p>
                      {property.submitted_by?.email && <p>{property.submitted_by.email}</p>}
                      {property.submitted_by?.phone && <p>{property.submitted_by.phone}</p>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-primary-600">
                      <AdminRentDisplay property={property} />
                    </span>
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
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
                    <button
                      onClick={() => setSelectedProperty(property)}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                      type="button"
                      title="View property"
                    >
                      <FiEye size={16} />
                    </button>
                    <a
                      href={getAdminEditPropertyHref(property.id)}
                      className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
                      title="Edit property"
                    >
                      <FiEdit2 size={16} />
                    </a>
                    <button
                      onClick={() => handleDeleteProperty(property.id)}
                      className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                      type="button"
                      title="Delete property"
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
          onEdit={() => {
            window.location.href = getAdminEditPropertyHref(selectedProperty.id)
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

const DuplicatePhoneGroupCard = ({ group, onOpen }) => {
  const previewProperty = group?.previewProperty || {}
  const previewLocation = [previewProperty.area, previewProperty.state_district].filter(Boolean).join(', ')
  const previewMeta = [previewProperty.category, previewLocation].filter(Boolean).join(' | ')
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
      <div className="relative h-48 bg-gray-200">
        <PropertyThumbnailImage
          src={getAdminPropertyImageSource(previewProperty)}
          alt={previewProperty.short_description || group.contact_number || 'Property'}
          propertyType={previewProperty.property_type}
          category={previewProperty.category}
          pricing={getAdminPropertyPricing(previewProperty)}
        />
        <div className="absolute top-3 right-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
            {group.pendingDuplicateCount} Pending Duplicate
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <button
            onClick={onOpen}
            className="text-lg font-semibold text-primary-700 hover:text-primary-800 transition"
            type="button"
          >
            {group.contact_number || group.duplicatePhoneKey}
          </button>
          <p className="text-sm text-gray-600 mt-1">
            {group.totalPropertiesCount} total properties under this number
          </p>
          <h3 className="text-base font-semibold text-gray-900 mt-3 line-clamp-1">
            {previewProperty.short_description || 'No title'}
          </h3>
          {previewMeta && <p className="text-sm text-gray-600">{previewMeta}</p>}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-primary-600">
            <AdminRentDisplay property={previewProperty} />
          </span>
          <button
            onClick={onOpen}
            className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
            type="button"
          >
            View All
          </button>
        </div>
      </div>
    </div>
  )
}

const PropertyDetailModal = ({ property, onClose, onApprove, onReject, onToggleFeatured, onEdit, onDelete }) => {
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
                <AdminRentDisplay property={property} />
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Status</label>
              <p className="text-lg font-semibold capitalize">{property.status || 'Pending'}</p>
            </div>
            <div className="col-span-2 rounded-lg bg-gray-50 p-4">
              <label className="block text-sm text-gray-600 mb-1">Submitted By</label>
              <p className="text-lg font-semibold text-gray-900">{getSubmitterLabel(property)}</p>
              <div className="mt-1 text-sm text-gray-600">
                {property.submitted_by?.email && <p>Email: {property.submitted_by.email}</p>}
                {property.submitted_by?.phone && <p>Phone: {property.submitted_by.phone}</p>}
                {(property.submitted_by?.id || property.user_id) && (
                  <p>User ID: {property.submitted_by?.id || property.user_id}</p>
                )}
              </div>
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
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              type="button"
            >
              Edit
            </button>
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
