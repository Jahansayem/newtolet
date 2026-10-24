'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { FiArchive, FiEdit2, FiRefreshCw } from 'react-icons/fi'
import { listOrders, setOrderJobFeed, setOrderStatus, archiveOrder } from '../../../services/admin/orders'
import { formatOrderNeedFrom, formatOrderPreferencesSummary } from '../../../utils/orderPreferences'
import { getStatusOptions } from '../../../lib/adminStatusTransitions'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import { useEntityParam } from '../hooks/useEntityParam'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmDialog from '../../ui/ConfirmDialog'
import DataTable from '../../ui/DataTable'
import Dialog from '../../ui/Dialog'
import EmptyState from '../../ui/EmptyState'
import FilterBar from '../../ui/FilterBar'
import FormDialog from '../../ui/FormDialog'
import KeyValueList from '../../ui/KeyValueList'
import Pagination from '../../ui/Pagination'
import StatusPill from '../../ui/StatusPill'

const formatLocation = (order) => [order?.sub_area, order?.area, order?.district, order?.division].filter(Boolean).join(', ')

const fallbackTitle = (order) => {
  const location = formatLocation(order)
  return location ? `${order?.category || 'Home'} needed in ${location}` : `${order?.category || 'Home'} requirement posted`
}

const fallbackDescription = (order) => {
  const summary = formatOrderPreferencesSummary(order?.additional_preferences)
  if (summary) return summary
  const parts = []
  if (order?.rooms) parts.push(`${order.rooms} room requirement`)
  if (order?.max_budget) parts.push(`Budget up to BDT ${Number(order.max_budget).toLocaleString()}`)
  if (order?.property_need_from) parts.push(`Need from ${formatOrderNeedFrom(order.property_need_from)}`)
  return parts.join(' | ') || 'No public description added yet.'
}

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

