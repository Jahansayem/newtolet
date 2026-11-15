'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FiPlus, FiRefreshCw } from 'react-icons/fi'
import { CUSTOMER_ORDERS_DOMAIN, CUSTOMER_ORDER_QUEUES, listAssignableAdmins, listCustomerOrders } from '../../../services/admin/customerOrders'
import {
  CREATED_VIA_LABELS,
  CUSTOMER_ORDER_STATUSES,
  PAYMENT_STATUS_META,
  formatListingsCell,
  formatPaymentCell,
  getCustomerOrderStatusLabel,
  getCustomerOrderStatusMeta,
  isClosedStatus,
  isFollowUpOverdue,
} from '../../../lib/customerOrderStatus'
import { useAuth } from '../../../hooks/useAuth'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useEntityParam } from '../hooks/useEntityParam'
import CustomerOrderCounters from '../customer-orders/CustomerOrderCounters'
import OrderDetailView from '../customer-orders/OrderDetailView'
import OrderFormDialog from '../customer-orders/OrderFormDialog'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'
import EmptyState from '../../ui/EmptyState'
import FilterBar from '../../ui/FilterBar'
import InlineAlert from '../../ui/InlineAlert'
import Pagination from '../../ui/Pagination'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const bdt = (value) => `৳${Number(value).toLocaleString('en-US')}`

const STATUS_OPTIONS = CUSTOMER_ORDER_STATUSES.map((value) => ({ value, label: getCustomerOrderStatusLabel(value) }))
const CREATED_VIA_OPTIONS = Object.entries(CREATED_VIA_LABELS).map(([value, label]) => ({ value, label }))
const PAYMENT_OPTIONS = Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))
const LISTINGS_OPTIONS = [
  { value: 'none', label: '0 listings found' },
  { value: 'has', label: 'Has listings' },
]

const EMPTY_FILTERS = { status: '', createdVia: '', assignee: '', paymentStatus: '', listings: '', from: '', to: '', queue: '' }

const requirementSummary = (order) => {
  const parts = []
  if (order.rooms !== null && order.rooms !== undefined) parts.push(`${order.rooms} room${order.rooms === 1 ? '' : 's'}`)
  if (order.budget_max !== null && order.budget_max !== undefined) parts.push(`up to ${bdt(order.budget_max)}`)
  else if (order.budget_min !== null && order.budget_min !== undefined) parts.push(`from ${bdt(order.budget_min)}`)
  if (order.tenant_type) parts.push(order.tenant_type)
  return parts.join(' · ')
}

