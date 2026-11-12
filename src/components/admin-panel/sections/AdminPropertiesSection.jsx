'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiCheck, FiEdit2, FiRefreshCw, FiStar, FiTrash2, FiX } from 'react-icons/fi'
import {
  approveAllPending,
  countApprovablePending,
  getPropertyCounts,
  listDuplicatePhoneGroups,
  listProperties,
  setPropertyFeatured,
  setPropertyStatus,
  softDeleteProperty,
} from '../../../services/admin/properties'
import { getAutoApproveProperties, toggleAutoApproveProperties } from '../../../services/adminService'
import { ADMIN_CACHE_PREFIX, readAdminSnapshot, writeAdminSnapshot } from '../../../services/admin/adminCache'
import { clearSupabaseConnectionFailureMark } from '../../../services/supabaseClient'
import { PROPERTY_COUNT_LABELS, describeFailedCounts, mergePropertyCounts } from '../../../lib/propertyCounts'
import { LIST_FILTER_DEFAULTS, applyListUrlState, parseListUrlState } from '../../../lib/adminListUrlState'
import { districts } from '../../../utils/bangladeshLocations'
import { useSearchParams } from 'react-router-dom'
import { buildAdminEditPropertyHref } from '../../../lib/routePaths'
import { getPropertyDisplayLabel } from '../../../utils/propertyDisplaySerial'
import { useAdminPermissions } from '../../../contexts/AdminAccessContext'
import { PERMISSIONS } from '../../../lib/adminPermissions'
import RentDisplay from '../../RentDisplay'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useDeferredApproval } from '../hooks/useDeferredApproval'
import { useEntityParam } from '../hooks/useEntityParam'
import { useHotkeys } from '../hooks/useHotkeys'
import AdminPropertyEditor from '../property-editor/AdminPropertyEditor'
import CompletenessBadge from './properties/CompletenessBadge'
import DuplicateCompare from './properties/DuplicateCompare'
import ShortcutHelp from './properties/ShortcutHelp'
import PropertyDetailsDialog from './properties/PropertyDetailsDialog'
import { REJECT_REASONS } from '../propertyRejectReasons'
import { useToast } from '../../ui/ToastProvider'
import ActionMenu from '../../ui/ActionMenu'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmDialog from '../../ui/ConfirmDialog'
import DataTable from '../../ui/DataTable'
import EmptyState from '../../ui/EmptyState'
import FilterBar from '../../ui/FilterBar'
import InlineAlert from '../../ui/InlineAlert'
import Pagination from '../../ui/Pagination'
import ReasonDialog from '../../ui/ReasonDialog'
import StatCard from '../../ui/StatCard'
import StatusPill from '../../ui/StatusPill'
import Tabs, { tabPanelProps } from '../../ui/Tabs'

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
  { key: 'duplicates', label: 'Duplicates' },
]

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const CATEGORY_OPTIONS = ['Family', 'Office', 'Sublet', 'Bachelor', 'Hostel', 'Shop'].map((value) => ({ value, label: value }))
const DISTRICT_OPTIONS = Array.from(new Set(Object.values(districts).flat()))
  .sort((a, b) => a.localeCompare(b))
  .map((value) => ({ value, label: value }))
const SOURCE_LABELS = { ai: 'AI agent', users: 'People' }
// Filters behind "More filters"; they stay open while any of them is set.
const MORE_FILTER_KEYS = ['district', 'photos', 'from', 'to', 'featured', 'archived']
const SORT_OPTIONS = [
  { value: 'created_at.desc', label: 'Newest first' },
  { value: 'created_at.asc', label: 'Oldest first' },
  { value: 'rent_amount_bdt.desc', label: 'Rent: high to low' },
  { value: 'rent_amount_bdt.asc', label: 'Rent: low to high' },
  { value: 'updated_at.desc', label: 'Recently updated' },
]
const PHOTO_LABELS = { yes: 'Has photos', no: 'No photos' }
const pricingOf = (property = {}) => ({ rent_amount_bdt: property.rent_amount_bdt ?? property.pricing?.rent_amount_bdt, is_rent_negotiable: property.is_rent_negotiable ?? property.pricing?.is_rent_negotiable })
const submitterLabel = (property = {}) => property.submitted_by?.name || property.submitted_by?.email || property.submitted_by?.phone || 'Unknown user'
// Last counts that loaded, kept across reloads so a failed request still has
// something to show. Outside the `counts:` prefix that mutations clear.
const COUNTS_SNAPSHOT_KEY = `${ADMIN_CACHE_PREFIX}last:property-counts`
const approveListings = (ids) => setPropertyStatus({ ids, status: 'approved' })
const fetchDuplicateGroups = (params, options) => listDuplicatePhoneGroups({ page: params.page, pageSize: params.pageSize, status: 'pending' }, options)

