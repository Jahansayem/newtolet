'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiCheck, FiEdit2, FiRefreshCw, FiStar, FiTrash2, FiX } from 'react-icons/fi'
import {
  approveAllPending,
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
import { buildEditPropertyHref, buildPageHref } from '../../../lib/routePaths'
import { getPropertyDisplayLabel } from '../../../utils/propertyDisplaySerial'
import { useAdminPermissions } from '../../../contexts/AdminAccessContext'
import { PERMISSIONS } from '../../../lib/adminPermissions'
import { PropertyThumbnailImage } from '../../PropertyCardMedia'
import RentDisplay from '../../RentDisplay'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import { useEntityParam } from '../hooks/useEntityParam'
import { useToast } from '../../ui/ToastProvider'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmDialog from '../../ui/ConfirmDialog'
import DataTable from '../../ui/DataTable'
import Dialog from '../../ui/Dialog'
import EmptyState from '../../ui/EmptyState'
import FilterBar from '../../ui/FilterBar'
import InlineAlert from '../../ui/InlineAlert'
import KeyValueList from '../../ui/KeyValueList'
import Pagination from '../../ui/Pagination'
import ReasonDialog from '../../ui/ReasonDialog'
import StatCard from '../../ui/StatCard'
import StatusPill from '../../ui/StatusPill'
import Tabs from '../../ui/Tabs'

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
  { key: 'duplicates', label: 'Duplicates' },
]

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const editHref = (propertyId) => buildEditPropertyHref(propertyId, { admin: '1', returnTo: buildPageHref('admin', { tab: 'properties' }) })
const pricingOf = (property = {}) => ({ rent_amount_bdt: property.rent_amount_bdt ?? property.pricing?.rent_amount_bdt, is_rent_negotiable: property.is_rent_negotiable ?? property.pricing?.is_rent_negotiable })
const submitterLabel = (property = {}) => property.submitted_by?.name || property.submitted_by?.email || property.submitted_by?.phone || 'Unknown user'
// Last counts that loaded, kept across reloads so a failed request still has
// something to show. Outside the `counts:` prefix that mutations clear.
const COUNTS_SNAPSHOT_KEY = `${ADMIN_CACHE_PREFIX}last:property-counts`
const fetchDuplicateGroups = (params, options) => listDuplicatePhoneGroups({ page: params.page, pageSize: params.pageSize, status: 'pending' }, options)

