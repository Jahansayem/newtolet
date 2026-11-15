'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiEdit2, FiExternalLink, FiRefreshCw, FiRepeat } from 'react-icons/fi'
import {
  addCustomerOrderNote,
  assignCustomerOrder,
  deleteCustomerOrder,
  getCustomerOrderDetail,
} from '../../../services/admin/customerOrders'
import {
  CREATED_VIA_LABELS,
  SOURCE_LABELS,
  getCustomerOrderStatusMeta,
  isClosedStatus,
  isFollowUpOverdue,
  refundWindowDaysLeft,
} from '../../../lib/customerOrderStatus'
import { PERMISSIONS } from '../../../lib/adminPermissions'
import { useAdminPermissions } from '../../../contexts/AdminAccessContext'
import { useAuth } from '../../../hooks/useAuth'
import { useAdminMutation } from '../hooks/useAdminMutation'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import FormDialog from '../../ui/FormDialog'
import InlineAlert from '../../ui/InlineAlert'
import KeyValueList from '../../ui/KeyValueList'
import Skeleton from '../../ui/Skeleton'
import StatCard from '../../ui/StatCard'
import MatchesPanel from './MatchesPanel'
import OrderFormDialog from './OrderFormDialog'
import OrderTimeline from './OrderTimeline'
import PaymentPanel from './PaymentPanel'
import StatusChangeDialog from './StatusChangeDialog'

const bdt = (value) => `৳${Number(value).toLocaleString('en-US')}`
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null)
const formatWhen = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null)

const formatBudget = (order) => {
  if (order.budget_min !== null && order.budget_max !== null) return `${bdt(order.budget_min)} – ${bdt(order.budget_max)}`
  if (order.budget_max !== null) return `Up to ${bdt(order.budget_max)}`
  if (order.budget_min !== null) return `From ${bdt(order.budget_min)}`
  return null
}

const searchLabel = (order) => {
  if (order.search_mode === 'HUMAN') return `Human search${order.search_taken_over_by ? `: ${order.search_taken_over_by}` : ''}`
  if (order.search_mode === 'AI') return 'AI search'
  return null
}