const AdminPropertiesSection = () => {
  const { hasPermission } = useAdminPermissions()
  const canModerate = hasPermission(PERMISSIONS.PROPERTIES_MODERATE)
  const canFeature = hasPermission(PERMISSIONS.PROPERTIES_FEATURE)
  const canSettings = hasPermission(PERMISSIONS.SETTINGS_MANAGE)
  const toast = useToast()

  // The list view (tab, filters, search, sort, page) lives in the URL; this is
  // what the address said when the screen opened.
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialUrl] = useState(() => parseListUrlState(searchParams))
  const [tab, setTab] = useState(initialUrl.tab)
  const [phoneKey, setPhoneKey] = useState(initialUrl.phoneKey)
  const [counts, setCounts] = useState(null) // { data, failedKeys, error }
  const [countsBusy, setCountsBusy] = useState(false)
  const countsRequestRef = useRef(0)
  const lastKnownCountsRef = useRef(null)
  const failedCountKeysRef = useRef([])
  const [autoApprove, setAutoApprove] = useState({ enabled: false, fallback: false, loaded: false })
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [selectedId, setSelectedId] = useEntityParam('id')
  // The address changes a moment after a click; `dismissedId` closes the
  // details at once instead of waiting for it.
  const [dismissedId, setDismissedId] = useState(null)
  const detailsId = selectedId && selectedId !== dismissedId ? selectedId : null
  const openDetails = (propertyId) => {
    setDismissedId(null)
    setSelectedId(propertyId)
  }
  const closeDetails = () => {
    setDismissedId(selectedId)
    setSelectedId(null)
  }
  const [decision, setDecision] = useState(null) // { ids, status }
  const [removeTarget, setRemoveTarget] = useState(null)
  const [approveAll, setApproveAll] = useState(null) // { count: number|null, error, progress }
  const [autoApproveConfirm, setAutoApproveConfirm] = useState(false)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  // Side-by-side comparison of one phone group, opened over whatever is on screen.
  const [compare, setCompare] = useState(null) // { phoneKey, phoneNumber }
  const [compareVersion, setCompareVersion] = useState(0)
  const openCompare = (key, number = '') => setCompare({ phoneKey: key, phoneNumber: number })
  // Keyboard: the row J/K moved to, and the "?" help.
  const [activeId, setActiveId] = useState(null)
  const lastActiveIndexRef = useRef(0)
  const [helpOpen, setHelpOpen] = useState(false)

  // ?edit=<listing id> shows the editor in place of the list. The list keeps
  // its tab, filters, page and sort while the editor is open.
  const editId = searchParams.get('edit') || ''
  const listScrollRef = useRef(null)

  const isDuplicatesTab = tab === 'duplicates' && !phoneKey
  const list = useAdminList({
    domain: 'properties',
    fetcher: listProperties,
    initialFilters: {
      ...Object.fromEntries(Object.keys(LIST_FILTER_DEFAULTS).map((key) => [key, initialUrl[key]])),
      status: initialUrl.phoneKey || initialUrl.tab === 'duplicates' ? '' : initialUrl.tab,
    },
    initialSort: initialUrl.sort,
    initialPageSize: initialUrl.pageSize,
    initialPage: initialUrl.page,
    initialSearch: initialUrl.search,
    enabled: !isDuplicatesTab && !editId,
  })
  const groups = useAdminList({ domain: 'duplicate-groups', fetcher: fetchDuplicateGroups, enabled: isDuplicatesTab && !editId, cache: false })

  // Keep the address in step with the view, so a reload or a copied link opens
  // the same tab, filters, search, sort and page.
  const { filters: listFilters, page: listPage, pageSize: listPageSize, sort: listSort } = list
  const urlSearch = useDebouncedValue(list.search, 400)
  useEffect(() => {
    setSearchParams((current) => applyListUrlState(current, { ...listFilters, tab, phoneKey, page: listPage, pageSize: listPageSize, sort: listSort, search: urlSearch }))
  }, [setSearchParams, tab, phoneKey, listFilters, listPage, listPageSize, listSort, urlSearch])

  // A selection belongs to the rows on screen: drop it when they change.
  useEffect(() => {
    setSelectedIds((current) => (current.size ? new Set() : current))
  }, [listFilters, listPage, listPageSize, listSort, urlSearch])

  const openEditor = (propertyId) => {
    const fromList = !editId
    if (fromList) listScrollRef.current = window.scrollY
    setSearchParams(
      (current) => {
        current.delete('id')
        current.set('edit', propertyId)
        return current
      },
      { replace: !fromList }
    )
    window.scrollTo(0, 0)
  }

  const closeEditor = () => {
    setSearchParams((current) => {
      current.delete('edit')
      return current
    })
  }

  // Back on the list: return to where the admin was before opening the editor.
  useEffect(() => {
    if (editId || listScrollRef.current === null) return undefined
    const top = listScrollRef.current
    listScrollRef.current = null
    const timer = setTimeout(() => window.scrollTo(0, top), 60)
    return () => clearTimeout(timer)
  }, [editId])

  // refreshCounts() asks for every count; refreshCounts(keys) only for those.
  // A count that fails keeps its last known value, from this visit or an earlier one.
  const refreshCounts = useCallback(async (only = null) => {
    const requestId = ++countsRequestRef.current
    if (!lastKnownCountsRef.current) lastKnownCountsRef.current = readAdminSnapshot(COUNTS_SNAPSHOT_KEY)
    setCountsBusy(true)
    const result = await getPropertyCounts({ only })
    if (requestId !== countsRequestRef.current) return
    const data = mergePropertyCounts(lastKnownCountsRef.current, result.data)
    lastKnownCountsRef.current = data
    if (Object.values(data).some((value) => value !== null)) writeAdminSnapshot(COUNTS_SNAPSHOT_KEY, data)
    failedCountKeysRef.current = result.failedKeys || []
    setCounts({ data, failedKeys: result.failedKeys || [], error: result.error })
    setCountsBusy(false)
  }, [])

  // Counts that failed are fetched again once a list request succeeds; a failed
  // list request never re-runs (or clears) the counts.
  const retryCounts = Boolean(counts?.failedKeys.length) && (list.status === 'ready' || groups.status === 'ready')

  useEffect(() => {
    void refreshCounts()
  }, [refreshCounts, list.totalCount, groups.totalCount])

  useEffect(() => {
    if (retryCounts) void refreshCounts(failedCountKeysRef.current)
  }, [retryCounts, refreshCounts])

  const retryFailedCounts = () => {
    clearSupabaseConnectionFailureMark?.()
    void refreshCounts(failedCountKeysRef.current)
  }

  useEffect(() => {
    let active = true
    void getAutoApproveProperties().then((result) => {
      if (!active) return
      setAutoApprove({ enabled: Boolean(result.data?.auto_approve_properties), fallback: Boolean(result.meta?.isFallback), loaded: true })
    })
    return () => {
      active = false
    }
  }, [])

  const changeTab = (key) => {
    setTab(key)
    setPhoneKey('')
    setSelectedIds(new Set())
    list.setFilters({ status: key === 'duplicates' ? '' : key, phoneKey: '' })
  }

  const openPhoneGroup = (key) => {
    setPhoneKey(key)
    setSelectedIds(new Set())
    list.setFilters({ status: '', phoneKey: key })
  }

  const statusMutation = useAdminMutation((ids, status, reason, note) => setPropertyStatus({ ids, status, reason, note }), {
    successMessage: (result, ids, status) => `${ids.length === 1 ? 'Listing' : `${ids.length} listings`} ${status}`,
    invalidate: ['properties', 'duplicate-groups'],
    onSuccess: () => setSelectedIds(new Set()),
  })
  const approveAllMutation = useAdminMutation(
    (reason) => approveAllPending(reason, { onProgress: (done) => setApproveAll((current) => (current ? { ...current, progress: done } : current)) }),
    {
      successMessage: (result) => `${result.count ?? 0} pending listings approved`,
      errorMessage: 'Approve all pending stopped',
      invalidate: ['properties', 'duplicate-groups'],
    }
  )

  // One-click approve: the listing leaves the list at once and the approval is
  // sent when its Undo toast closes.
  const approval = useDeferredApproval({ commit: approveListings, labelOf: getPropertyDisplayLabel })
  const approveNow = (property) => {
    approval.approve(property)
    setSelectedIds((current) => {
      if (!current.has(property.id)) return current
      const next = new Set(current)
      next.delete(property.id)
      return next
    })
  }

  // The count typed to confirm is read fresh, with the same filter the action uses.
  const openApproveAll = async () => {
    setApproveAll({ count: null, error: null, progress: 0 })
    const result = await countApprovablePending()
    setApproveAll((current) => (current ? { ...current, count: result.value, error: result.error } : current))
  }
  const featuredMutation = useAdminMutation((id, featured) => setPropertyFeatured(id, featured), {
    successMessage: (result) => (result.data?.is_featured ? 'Marked as featured' : 'Removed from featured'),
    invalidate: ['properties'],
  })
  const removeMutation = useAdminMutation((id, reason) => softDeleteProperty(id, reason), { successMessage: 'Listing removed', invalidate: ['properties', 'duplicate-groups'] })

  const handleToggleAutoApprove = async () => {
    const result = await toggleAutoApproveProperties(!autoApprove.enabled)
    const enabled = Boolean(result.data?.auto_approve_properties)
    setAutoApprove({ enabled, fallback: Boolean(result.meta?.isFallback), loaded: true })
    if (result.meta?.isFallback) toast.error('Auto-approve could not be saved to the server', { description: 'The change applies to this browser only.' })
    else toast.success(enabled ? 'Auto-approve enabled' : 'Auto-approve disabled')
  }

  const pendingCount = counts?.data?.pending ?? null
  const headerActions = useMemo(
    () => (
      <>
        <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => (isDuplicatesTab ? groups.refresh() : list.refresh())} busy={list.isRefreshing || groups.isRefreshing} busyLabel="Refreshing…">
          Refresh
        </Button>
        {canModerate ? (
          <ActionMenu
            label="More actions"
            items={[
              {
                key: 'approve-all',
                label: pendingCount === null ? 'Approve all pending…' : `Approve all pending (${pendingCount})…`,
                icon: <FiCheck />,
                disabled: pendingCount === 0,
                onSelect: () => void openApproveAll(),
              },
            ]}
          />
        ) : null}
      </>
    ),
    [isDuplicatesTab, list, groups, canModerate, pendingCount]
  )
  useShellHeader({ actions: editId ? null : headerActions })

  const countUnavailable = (key) => Boolean(counts) && counts.data[key] === null
  const countIsStale = (key) => Boolean(counts) && counts.failedKeys.includes(key) && counts.data[key] !== null
  const staleHint = (key, hint = null) => (countIsStale(key) ? 'Last known value' : hint)
  // One message at a time: while the list itself shows an error, that message
  // stands for the outage and its "Try again" brings the counts back too.
  const activeList = isDuplicatesTab ? groups : list
  const listFailed = activeList.status === 'error' || activeList.status === 'permission-denied'
  const countsFailed = Boolean(counts?.failedKeys.length) && !listFailed
  const hasStaleCounts = Boolean(counts) && counts.failedKeys.some((key) => counts.data[key] !== null)

  // Listings approved here stay hidden until the list reloads them as approved.
  const visibleItems = approval.heldIds.size ? list.items.filter((property) => property.status === 'approved' || !approval.heldIds.has(property.id)) : list.items
  const selectedRow = visibleItems.find((property) => property.id === selectedId) || null
  const selectedPending = visibleItems.filter((property) => selectedIds.has(property.id) && property.status === 'pending')

  const columns = [
      {
        key: 'listing',
        header: 'Listing',
        render: (property) => {
          const label = getPropertyDisplayLabel(property) || 'Listing'
          return (
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-chip)] bg-canvas">
                {property.primary_image ? <img src={property.primary_image} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
              </div>
              <div className="min-w-[12rem] flex-1">
                <div className="mb-0.5 flex items-center gap-x-2">
                  <button type="button" className="ui-id-ticket hover:underline" aria-label={`Details of ${label}`} onClick={() => openDetails(property.id)}>
                    {label}
                  </button>
                  <StatusPill status={property.status} />
                  {property.isDuplicatePhone ? (
                    <button type="button" className="ui-badge ui-badge-danger hover:underline" onClick={() => openCompare(property.duplicatePhoneKey, property.contact_number)} aria-label={`Compare ${property.duplicateCount} listings with phone ${property.contact_number}`}>
                      Duplicate phone ×{property.duplicateCount}
                    </button>
                  ) : null}
                  {property.is_featured ? <Badge variant="promoted" icon={<FiStar />}>Featured</Badge> : null}
                  <p className="line-clamp-1 min-w-0 flex-1 break-all text-caption text-muted">
                    {[property.category, property.property_type, property.isAiSubmitted ? 'AI agent' : submitterLabel(property), formatDate(property.created_at), property.contact_number].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <p className="line-clamp-2 text-sm font-medium text-ink">{property.short_description || 'No description'}</p>
              </div>
            </div>
          )
        },
      },
      {
        key: 'area',
        header: 'Area',
        render: (property) => (
          <div className="max-w-[9rem]">
            <p className="text-ink">{property.area || <span className="text-danger">No area</span>}</p>
            <p className="line-clamp-1 text-caption text-muted">{[property.sub_area, property.state_district].filter(Boolean).join(' · ')}</p>
          </div>
        ),
      },
      {
        key: 'rooms',
        header: 'Rooms/baths',
        render: (property) => (
          <span className="whitespace-nowrap">
            {property.total_rooms ?? '—'} / {property.total_bathrooms ?? '—'}
          </span>
        ),
      },
      { key: 'floor', header: 'Floor', render: (property) => (property.floor_level ? <span className="whitespace-nowrap">{String(property.floor_level).replace(/\s*floor$/i, '')}</span> : <span className="text-muted">—</span>) },
      {
        key: 'rent_amount_bdt',
        header: 'Rent',
        sortable: true,
        align: 'right',
        render: (property) => (
          <div className="whitespace-nowrap">
            <RentDisplay pricing={pricingOf(property)} fallback="—" />
            {property.rent_amount_bdt ? <p className="text-caption text-muted">{property.rent_period || 'month'}</p> : null}
          </div>
        ),
      },
      { key: 'photos', header: 'Photos', align: 'right', render: (property) => property.photoCount ?? '—' },
      { key: 'check', header: 'Check', render: (property) => <CompletenessBadge listing={property} /> },
  ]

  // One horizontal group of icon buttons, each named after the listing it acts
  // on. Details open from the listing's ID.
  const rowActions = (property) => {
    const label = getPropertyDisplayLabel(property) || 'listing'
    return (
      <div className="flex flex-nowrap items-center justify-end gap-1">
        {canModerate && property.status === 'pending' ? (
          <>
            <Button size="sm" variant="primary" iconOnly title="Approve" aria-label={`Approve ${label}`} onClick={() => approveNow(property)}>
              <FiCheck />
            </Button>
            <Button size="sm" variant="danger-outline" iconOnly title="Reject" aria-label={`Reject ${label}`} onClick={() => setDecision({ ids: [property.id], status: 'rejected' })}>
              <FiX />
            </Button>
          </>
        ) : null}
        {canFeature && property.status === 'approved' ? (
          <Button size="sm" variant="ghost" iconOnly title={property.is_featured ? 'Remove from featured' : 'Mark as featured'} aria-label={property.is_featured ? `Remove ${label} from featured` : `Mark ${label} as featured`} aria-pressed={property.is_featured} busy={featuredMutation.busy && featuredMutation.busyKey === property.id} onClick={() => void featuredMutation.run(property.id, !property.is_featured)}>
            <FiStar />
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          title="Edit"
          aria-label={`Edit ${label}`}
          href={buildAdminEditPropertyHref(property.id)}
          onClick={(event) => {
            event.preventDefault()
            openEditor(property.id)
          }}
        >
          <FiEdit2 />
        </Button>
        {canModerate ? (
          <Button size="sm" variant="ghost" iconOnly title="Remove" aria-label={`Remove ${label}`} onClick={() => setRemoveTarget(property)}>
            <FiTrash2 />
          </Button>
        ) : null}
      </div>
    )
  }

  const groupColumns = useMemo(
    () => [
      { key: 'phone', header: 'Phone', render: (group) => <span className="font-mono text-sm text-ink">{group.contact_number}</span> },
      { key: 'pending', header: 'Pending', align: 'right', render: (group) => <Badge variant="warning">{group.pendingDuplicateCount} pending</Badge> },
      { key: 'total', header: 'Listings', align: 'right', render: (group) => group.totalPropertiesCount },
      { key: 'preview', header: 'Latest listing', render: (group) => (group.previewProperty ? <span className="line-clamp-1">{group.previewProperty.short_description || group.previewProperty.category}</span> : '—') },
      { key: 'latest', header: 'Latest', hideBelow: 'lg', render: (group) => formatDate(group.latestPendingCreatedAt) },
    ],
    []
  )

  const setFilter = list.setFilter
  const moreFilterCount = MORE_FILTER_KEYS.filter((key) => list.filters[key]).length
  const showMoreFilters = moreFiltersOpen || moreFilterCount > 0
  const chips = []
  if (phoneKey) chips.push({ key: 'phone', label: `Phone ${phoneKey}`, onRemove: () => changeTab('duplicates') })
  if (list.filters.category) chips.push({ key: 'category', label: `Category: ${list.filters.category}`, onRemove: () => setFilter('category', '') })
  if (list.filters.district) chips.push({ key: 'district', label: `District: ${list.filters.district}`, onRemove: () => setFilter('district', '') })
  if (list.filters.source) chips.push({ key: 'source', label: `Submitted by: ${SOURCE_LABELS[list.filters.source]}`, onRemove: () => setFilter('source', '') })
  if (list.filters.photos) chips.push({ key: 'photos', label: PHOTO_LABELS[list.filters.photos], onRemove: () => setFilter('photos', '') })
  if (list.filters.incomplete) chips.push({ key: 'incomplete', label: 'Incomplete only', onRemove: () => setFilter('incomplete', '') })
  if (list.filters.from) chips.push({ key: 'from', label: `From ${list.filters.from}`, onRemove: () => setFilter('from', '') })
  if (list.filters.to) chips.push({ key: 'to', label: `To ${list.filters.to}`, onRemove: () => setFilter('to', '') })
  if (list.filters.featured) chips.push({ key: 'featured', label: 'Featured only', onRemove: () => setFilter('featured', '') })
  if (list.filters.archived) chips.push({ key: 'archived', label: 'Removed listings', onRemove: () => setFilter('archived', '') })

  // "Clear all" resets every filter and the search, and keeps the status tab.
  const clearFilters = () => {
    const nextTab = tab === 'duplicates' ? 'pending' : tab
    setTab(nextTab)
    setPhoneKey('')
    list.setSearch('')
    list.setFilters({ ...LIST_FILTER_DEFAULTS, status: nextTab })
  }

  // J/K move a highlight through the rows on screen; Enter, A, R and E act on
  // the highlighted row. After a row leaves the list the highlight continues
  // from the same position.
  const activeIndex = visibleItems.findIndex((property) => property.id === activeId)
  const activeRow = activeIndex >= 0 ? visibleItems[activeIndex] : null
  useEffect(() => {
    if (activeIndex >= 0) lastActiveIndexRef.current = activeIndex
  }, [activeIndex])
  useEffect(() => {
    if (activeId) document.querySelector(`[data-row-key="${activeId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])
  const moveActive = (delta) => {
    if (visibleItems.length === 0) return
    const last = visibleItems.length - 1
    const target = activeIndex >= 0 ? activeIndex + delta : delta > 0 ? lastActiveIndexRef.current : lastActiveIndexRef.current - 1
    setActiveId(visibleItems[Math.min(Math.max(target, 0), last)].id)
  }
  const canDecide = (property) => Boolean(property) && canModerate && property.status === 'pending'
  const listKeysOn = !editId && !isDuplicatesTab
  useHotkeys([
    { combo: '?', run: () => setHelpOpen(true) },
    ...(listKeysOn
      ? [
          { combo: 'j', run: () => moveActive(1) },
          { combo: 'k', run: () => moveActive(-1) },
          { combo: 'enter', run: () => activeRow && openDetails(activeRow.id) },
          {
            combo: 'a',
            run: () => {
              if (!canDecide(activeRow)) return
              const next = visibleItems[activeIndex + 1] || visibleItems[activeIndex - 1] || null
              approveNow(activeRow)
              setActiveId(next ? next.id : null)
            },
          },
          { combo: 'r', run: () => canDecide(activeRow) && setDecision({ ids: [activeRow.id], status: 'rejected' }) },
          { combo: 'e', run: () => activeRow && openEditor(activeRow.id) },
        ]
      : []),
  ])
  const helpDialog = <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

  const compareDialog = (
    <DuplicateCompare
      phoneKey={compare?.phoneKey || ''}
      phoneNumber={compare?.phoneNumber || ''}
      heldIds={approval.heldIds}
      canModerate={canModerate}
      onClose={() => setCompare(null)}
      onEdit={(propertyId) => {
        setCompare(null)
        openEditor(propertyId)
      }}
      onViewList={
        editId
          ? undefined
          : () => {
              const key = compare?.phoneKey
              setCompare(null)
              if (key) openPhoneGroup(key)
            }
      }
      onChanged={() => setCompareVersion((version) => version + 1)}
    />
  )

  if (editId) {
    return (
      <>
        <AdminPropertyEditor
          propertyId={editId}
          listContext={{ sort: list.sort, filters: list.filters, search: list.search }}
          heldIds={approval.heldIds}
          refreshToken={compareVersion}
          onClose={closeEditor}
          onOpen={openEditor}
          approveNow={approveNow}
          onCompare={openCompare}
        />
        {compareDialog}
        {helpDialog}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {autoApprove.loaded ? (
        <InlineAlert
          variant={autoApprove.enabled ? 'warning' : 'info'}
          title={autoApprove.enabled ? 'Auto-approve is on' : 'Manual review is on'}
          action={canSettings ? { label: autoApprove.enabled ? 'Turn off auto-approve' : 'Turn on auto-approve', onClick: () => setAutoApproveConfirm(true) } : null}
        >
          {autoApprove.enabled ? 'New listings publish immediately without review.' : 'Every new listing waits here until an admin approves it.'}
          {autoApprove.fallback ? ' This setting is currently stored only in this browser.' : ''}
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label={PROPERTY_COUNT_LABELS.total} value={counts?.data?.total} loading={!counts} error={countUnavailable('total')} hint={staleHint('total')} />
        <StatCard label={PROPERTY_COUNT_LABELS.approved} value={counts?.data?.approved} loading={!counts} error={countUnavailable('approved')} hint={staleHint('approved')} />
        <StatCard label={PROPERTY_COUNT_LABELS.pending} value={counts?.data?.pending} loading={!counts} error={countUnavailable('pending')} hint={staleHint('pending')} tone={counts?.data?.pending > 0 ? 'warning' : 'neutral'} onClick={() => changeTab('pending')} />
        <StatCard label={PROPERTY_COUNT_LABELS.rejected} value={counts?.data?.rejected} loading={!counts} error={countUnavailable('rejected')} hint={staleHint('rejected')} />
        <StatCard label={PROPERTY_COUNT_LABELS.duplicatePending} value={counts?.data?.duplicatePending} loading={!counts} error={countUnavailable('duplicatePending')} tone={counts?.data?.duplicatePending > 0 ? 'danger' : 'neutral'} hint={staleHint('duplicatePending', 'Pending listings sharing a phone')} onClick={() => changeTab('duplicates')} />
      </div>

      {countsFailed ? (
        <InlineAlert
          variant="warning"
          title={`Couldn't refresh ${describeFailedCounts(counts.failedKeys)}`}
          action={counts.error?.retryable === false || counts.error?.permissionDenied ? null : { label: 'Try again', onClick: retryFailedCounts, busy: countsBusy }}
        >
          {counts.error?.message || 'The request failed.'}
          {hasStaleCounts ? ' The cards show the last known values.' : ''}
        </InlineAlert>
      ) : null}

      <Tabs tabs={TABS} value={phoneKey ? '' : tab} onChange={changeTab} ariaLabel="Listing status" idBase="properties-tabs" />

      <div {...tabPanelProps('properties-tabs', phoneKey ? '' : tab)} className="space-y-4">
      {isDuplicatesTab ? (
        <>
          <DataTable
            caption="Pending listings grouped by phone number"
            columns={groupColumns}
            rows={groups.items}
            rowKey="id"
            loading={groups.isLoading}
            error={groups.status === 'error' || groups.status === 'permission-denied' ? groups.error : null}
            onRetry={groups.retry}
            empty={<EmptyState title="No duplicate phone numbers" description="No pending listings share a contact number right now." />}
            rowActions={(group) => (
              <>
                <Button size="sm" variant="primary" aria-label={`Compare listings with phone ${group.contact_number}`} onClick={() => openCompare(group.duplicatePhoneKey, group.contact_number)}>
                  Compare
                </Button>
                <Button size="sm" variant="secondary" aria-label={`View listings with phone ${group.contact_number} in the list`} onClick={() => openPhoneGroup(group.duplicatePhoneKey)}>
                  View listings
                </Button>
              </>
            )}
            getRowLabel={(group) => `phone ${group.contact_number}`}
          />
          <Pagination page={groups.page} pageSize={groups.pageSize} total={groups.totalCount} onPageChange={groups.setPage} onPageSizeChange={groups.setPageSize} />
        </>
      ) : (
        <>
          <FilterBar
            search={{ value: list.search, onChange: list.setSearch, label: 'Search listings', placeholder: 'Listing ID, title, area, category or phone…' }}
            filters={[
              { key: 'category', label: 'Category', type: 'select', value: list.filters.category, onChange: (value) => setFilter('category', value), options: CATEGORY_OPTIONS, placeholder: 'Any' },
              { key: 'source', label: 'Submitted by', type: 'select', value: list.filters.source, onChange: (value) => setFilter('source', value), options: [{ value: 'ai', label: SOURCE_LABELS.ai }, { value: 'users', label: SOURCE_LABELS.users }], placeholder: 'Anyone' },
              { key: 'incomplete', label: 'Completeness', type: 'select', value: list.filters.incomplete, onChange: (value) => setFilter('incomplete', value), options: [{ value: '1', label: 'Incomplete only' }], placeholder: 'Any' },
              {
                key: 'sort',
                label: 'Sort by',
                type: 'select',
                value: `${list.sort.column}.${list.sort.dir}`,
                onChange: (value) => {
                  const [column, dir] = value.split('.')
                  list.setSort({ column, dir })
                },
                options: SORT_OPTIONS.some((option) => option.value === `${list.sort.column}.${list.sort.dir}`) ? SORT_OPTIONS : [...SORT_OPTIONS, { value: `${list.sort.column}.${list.sort.dir}`, label: 'Custom' }],
              },
              ...(showMoreFilters
                ? [
                    { key: 'district', label: 'District', type: 'select', value: list.filters.district, onChange: (value) => setFilter('district', value), options: DISTRICT_OPTIONS, placeholder: 'Any' },
                    { key: 'photos', label: 'Photos', type: 'select', value: list.filters.photos, onChange: (value) => setFilter('photos', value), options: [{ value: 'yes', label: PHOTO_LABELS.yes }, { value: 'no', label: PHOTO_LABELS.no }], placeholder: 'Any' },
                    { key: 'from', label: 'Submitted from', type: 'date', value: list.filters.from, onChange: (value) => setFilter('from', value) },
                    { key: 'to', label: 'Submitted to', type: 'date', value: list.filters.to, onChange: (value) => setFilter('to', value) },
                    { key: 'featured', label: 'Featured', type: 'select', value: list.filters.featured, onChange: (value) => setFilter('featured', value), options: [{ value: 'true', label: 'Featured only' }], placeholder: 'Any' },
                    { key: 'archived', label: 'Show', type: 'select', value: list.filters.archived, onChange: (value) => setFilter('archived', value), options: [{ value: 'archived', label: 'Removed only' }], placeholder: 'Active listings' },
                  ]
                : []),
            ]}
            footerActions={
              <>
                <Button variant="ghost" size="sm" aria-expanded={showMoreFilters} disabled={moreFilterCount > 0} onClick={() => setMoreFiltersOpen((open) => !open)}>
                  {showMoreFilters ? 'Fewer filters' : 'More filters'}
                </Button>
                <Button variant="ghost" size="sm" aria-keyshortcuts="?" aria-haspopup="dialog" onClick={() => setHelpOpen(true)}>
                  Keyboard shortcuts
                </Button>
              </>
            }
            chips={chips}
            onClearAll={clearFilters}
            resultCount={list.status === 'loading' ? null : list.totalCount}
            resultLabel="listings"
          />

          {canModerate && selectedPending.length > 0 ? (
            <div role="toolbar" aria-label="Bulk actions" className="ui-card sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-between gap-3 p-3 md:static">
              <p className="text-sm font-medium text-ink">{selectedPending.length} pending selected</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" icon={<FiCheck />} onClick={() => setDecision({ ids: selectedPending.map((p) => p.id), status: 'approved' })}>
                  Approve selected
                </Button>
                <Button size="sm" variant="danger-outline" icon={<FiX />} onClick={() => setDecision({ ids: selectedPending.map((p) => p.id), status: 'rejected' })}>
                  Reject selected
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          <DataTable
            caption="Property listings"
            columns={columns}
            rows={visibleItems}
            density="dense"
            stickyActions
            activeKey={activeId}
            loading={list.isLoading}
            error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
            onRetry={list.retry}
            empty={<EmptyState title="No listings match" description={tab === 'pending' ? 'Nothing is waiting for review.' : 'Try another tab or clear the search.'} />}
            rowActions={rowActions}
            selectable={canModerate}
            selectedKeys={selectedIds}
            onSelectionChange={setSelectedIds}
            getRowLabel={(property) => getPropertyDisplayLabel(property) || property.short_description}
            sort={{ key: list.sort.column, direction: list.sort.dir }}
            onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
          />
          <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
        </>
      )}
      </div>

      {compareDialog}
      {helpDialog}

      <PropertyDetailsDialog
        propertyId={detailsId}
        fallback={selectedRow}
        heldIds={approval.heldIds}
        canModerate={canModerate}
        canFeature={canFeature}
        featuredBusy={featuredMutation.busy}
        onClose={closeDetails}
        onApprove={(listing) => {
          approveNow(listing)
          closeDetails()
        }}
        onReject={(listing) => setDecision({ ids: [listing.id], status: 'rejected' })}
        onEdit={openEditor}
        onRemove={setRemoveTarget}
        onToggleFeatured={(listing) => void featuredMutation.run(listing.id, !listing.is_featured)}
      />

      <ReasonDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        decision={decision?.status === 'approved' ? 'approve' : 'reject'}
        title={decision?.status === 'approved' ? `Approve ${decision.ids.length === 1 ? 'this listing' : `${decision.ids.length} listings`}?` : `Reject ${decision?.ids.length === 1 ? 'this listing' : `${decision?.ids.length} listings`}?`}
        description={decision?.status === 'approved' ? 'Approved listings are visible to everyone immediately.' : 'The owner sees the listing as rejected with your reason. It stays hidden from the public site.'}
        reasonRequired={decision?.status === 'rejected'}
        reasonHelp="Shown to the listing owner."
        reasonOptions={decision?.status === 'rejected' ? REJECT_REASONS : null}
        busy={statusMutation.busy}
        error={statusMutation.error}
        onConfirm={async ({ reason, note }) => {
          const { ids, status } = decision
          const result = await statusMutation.run(ids, status, reason, note)
          if (!result.error) {
            setDecision(null)
            closeDetails()
          }
        }}
      />

      <ReasonDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        decision="reject"
        title="Remove this listing?"
        description="The listing is hidden everywhere and marked as removed. It is not deleted and can be audited later."
        subject={removeTarget ? <p>{removeTarget.short_description || getPropertyDisplayLabel(removeTarget)}</p> : null}
        reasonLabel="Reason for removal"
        reasonHelp="Recorded in the audit log."
        confirmLabel="Remove listing"
        showNote={false}
        busy={removeMutation.busy}
        error={removeMutation.error}
        onConfirm={async ({ reason }) => {
          const target = removeTarget
          const result = await removeMutation.run(target.id, reason)
          if (!result.error) {
            setRemoveTarget(null)
            closeDetails()
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(approveAll)}
        onCancel={() => setApproveAll(null)}
        onConfirm={async () => {
          if (!approveAll?.count) return
          approval.flush()
          await approveAllMutation.run('Bulk approval of the pending queue')
          setApproveAll(null)
        }}
        title={approveAll?.count ? `Approve all ${approveAll.count} pending listings?` : 'Approve all pending listings?'}
        description={
          approveAll?.error
            ? `The pending count could not be read, so nothing can be approved. ${approveAll.error.message}`
            : approveAll?.count === null
              ? 'Counting the pending listings…'
              : approveAll?.count === 0
                ? 'There are no pending listings to approve.'
                : 'Every pending listing becomes public immediately, without review, and this cannot be undone. Each approval is recorded in the audit log.'
        }
        confirmText={approveAll?.count ? String(approveAll.count) : null}
        confirmTextLabel={approveAll?.count ? `Type ${approveAll.count} to confirm` : null}
        confirmLabel={approveAll?.count ? `Approve ${approveAll.count} listings` : 'Approve all'}
        tone="danger"
        busy={approveAllMutation.busy}
        busyLabel={approveAll?.progress ? `Approved ${approveAll.progress} of ${approveAll.count}…` : 'Approving…'}
      />

      <ConfirmDialog
        open={autoApproveConfirm}
        onCancel={() => setAutoApproveConfirm(false)}
        onConfirm={async () => {
          setAutoApproveConfirm(false)
          await handleToggleAutoApprove()
        }}
        title={autoApprove.enabled ? 'Turn off auto-approve?' : 'Turn on auto-approve?'}
        description={autoApprove.enabled ? 'New listings will wait for manual review again.' : 'New listings will publish immediately without any review. Use with care.'}
        confirmLabel={autoApprove.enabled ? 'Turn off' : 'Turn on'}
        tone={autoApprove.enabled ? 'primary' : 'danger'}
      />
    </div>
  )
}

export default AdminPropertiesSection