const AdminPropertiesSection = () => {
  const { hasPermission } = useAdminPermissions()
  const canModerate = hasPermission(PERMISSIONS.PROPERTIES_MODERATE)
  const canFeature = hasPermission(PERMISSIONS.PROPERTIES_FEATURE)
  const canSettings = hasPermission(PERMISSIONS.SETTINGS_MANAGE)
  const toast = useToast()

  const [tab, setTab] = useState('pending')
  const [phoneKey, setPhoneKey] = useState('')
  const [counts, setCounts] = useState(null) // { data, failedKeys, error }
  const [countsBusy, setCountsBusy] = useState(false)
  const countsRequestRef = useRef(0)
  const lastKnownCountsRef = useRef(null)
  const failedCountKeysRef = useRef([])
  const [autoApprove, setAutoApprove] = useState({ enabled: false, fallback: false, loaded: false })
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [selectedId, setSelectedId] = useEntityParam('id')
  const [decision, setDecision] = useState(null) // { ids, status }
  const [removeTarget, setRemoveTarget] = useState(null)
  const [approveAllOpen, setApproveAllOpen] = useState(false)
  const [autoApproveConfirm, setAutoApproveConfirm] = useState(false)

  const isDuplicatesTab = tab === 'duplicates' && !phoneKey
  const list = useAdminList({
    domain: 'properties',
    fetcher: listProperties,
    initialFilters: { status: 'pending', featured: '', archived: '', phoneKey: '' },
    enabled: !isDuplicatesTab,
  })
  const groups = useAdminList({ domain: 'duplicate-groups', fetcher: fetchDuplicateGroups, enabled: isDuplicatesTab, cache: false })

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
  const approveAllMutation = useAdminMutation((reason) => approveAllPending(reason), {
    successMessage: (result) => `${result.count ?? 0} pending listings approved`,
    invalidate: ['properties', 'duplicate-groups'],
  })
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

  const headerActions = useMemo(
    () => (
      <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => (isDuplicatesTab ? groups.refresh() : list.refresh())} busy={list.isRefreshing || groups.isRefreshing} busyLabel="Refreshing…">
        Refresh
      </Button>
    ),
    [isDuplicatesTab, list, groups]
  )
  useShellHeader({ actions: headerActions })

  const countUnavailable = (key) => Boolean(counts) && counts.data[key] === null
  const countIsStale = (key) => Boolean(counts) && counts.failedKeys.includes(key) && counts.data[key] !== null
  const staleHint = (key, hint = null) => (countIsStale(key) ? 'Last known value' : hint)
  // One message at a time: while the list itself shows an error, that message
  // stands for the outage and its "Try again" brings the counts back too.
  const activeList = isDuplicatesTab ? groups : list
  const listFailed = activeList.status === 'error' || activeList.status === 'permission-denied'
  const countsFailed = Boolean(counts?.failedKeys.length) && !listFailed
  const hasStaleCounts = Boolean(counts) && counts.failedKeys.some((key) => counts.data[key] !== null)

  const selected = list.items.find((property) => property.id === selectedId) || null
  const selectedPending = list.items.filter((property) => selectedIds.has(property.id) && property.status === 'pending')

  const columns = useMemo(
    () => [
      {
        key: 'listing',
        header: 'Listing',
        render: (property) => (
          <div className="flex items-start gap-3">
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-chip)] bg-canvas">
              <PropertyThumbnailImage src={property.primary_image} alt="" propertyType={property.property_type} category={property.category} pricing={pricingOf(property)} />
            </div>
            <div className="min-w-0">
              <p className="ui-id-ticket mb-1">{getPropertyDisplayLabel(property)}</p>
              <p className="line-clamp-1 font-medium text-ink">{property.short_description || property.category || 'Untitled listing'}</p>
              <p className="text-caption text-muted">{[property.category, property.area, property.state_district].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'submitter',
        header: 'Submitted by',
        hideBelow: 'lg',
        render: (property) => (
          <div className="min-w-0">
            <p className="font-medium text-ink">{submitterLabel(property)}</p>
            <p className="truncate text-caption text-muted">{property.contact_number || property.submitted_by?.phone || '—'}</p>
          </div>
        ),
      },
      { key: 'rent_amount_bdt', header: 'Rent', sortable: true, align: 'right', render: (property) => <RentDisplay pricing={pricingOf(property)} fallback="—" suffix={property.rent_amount_bdt ? `/${property.rent_period || 'month'}` : ''} /> },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (property) => (
          <div className="flex flex-wrap gap-1">
            <StatusPill status={property.status} />
            {property.isDuplicatePhone ? (
              <button type="button" className="ui-badge ui-badge-danger hover:underline" onClick={() => openPhoneGroup(property.duplicatePhoneKey)} aria-label={`Show ${property.duplicateCount} listings with phone ${property.contact_number}`}>
                Duplicate phone ×{property.duplicateCount}
              </button>
            ) : null}
            {property.is_featured ? <Badge variant="promoted" icon={<FiStar />}>Featured</Badge> : null}
          </div>
        ),
      },
      { key: 'reviewed_at', header: 'Reviewed', hideBelow: 'lg', render: (property) => (property.reviewed_at ? formatDate(property.reviewed_at) : <span className="text-muted">—</span>) },
      { key: 'created_at', header: 'Submitted', sortable: true, hideBelow: 'lg', render: (property) => formatDate(property.created_at) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const rowActions = (property) => (
    <>
      <Button size="sm" variant="secondary" onClick={() => setSelectedId(property.id)}>
        Details
      </Button>
      {canModerate && property.status === 'pending' ? (
        <>
          <Button size="sm" variant="primary" icon={<FiCheck />} onClick={() => setDecision({ ids: [property.id], status: 'approved' })}>
            Approve
          </Button>
          <Button size="sm" variant="danger-outline" icon={<FiX />} onClick={() => setDecision({ ids: [property.id], status: 'rejected' })}>
            Reject
          </Button>
        </>
      ) : null}
      {canFeature && property.status === 'approved' ? (
        <Button size="sm" variant="ghost" iconOnly aria-label={property.is_featured ? 'Remove from featured' : 'Mark as featured'} aria-pressed={property.is_featured} busy={featuredMutation.busy && featuredMutation.busyKey === property.id} onClick={() => void featuredMutation.run(property.id, !property.is_featured)}>
          <FiStar />
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" iconOnly aria-label="Edit listing" href={editHref(property.id)}>
        <FiEdit2 />
      </Button>
      {canModerate ? (
        <Button size="sm" variant="ghost" iconOnly aria-label="Remove listing" onClick={() => setRemoveTarget(property)}>
          <FiTrash2 />
        </Button>
      ) : null}
    </>
  )

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

  const chips = []
  if (phoneKey) chips.push({ key: 'phone', label: `Phone ${phoneKey}`, onRemove: () => changeTab('duplicates') })
  if (list.filters.featured) chips.push({ key: 'featured', label: 'Featured only', onRemove: () => list.setFilter('featured', '') })
  if (list.filters.archived) chips.push({ key: 'archived', label: 'Removed listings', onRemove: () => list.setFilter('archived', '') })

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

      <Tabs tabs={TABS} value={phoneKey ? '' : tab} onChange={changeTab} ariaLabel="Listing status" />

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
              <Button size="sm" variant="secondary" onClick={() => openPhoneGroup(group.duplicatePhoneKey)}>
                View listings
              </Button>
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
              { key: 'featured', label: 'Featured', type: 'select', value: list.filters.featured, onChange: (value) => list.setFilter('featured', value), options: [{ value: 'true', label: 'Featured only' }], placeholder: 'Any' },
              { key: 'archived', label: 'Show', type: 'select', value: list.filters.archived, onChange: (value) => list.setFilter('archived', value), options: [{ value: 'archived', label: 'Removed only' }], placeholder: 'Active listings' },
            ]}
            chips={chips}
            onClearAll={() => changeTab(tab === 'duplicates' ? 'pending' : tab)}
            actions={
              canModerate && (tab === 'pending' || !tab) && (counts?.data?.pending ?? 0) > 0 ? (
                <Button variant="secondary" onClick={() => setApproveAllOpen(true)}>
                  Approve all pending ({counts?.data?.pending})
                </Button>
              ) : null
            }
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
            rows={list.items}
            loading={list.isLoading}
            error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
            onRetry={list.retry}
            empty={<EmptyState title="No listings match" description={tab === 'pending' ? 'Nothing is waiting for review.' : 'Try another tab or clear the search.'} />}
            rowActions={rowActions}
            selectable={canModerate}
            selectedKeys={selectedIds}
            onSelectionChange={setSelectedIds}
            getRowLabel={(property) => property.short_description || getPropertyDisplayLabel(property)}
            sort={{ key: list.sort.column, direction: list.sort.dir }}
            onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
          />
          <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
        </>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected?.short_description || selected?.category || 'Listing'} description={selected ? `${getPropertyDisplayLabel(selected)} · ${[selected.category, selected.area, selected.state_district].filter(Boolean).join(', ')}` : null} size="xl" fullScreenOnMobile>
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selected.status} />
              {selected.is_featured ? <Badge variant="promoted">Featured</Badge> : null}
              {selected.isDuplicatePhone ? <Badge variant="danger">Duplicate phone ×{selected.duplicateCount}</Badge> : null}
              {selected.deleted_at ? <Badge variant="neutral">Removed</Badge> : null}
            </div>
            {selected.images?.length ? (
              <div className="flex gap-2 overflow-x-auto">
                {selected.images.slice(0, 6).map((src, index) => (
                  <img key={src} src={src} alt={`Listing photo ${index + 1}`} className="h-32 w-44 shrink-0 rounded-[var(--radius-card)] object-cover" loading="lazy" />
                ))}
              </div>
            ) : null}
            <KeyValueList
              columns={2}
              items={[
                { key: 'rent', label: 'Rent', value: selected.rent_amount_bdt ? `৳${Number(selected.rent_amount_bdt).toLocaleString()} / ${selected.rent_period || 'month'}` : selected.is_rent_negotiable ? 'Negotiable' : null },
                { key: 'type', label: 'Type', value: selected.property_type },
                { key: 'rooms', label: 'Rooms', value: selected.total_rooms },
                { key: 'baths', label: 'Bathrooms', value: selected.total_bathrooms },
                { key: 'contact', label: 'Contact number', value: selected.contact_number },
                { key: 'submitter', label: 'Submitted by', value: submitterLabel(selected) },
                { key: 'submitterEmail', label: 'Submitter email', value: selected.submitted_by?.email },
                { key: 'submitted', label: 'Submitted', value: formatDateTime(selected.created_at) },
                { key: 'reviewed', label: 'Reviewed', value: selected.reviewed_at ? formatDateTime(selected.reviewed_at) : null },
                { key: 'reason', label: 'Moderation reason', value: selected.moderation_reason },
                { key: 'note', label: 'Internal note', value: selected.internal_note },
              ]}
            />
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button variant="secondary" icon={<FiEdit2 />} href={editHref(selected.id)}>
                Edit listing
              </Button>
              {canModerate && selected.status === 'pending' ? (
                <>
                  <Button variant="primary" icon={<FiCheck />} onClick={() => setDecision({ ids: [selected.id], status: 'approved' })}>
                    Approve
                  </Button>
                  <Button variant="danger-outline" icon={<FiX />} onClick={() => setDecision({ ids: [selected.id], status: 'rejected' })}>
                    Reject
                  </Button>
                </>
              ) : null}
              {canModerate && selected.status === 'approved' ? (
                <Button variant="danger-outline" icon={<FiX />} onClick={() => setDecision({ ids: [selected.id], status: 'rejected' })}>
                  Reject
                </Button>
              ) : null}
              {canModerate && selected.status === 'rejected' ? (
                <Button variant="primary" icon={<FiCheck />} onClick={() => setDecision({ ids: [selected.id], status: 'approved' })}>
                  Approve
                </Button>
              ) : null}
              {canFeature && selected.status === 'approved' ? (
                <Button variant="secondary" icon={<FiStar />} busy={featuredMutation.busy} onClick={() => void featuredMutation.run(selected.id, !selected.is_featured)}>
                  {selected.is_featured ? 'Remove from featured' : 'Mark as featured'}
                </Button>
              ) : null}
              {canModerate && !selected.deleted_at ? (
                <Button variant="danger-outline" icon={<FiTrash2 />} onClick={() => setRemoveTarget(selected)}>
                  Remove listing
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>

      <ReasonDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        decision={decision?.status === 'approved' ? 'approve' : 'reject'}
        title={decision?.status === 'approved' ? `Approve ${decision.ids.length === 1 ? 'this listing' : `${decision.ids.length} listings`}?` : `Reject ${decision?.ids.length === 1 ? 'this listing' : `${decision?.ids.length} listings`}?`}
        description={decision?.status === 'approved' ? 'Approved listings are visible to everyone immediately.' : 'The owner sees the listing as rejected with your reason. It stays hidden from the public site.'}
        reasonRequired={decision?.status === 'rejected'}
        reasonHelp="Shown to the listing owner."
        busy={statusMutation.busy}
        error={statusMutation.error}
        onConfirm={async ({ reason, note }) => {
          const { ids, status } = decision
          const result = await statusMutation.run(ids, status, reason, note)
          if (!result.error) {
            setDecision(null)
            setSelectedId(null)
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
            setSelectedId(null)
          }
        }}
      />

      <ConfirmDialog
        open={approveAllOpen}
        onCancel={() => setApproveAllOpen(false)}
        onConfirm={async () => {
          setApproveAllOpen(false)
          await approveAllMutation.run('Bulk approval of the pending queue')
        }}
        title={`Approve all ${counts?.data?.pending ?? 0} pending listings?`}
        description="Every pending listing becomes public immediately. Each approval is recorded in the audit log."
        confirmLabel="Approve all"
        tone="primary"
        busy={approveAllMutation.busy}
        busyLabel="Approving…"
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