const STATUS_FILTER_OPTIONS = [
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const AdminOrdersSection = () => {
  const list = useAdminList({ domain: 'orders', fetcher: listOrders, initialFilters: { status: '', jobFeed: '', archived: '' } })
  const [selectedId, setSelectedId] = useEntityParam('id')
  const [jobFeedOrder, setJobFeedOrder] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [pendingStatus, setPendingStatus] = useState(null) // { order, status }

  const statusMutation = useAdminMutation((id, status) => setOrderStatus(id, status), { successMessage: 'Order status updated', invalidate: ['orders'] })
  const jobFeedMutation = useAdminMutation((id, payload) => setOrderJobFeed(id, payload), { successMessage: (result) => (result.data?.is_job_feed_posted ? 'Job published to the homepage' : 'Job feed updated'), invalidate: ['orders'] })
  const archiveMutation = useAdminMutation((id, reason) => archiveOrder(id, reason), { successMessage: 'Order archived', invalidate: ['orders'] })

  const refreshAction = useMemo(
    () => (
      <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => list.refresh()} busy={list.isRefreshing} busyLabel="Refreshing…">
        Refresh
      </Button>
    ),
    [list]
  )
  useShellHeader({ actions: refreshAction })

  const selected = list.items.find((order) => order.id === selectedId) || null

  const requestStatusChange = useCallback(
    (order, status) => {
      if (status === order.status) return
      if (status === 'cancelled' || status === 'completed') {
        setPendingStatus({ order, status })
        return
      }
      void statusMutation.run(order.id, status)
    },
    [statusMutation]
  )

  const columns = useMemo(
    () => [
      {
        key: 'customer',
        header: 'Customer',
        render: (order) => (
          <div className="min-w-0">
            <p className="font-medium text-ink">{order.customer?.name || 'Unknown'}</p>
            <p className="text-caption text-muted">
              {order.customer?.phone ? <a className="hover:underline" href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> : null}
              {order.customer?.phone && order.customer?.email ? ' · ' : ''}
              {order.customer?.email ? <a className="hover:underline" href={`mailto:${order.customer.email}`}>{order.customer.email}</a> : null}
            </p>
          </div>
        ),
      },
      {
        key: 'need',
        header: 'Need',
        render: (order) => (
          <div className="min-w-0">
            <p className="font-medium text-ink">{order.category || 'Order'}</p>
            <p className="text-caption text-muted">{formatLocation(order) || 'Location not provided'}</p>
          </div>
        ),
      },
      { key: 'max_budget', header: 'Budget', sortable: true, align: 'right', render: (order) => (order.max_budget ? `৳${Number(order.max_budget).toLocaleString()}` : '—') },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (order) => (
          <label className="block">
            <span className="sr-only">Status for order {order.id}</span>
            <select
              className="ui-field h-10 min-h-0 py-1 text-sm"
              value={order.status || 'pending_payment'}
              disabled={statusMutation.busy && statusMutation.busyKey === order.id}
              onChange={(event) => requestStatusChange(order, event.target.value)}
            >
              {getStatusOptions('order', order.status || 'pending_payment').map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ),
      },
      {
        key: 'job_feed',
        header: 'Job feed',
        hideBelow: 'lg',
        render: (order) => (order.is_job_feed_posted ? <Badge variant="success">Published</Badge> : <Badge variant="neutral">Not published</Badge>),
      },
      { key: 'created_at', header: 'Created', sortable: true, hideBelow: 'lg', render: (order) => formatDate(order.created_at) },
    ],
    [requestStatusChange, statusMutation.busy, statusMutation.busyKey]
  )

  const rowActions = (order) => (
    <>
      <Button size="sm" variant="secondary" onClick={() => setSelectedId(order.id)}>
        Details
      </Button>
      <Button size="sm" variant="ghost" icon={<FiEdit2 />} onClick={() => setJobFeedOrder(order)}>
        Job feed
      </Button>
      <Button size="sm" variant="ghost" iconOnly aria-label={`Archive order from ${order.customer?.name || 'customer'}`} onClick={() => setArchiveTarget(order)}>
        <FiArchive />
      </Button>
    </>
  )

  const chips = []
  if (list.filters.status) chips.push({ key: 'status', label: `Status: ${STATUS_FILTER_OPTIONS.find((o) => o.value === list.filters.status)?.label || list.filters.status}`, onRemove: () => list.setFilter('status', '') })
  if (list.filters.jobFeed) chips.push({ key: 'jobFeed', label: list.filters.jobFeed === 'posted' ? 'Published to job feed' : 'Not published', onRemove: () => list.setFilter('jobFeed', '') })
  if (list.filters.archived) chips.push({ key: 'archived', label: 'Archived orders', onRemove: () => list.setFilter('archived', '') })

  return (
    <div className="space-y-4">
      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search orders', placeholder: 'Category, area, district…' }}
        filters={[
          { key: 'status', label: 'Status', type: 'select', value: list.filters.status, onChange: (value) => list.setFilter('status', value), options: STATUS_FILTER_OPTIONS, placeholder: 'All statuses' },
          { key: 'jobFeed', label: 'Job feed', type: 'select', value: list.filters.jobFeed, onChange: (value) => list.setFilter('jobFeed', value), options: [{ value: 'posted', label: 'Published' }, { value: 'unposted', label: 'Not published' }], placeholder: 'Any' },
          { key: 'archived', label: 'Show', type: 'select', value: list.filters.archived, onChange: (value) => list.setFilter('archived', value), options: [{ value: 'archived', label: 'Archived only' }], placeholder: 'Active orders' },
        ]}
        chips={chips}
        onClearAll={list.resetFilters}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="orders"
      />

      <DataTable
        caption="Rental orders"
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
        onRetry={list.retry}
        empty={<EmptyState title="No orders match" description="Try clearing the filters or search." />}
        rowActions={rowActions}
        sort={{ key: list.sort.column, direction: list.sort.dir }}
        onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
        getRowLabel={(order) => `${order.category || 'order'} for ${order.customer?.name || 'customer'}`}
      />

      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />

      <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `${selected.category || 'Order'} · ${selected.customer?.name || 'Unknown customer'}` : ''} size="lg" fullScreenOnMobile>
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selected.status} />
              {selected.is_job_feed_posted ? <Badge variant="success">Published to job feed</Badge> : null}
              {selected.archived_at ? <Badge variant="neutral">Archived</Badge> : null}
            </div>
            <KeyValueList
              columns={2}
              items={[
                { key: 'customer', label: 'Customer', value: selected.customer?.name },
                { key: 'phone', label: 'Phone', value: selected.customer?.phone },
                { key: 'email', label: 'Email', value: selected.customer?.email },
                { key: 'location', label: 'Location', value: formatLocation(selected) },
                { key: 'rooms', label: 'Rooms', value: selected.rooms },
                { key: 'budget', label: 'Max budget', value: selected.max_budget ? `৳${Number(selected.max_budget).toLocaleString()}` : null },
                { key: 'from', label: 'Needed from', value: selected.property_need_from ? formatOrderNeedFrom(selected.property_need_from) : null },
                { key: 'package', label: 'Package', value: selected.package },
                { key: 'cost', label: 'Cost', value: selected.cost ? `৳${Number(selected.cost).toLocaleString()}` : null },
                { key: 'created', label: 'Created', value: formatDate(selected.created_at) },
                { key: 'note', label: 'Admin note', value: selected.admin_note },
              ]}
            />
            <div>
              <h3 className="text-sm font-semibold text-ink">Preferences</h3>
              <p className="mt-1 text-sm text-muted">{fallbackDescription(selected)}</p>
            </div>
          </div>
        ) : null}
      </Dialog>

      <JobFeedDialog order={jobFeedOrder} onClose={() => setJobFeedOrder(null)} mutation={jobFeedMutation} />

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        onCancel={() => setPendingStatus(null)}
        onConfirm={async () => {
          const { order, status } = pendingStatus
          setPendingStatus(null)
          await statusMutation.run(order.id, status)
        }}
        title={pendingStatus?.status === 'cancelled' ? 'Cancel this order?' : 'Mark this order completed?'}
        description={pendingStatus?.status === 'cancelled' ? 'The customer will see the order as cancelled. You can move it back to pending later.' : 'Completed orders cannot be reopened.'}
        confirmLabel={pendingStatus?.status === 'cancelled' ? 'Cancel order' : 'Mark completed'}
        tone={pendingStatus?.status === 'cancelled' ? 'danger' : 'primary'}
        busy={statusMutation.busy}
        busyLabel="Updating…"
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={async () => {
          const target = archiveTarget
          setArchiveTarget(null)
          await archiveMutation.run(target.id, 'Archived from the orders list')
        }}
        title="Archive this order?"
        description="Archived orders are hidden from the active list but kept for records. Nothing is deleted."
        confirmLabel="Archive"
        busy={archiveMutation.busy}
        busyLabel="Archiving…"
      />
    </div>
  )
}