const AdminCustomerOrdersSection = () => {
  const { user } = useAuth()
  const [selectedId, setSelectedId] = useEntityParam('id')
  const [queueParam, setQueueParam] = useEntityParam('queue')
  const [initialFilters] = useState(() => ({ ...EMPTY_FILTERS, queue: CUSTOMER_ORDER_QUEUES[queueParam] ? queueParam : '' }))
  const list = useAdminList({ domain: CUSTOMER_ORDERS_DOMAIN, fetcher: listCustomerOrders, initialFilters })

  const [createOpen, setCreateOpen] = useState(false)
  const [assignees, setAssignees] = useState([])
  const [countsToken, setCountsToken] = useState(0)

  useEffect(() => {
    let active = true
    void listAssignableAdmins().then((result) => {
      if (active && !result.error) setAssignees(result.data || [])
    })
    return () => {
      active = false
    }
  }, [])

  const setQueue = useCallback(
    (queue) => {
      list.setFilter('queue', queue)
      setQueueParam(queue || null)
    },
    [list, setQueueParam]
  )

  const headerActions = useMemo(
    () =>
      selectedId ? null : (
        <>
          <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => { void list.refresh(); setCountsToken((token) => token + 1) }} busy={list.isRefreshing} busyLabel="Refreshing…">
            Refresh
          </Button>
          <Button variant="primary" icon={<FiPlus />} onClick={() => setCreateOpen(true)}>
            New order
          </Button>
        </>
      ),
    [selectedId, list]
  )
  useShellHeader({ actions: headerActions })

  const assigneeFilterOptions = useMemo(() => {
    const options = assignees.filter((option) => option.value !== user?.id)
    return user?.id ? [{ value: user.id, label: 'Assigned to me' }, ...options] : options
  }, [assignees, user?.id])

  const columns = useMemo(
    () => [
      {
        key: 'created_at',
        header: 'Order',
        sortable: true,
        render: (order) => (
          <div className="min-w-0">
            <button type="button" className="whitespace-nowrap font-semibold text-brand hover:underline" onClick={() => setSelectedId(order.id)}>
              {order.order_no}
            </button>
            <p className="whitespace-nowrap text-caption text-muted">{formatDate(order.created_at)}</p>
            <p className="whitespace-nowrap text-caption text-muted">{CREATED_VIA_LABELS[order.created_via] || order.created_via}</p>
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        render: (order) => (
          <div className="min-w-0">
            <p className="font-medium text-ink">{order.customer_name}</p>
            <p className="text-caption text-muted">{order.customer_phone || order.facebook_name || 'No phone'}</p>
          </div>
        ),
      },
      {
        key: 'requirement',
        header: 'Requirement',
        hideBelow: 'lg',
        render: (order) => (
          <div className="min-w-0">
            <p className="text-ink">{order.area || 'Area not set'}</p>
            <p className="text-caption text-muted">{requirementSummary(order) || '—'}</p>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (order) => {
          const meta = getCustomerOrderStatusMeta(order.status)
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge variant={meta.variant}>{meta.label}</Badge>
              {order.search_mode === 'HUMAN' && order.search_taken_over_by && order.status === 'SEARCHING_BY_HUMAN' ? (
                <span className="text-caption text-muted">by {order.search_taken_over_by}</span>
              ) : null}
              {isFollowUpOverdue(order) ? <Badge variant="danger">Follow-up overdue</Badge> : null}
            </div>
          )
        },
      },
      {
        key: 'listings_found_count',
        header: 'Listings found',
        sortable: true,
        render: (order) =>
          order.listings_found_count === 0 && !isClosedStatus(order.status) ? <Badge variant="warning">0</Badge> : <span className="tabular-nums">{formatListingsCell(order)}</span>,
      },
      {
        key: 'amount_due',
        header: 'Payment',
        sortable: true,
        render: (order) => (
          <div className="flex flex-col items-start gap-1">
            <span className="tabular-nums text-ink">{formatPaymentCell(order)}</span>
            {order.claims_awaiting_verification > 0 ? (
              <Badge variant="warning">{order.claims_awaiting_verification} to verify</Badge>
            ) : order.payment_verification === 'VERIFIED' ? (
              <Badge variant="success">Verified</Badge>
            ) : null}
          </div>
        ),
      },
      { key: 'assignee', header: 'Assigned to', hideBelow: 'lg', render: (order) => order.assignee_name || <span className="text-muted">Unassigned</span> },
    ],
    [setSelectedId]
  )

  if (selectedId) {
    return <OrderDetailView key={selectedId} orderId={selectedId} assignees={assignees} onBack={() => setSelectedId(null)} />
  }

  const { filters } = list
  const chips = []
  if (filters.queue) chips.push({ key: 'queue', label: CUSTOMER_ORDER_QUEUES[filters.queue], onRemove: () => setQueue('') })
  if (filters.status) chips.push({ key: 'status', label: `Status: ${getCustomerOrderStatusLabel(filters.status)}`, onRemove: () => list.setFilter('status', '') })
  if (filters.createdVia) chips.push({ key: 'createdVia', label: `Created by: ${CREATED_VIA_LABELS[filters.createdVia]}`, onRemove: () => list.setFilter('createdVia', '') })
  if (filters.assignee) chips.push({ key: 'assignee', label: `Assigned to: ${filters.assignee === user?.id ? 'me' : assignees.find((option) => option.value === filters.assignee)?.label || 'selected admin'}`, onRemove: () => list.setFilter('assignee', '') })
  if (filters.paymentStatus) chips.push({ key: 'paymentStatus', label: `Payment: ${PAYMENT_STATUS_META[filters.paymentStatus]?.label}`, onRemove: () => list.setFilter('paymentStatus', '') })
  if (filters.listings) chips.push({ key: 'listings', label: LISTINGS_OPTIONS.find((option) => option.value === filters.listings)?.label, onRemove: () => list.setFilter('listings', '') })
  if (filters.from) chips.push({ key: 'from', label: `From ${formatDate(filters.from)}`, onRemove: () => list.setFilter('from', '') })
  if (filters.to) chips.push({ key: 'to', label: `To ${formatDate(filters.to)}`, onRemove: () => list.setFilter('to', '') })

  const missingSchema = list.error?.code === 'MISSING_TABLE' || list.error?.code === 'MISSING_COLUMN'

  return (
    <div className="space-y-4">
      <CustomerOrderCounters activeQueue={filters.queue} onSelect={setQueue} refreshToken={countsToken} />

      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search customer orders', placeholder: 'Phone, name, order number, area…' }}
        filters={[
          { key: 'status', label: 'Status', type: 'select', value: filters.status, onChange: (value) => list.setFilter('status', value), options: STATUS_OPTIONS, placeholder: 'All statuses' },
          { key: 'createdVia', label: 'Created by', type: 'select', value: filters.createdVia, onChange: (value) => list.setFilter('createdVia', value), options: CREATED_VIA_OPTIONS, placeholder: 'Anyone' },
          { key: 'assignee', label: 'Assignee', type: 'select', value: filters.assignee, onChange: (value) => list.setFilter('assignee', value), options: assigneeFilterOptions, placeholder: 'Anyone' },
          { key: 'paymentStatus', label: 'Payment', type: 'select', value: filters.paymentStatus, onChange: (value) => list.setFilter('paymentStatus', value), options: PAYMENT_OPTIONS, placeholder: 'Any payment status' },
          { key: 'listings', label: 'Listings found', type: 'select', value: filters.listings, onChange: (value) => list.setFilter('listings', value), options: LISTINGS_OPTIONS, placeholder: 'Any' },
          { key: 'from', label: 'Created from', type: 'date', value: filters.from, onChange: (value) => list.setFilter('from', value) },
          { key: 'to', label: 'Created to', type: 'date', value: filters.to, onChange: (value) => list.setFilter('to', value) },
        ]}
        chips={chips}
        onClearAll={() => {
          list.resetFilters()
          list.setFilter('queue', '')
          setQueueParam(null)
        }}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="orders"
      />

      {missingSchema ? (
        <InlineAlert variant="warning" title="Customer orders are not set up on this database yet">
          Apply supabase/migrations/20261116090000_customer_orders.sql, then refresh.
        </InlineAlert>
      ) : (
        <>
          <DataTable
            caption="Customer orders"
            columns={columns}
            rows={list.items}
            loading={list.isLoading}
            error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
            onRetry={list.retry}
            empty={<EmptyState title="No customer orders match" description="Try clearing the filters or search, or create a new order." />}
            rowActions={(order) => (
              <Button size="sm" variant="secondary" onClick={() => setSelectedId(order.id)} aria-label={`Open order ${order.order_no}`}>
                Open
              </Button>
            )}
            sort={{ key: list.sort.column, direction: list.sort.dir }}
            onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
            getRowLabel={(order) => `order ${order.order_no} for ${order.customer_name}`}
          />
          <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
        </>
      )}

      <OrderFormDialog
        open={createOpen}
        assignees={assignees}
        onClose={() => setCreateOpen(false)}
        onSaved={(order) => {
          if (order?.id) setSelectedId(order.id)
        }}
        onOpenExisting={(orderNo) => {
          setCreateOpen(false)
          list.setSearch(orderNo)
        }}
      />
    </div>
  )
}

export default AdminCustomerOrdersSection