/** Full page for one customer order: header, details, payment, listings, notes, timeline. */
export default function OrderDetailView({ orderId, assignees = [], onBack }) {
  const { user } = useAuth()
  const { hasPermission } = useAdminPermissions()
  const [detail, setDetail] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [note, setNote] = useState('')
  const requestRef = useRef(0)

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      const requestId = ++requestRef.current
      if (!quiet) setStatus('loading')
      const result = await getCustomerOrderDetail(orderId)
      if (requestId !== requestRef.current) return
      if (result.error) {
        setError(result.error)
        setStatus('error')
        return
      }
      setDetail(result.data)
      setError(null)
      setStatus('ready')
    },
    [orderId]
  )

  useEffect(() => {
    void load()
    return () => {
      requestRef.current += 1
    }
  }, [load])

  const reload = useCallback(() => load({ quiet: true }), [load])

  const noteMutation = useAdminMutation((id, body) => addCustomerOrderNote(id, body), {
    successMessage: 'Note added',
    errorMessage: 'Note could not be added',
    invalidate: ['customer-orders'],
    showAuditRef: false,
  })
  const assignMutation = useAdminMutation((id, assignee) => assignCustomerOrder(id, assignee), {
    successMessage: 'Assignee updated',
    errorMessage: 'Assignee could not be changed',
    invalidate: ['customer-orders'],
    onSuccess: reload,
  })

  const backButton = (
    <Button variant="ghost" icon={<FiArrowLeft />} onClick={onBack}>
      All customer orders
    </Button>
  )

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="ui-card space-y-3 p-5" aria-busy="true">
          <Skeleton width="40%" />
          <Skeleton />
          <Skeleton width="70%" />
        </div>
      </div>
    )
  }

  if (status === 'error' || !detail?.order) {
    return (
      <div className="space-y-4">
        {backButton}
        <InlineAlert
          variant={error?.permissionDenied ? 'permission' : 'danger'}
          title="This order could not be loaded"
          action={error?.retryable ? { label: 'Retry', onClick: () => load() } : null}
        >
          {error?.message || 'The order was not found.'}
        </InlineAlert>
      </div>
    )
  }

  const { order, claims, matches, timeline } = detail
  const statusMeta = getCustomerOrderStatusMeta(order.status)
  const closed = isClosedStatus(order.status)
  const deleted = Boolean(order.deleted_at)
  const refundDays = refundWindowDaysLeft(order)
  const overdue = isFollowUpOverdue(order)
  const search = searchLabel(order)
  const assigneeOptions = order.assigned_to && !assignees.some((option) => option.value === order.assigned_to)
    ? [{ value: order.assigned_to, label: order.assignee_name || 'Current assignee' }, ...assignees]
    : assignees

  const submitNote = async (event) => {
    event.preventDefault()
    if (!note.trim()) return
    const result = await noteMutation.run(order.id, note.trim())
    if (!result.error) {
      setNote('')
      void reload()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {backButton}
        <Button variant="ghost" icon={<FiRefreshCw />} onClick={() => reload()}>
          Refresh
        </Button>
      </div>

      {deleted ? <InlineAlert variant="warning" title="This order was deleted">Deleted by {order.deleted_by_label || 'an admin'} on {formatWhen(order.deleted_at)}. It is kept for the record and can no longer be changed.</InlineAlert> : null}

      <section className="ui-card space-y-4 p-5" aria-labelledby="co-order-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="co-order-heading" className="text-xl font-semibold text-ink">
              {order.order_no} · {order.customer_name}
            </h2>
            <p className="text-caption text-muted">
              House search · created {formatWhen(order.created_at)} by {CREATED_VIA_LABELS[order.created_via] || order.created_via} ({order.created_by_label})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              {search ? <Badge variant="brand">{search}</Badge> : null}
              {refundDays ? <Badge variant="warning">Refund window: {refundDays} day{refundDays === 1 ? '' : 's'} left</Badge> : null}
              {overdue ? <Badge variant="danger">Follow-up overdue</Badge> : null}
            </div>
          </div>
          {!deleted ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<FiRepeat />} onClick={() => setStatusOpen(true)}>
                Change status
              </Button>
              <Button variant="secondary" icon={<FiEdit2 />} onClick={() => setEditOpen(true)}>
                Edit details
              </Button>
              {hasPermission(PERMISSIONS.PAYMENTS_REVIEW) ? (
                <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Listings found" value={order.listings_found_count} tone={order.listings_found_count === 0 && !closed ? 'warning' : 'neutral'} hint={order.listings_found_count === 0 && !closed ? 'Nothing attached yet' : null} />
          <StatCard label="Verified listings" value={order.listings_verified_count} />
          <StatCard label="Unverified listings" value={order.listings_unverified_count} />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {order.customer_phone ? (
            <a className="text-brand hover:underline" href={`tel:${order.customer_phone}`}>
              {order.customer_phone}
            </a>
          ) : (
            <span className="text-muted">No phone number</span>
          )}
          {order.facebook_thread_url ? (
            <a className="inline-flex items-center gap-1 text-brand hover:underline" href={order.facebook_thread_url} target="_blank" rel="noopener noreferrer">
              Open the Messenger thread <FiExternalLink aria-hidden="true" />
            </a>
          ) : (
            <span className="text-muted">No Messenger thread linked</span>
          )}
        </div>

        <KeyValueList
          columns={2}
          items={[
            { key: 'fb', label: 'Facebook name', value: order.facebook_name },
            { key: 'source', label: 'Source', value: SOURCE_LABELS[order.source] || order.source },
            { key: 'area', label: 'Area', value: order.area },
            { key: 'budget', label: 'Budget', value: formatBudget(order) },
            { key: 'rooms', label: 'Rooms', value: order.rooms },
            { key: 'tenant', label: 'Family or bachelor', value: order.tenant_type ? order.tenant_type.replace(/^\w/, (c) => c.toUpperCase()) : null },
            { key: 'move', label: 'Move-in date', value: formatDate(order.move_in_date) },
            { key: 'gas', label: 'Gas', value: order.gas },
            { key: 'bath', label: 'Bathrooms', value: order.bathrooms },
            { key: 'balc', label: 'Balconies', value: order.balconies },
            { key: 'fac', label: 'Facilities', value: order.facilities },
            { key: 'follow', label: 'Follow up at', value: formatWhen(order.follow_up_at) },
            { key: 'notes', label: 'Requirement notes', value: order.requirement_notes },
          ]}
        />

        {!deleted ? (
          <div className="max-w-sm">
            <label className="ui-label" htmlFor="co-assignee-select">Assigned to</label>
            <select
              id="co-assignee-select"
              className="ui-field"
              value={order.assigned_to || ''}
              disabled={assignMutation.busy}
              onChange={(event) => void assignMutation.run(order.id, event.target.value || null)}
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PaymentPanel order={order} claims={claims} onChanged={reload} />
        <MatchesPanel order={order} matches={matches} onChanged={reload} />
      </div>

      <section className="ui-card space-y-4 p-4" aria-labelledby="co-timeline-heading">
        <h3 id="co-timeline-heading" className="text-base font-semibold text-ink">Notes and timeline</h3>
        {!deleted ? (
          <form onSubmit={submitNote} className="space-y-2">
            <label className="ui-label" htmlFor="co-note">Add an internal note</label>
            <textarea id="co-note" className="ui-field" rows={2} maxLength={4000} value={note} placeholder="Anything the next agent must know" onChange={(event) => setNote(event.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="secondary" busy={noteMutation.busy} busyLabel="Adding…" disabled={!note.trim()}>
                Add note
              </Button>
              <span className="text-caption text-muted">Notes are never shown to customers and cannot be edited or deleted.</span>
            </div>
          </form>
        ) : null}
        <OrderTimeline items={timeline} />
      </section>

      <StatusChangeDialog open={statusOpen} order={order} defaultTakenOverBy={user?.name || ''} onClose={() => setStatusOpen(false)} onChanged={reload} />
      <OrderFormDialog open={editOpen} order={order} assignees={assignees} onClose={() => setEditOpen(false)} onSaved={reload} />
      <DeleteOrderDialog open={deleteOpen} order={order} onClose={() => setDeleteOpen(false)} onDeleted={onBack} />
    </div>
  )
}

const DeleteOrderDialog = ({ open, order, onClose, onDeleted }) => {
  const [reason, setReason] = useState('')
  const [seed, setSeed] = useState(false)
  const [localError, setLocalError] = useState(null)
  if (open !== seed) {
    setSeed(open)
    if (open) {
      setReason('')
      setLocalError(null)
    }
  }
  const mutation = useAdminMutation((id, text) => deleteCustomerOrder(id, text), {
    successMessage: `Order ${order.order_no} deleted`,
    errorMessage: 'Order could not be deleted',
    invalidate: ['customer-orders'],
  })

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={async () => {
        if (reason.trim().length < 3) return setLocalError('Say why this order is being deleted.')
        setLocalError(null)
        const result = await mutation.run(order.id, reason.trim())
        if (result.error) return undefined
        onClose()
        return onDeleted?.()
      }}
      title={`Delete order ${order.order_no}?`}
      description="The order is hidden from the lists and can no longer be changed. Nothing is removed from the database, and the deletion is recorded in the audit log. Use Cancelled instead when a customer simply dropped out."
      submitLabel="Delete order"
      submitVariant="danger"
      busy={mutation.busy}
      error={localError || mutation.error}
    >
      <div>
        <label className="ui-label" htmlFor="co-delete-reason">Reason</label>
        <textarea id="co-delete-reason" className="ui-field" rows={3} maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
    </FormDialog>
  )
}