const JobFeedDialog = ({ order, onClose, mutation }) => {
  const [draft, setDraft] = useState({ title: '', description: '', isPosted: false })
  const [key, setKey] = useState(null)
  if (order && key !== order.id) {
    setKey(order.id)
    setDraft({ title: order.job_feed_title || '', description: order.job_feed_description || '', isPosted: Boolean(order.is_job_feed_posted) })
  }
  const canPost = order?.status === 'confirmed'

  return (
    <FormDialog
      open={Boolean(order)}
      onClose={onClose}
      title="Homepage job feed"
      description="Control how this order appears in the public job feed on the homepage."
      submitLabel="Save"
      busy={mutation.busy}
      error={mutation.error}
      size="lg"
      onSubmit={async () => {
        const result = await mutation.run(order.id, { title: draft.title.trim() || null, description: draft.description.trim() || null, isPosted: draft.isPosted })
        if (!result.error) onClose()
      }}
    >
      {order ? (
        <>
          <div className="rounded-[var(--radius-card)] border border-line bg-canvas p-4">
            <p className="ui-eyebrow">Source order</p>
            <p className="mt-1 text-sm font-medium text-ink">{fallbackTitle(order)}</p>
            <p className="mt-1 text-sm text-muted">{fallbackDescription(order)}</p>
          </div>
          <div>
            <label className="ui-label" htmlFor="job-feed-title">Public title</label>
            <input id="job-feed-title" className="ui-field" value={draft.title} placeholder={fallbackTitle(order)} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </div>
          <div>
            <label className="ui-label" htmlFor="job-feed-description">Public description</label>
            <textarea id="job-feed-description" className="ui-field" rows={4} value={draft.description} placeholder={fallbackDescription(order)} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </div>
          <label className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line p-4">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" role="switch" aria-checked={draft.isPosted} checked={draft.isPosted} disabled={!canPost && !draft.isPosted} onChange={(event) => setDraft({ ...draft, isPosted: event.target.checked })} />
            <span>
              <span className="block text-sm font-semibold text-ink">Publish on the homepage</span>
              <span className="ui-help block">{canPost ? 'Published jobs appear above recently listed properties.' : 'Only confirmed orders can be published. Confirm the order first.'}</span>
            </span>
          </label>
        </>
      ) : null}
    </FormDialog>
  )
}

export default AdminOrdersSection
