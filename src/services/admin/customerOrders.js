// Customer Orders (paid house-search requests): server-paginated list over the
// customer_orders_enriched view + RPC-backed mutations. Payment totals and the
// listings-found counts are columns of that view; nothing here computes them.

import { runAdminListQuery } from './adminQuery'
import { callAdminRpc } from './adminRpc'
import { invalidateAdminSnapshots } from './adminCache'
import { ok } from './adminResult'
import { listAdminMemberships } from './settings'
import { CLOSED_STATUSES, REFUND_WINDOW_DAYS } from '../../lib/customerOrderStatus'

export const CUSTOMER_ORDERS_DOMAIN = 'customer-orders'
export const CUSTOMER_ORDERS_VIEW = 'customer_orders_enriched'

export const CUSTOMER_ORDER_LIST_COLUMNS = `
  id, order_no, type, status, search_mode, search_taken_over_by, created_via, created_by_label, source,
  customer_name, customer_phone, facebook_name, facebook_thread_url, area, rooms, budget_min, budget_max, move_in_date,
  tenant_type, service_charge_bdt, assigned_to, assignee_name, follow_up_at, payment_verified_at,
  amount_paid, amount_verified, amount_due, overpaid, payment_status, payment_verification, claims_awaiting_verification,
  listings_found_count, listings_verified_count, listings_unverified_count, created_at, updated_at
`

const SEARCH_COLUMNS = ['order_no', 'customer_name', 'customer_phone', 'facebook_name', 'area']
const CLOSED_LIST = `(${CLOSED_STATUSES.join(',')})`

/** Dashboard counters deep-link into the list with one of these. */
export const CUSTOMER_ORDER_QUEUES = Object.freeze({
  open: 'Open orders',
  awaiting: 'Payment awaiting verification',
  refund: 'Inside the 7-day refund window',
  overdue: 'Overdue follow-ups',
  zero: 'Open with 0 listings found',
})

const dayStart = (key) => new Date(`${key}T00:00:00`).toISOString()
const dayEnd = (key) => new Date(`${key}T23:59:59.999`).toISOString()

const applyQueue = (query, queue) => {
  const now = new Date().toISOString()
  switch (queue) {
    case 'open':
      return query.not('status', 'in', CLOSED_LIST)
    case 'awaiting':
      return query.gt('claims_awaiting_verification', 0)
    case 'refund':
      return query.gt('payment_verified_at', new Date(Date.now() - REFUND_WINDOW_DAYS * 86400000).toISOString()).not('status', 'in', CLOSED_LIST)
    case 'overdue':
      return query.lt('follow_up_at', now).not('status', 'in', CLOSED_LIST)
    case 'zero':
      return query.eq('listings_found_count', 0).not('status', 'in', CLOSED_LIST)
    default:
      return query
  }
}

/**
 * listCustomerOrders({ page, pageSize, sort, search,
 *   filters: { status, createdVia, assignee, paymentStatus, listings, from, to, queue } })
 */
export const listCustomerOrders = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: CUSTOMER_ORDERS_VIEW,
    columns: CUSTOMER_ORDER_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'status', 'amount_due', 'listings_found_count', 'move_in_date', 'follow_up_at'],
    filters: {
      status: filters.status,
      created_via: filters.createdVia,
      assigned_to: filters.assignee,
      payment_status: filters.paymentStatus,
    },
    filterSpec: {
      status: { op: 'eq' },
      created_via: { op: 'eq' },
      assigned_to: { op: 'eq' },
      payment_status: { op: 'eq' },
    },
    search,
    searchColumns: SEARCH_COLUMNS,
    apply: (query) => {
      let next = query.is('deleted_at', null)
      if (filters.listings === 'none') next = next.eq('listings_found_count', 0)
      if (filters.listings === 'has') next = next.gt('listings_found_count', 0)
      if (filters.from) next = next.gte('created_at', dayStart(filters.from))
      if (filters.to) next = next.lte('created_at', dayEnd(filters.to))
      return applyQueue(next, filters.queue)
    },
    signal,
  })

/** { order, claims, matches, timeline } for the detail view. */
export const getCustomerOrderDetail = (orderId, { signal } = {}) =>
  callAdminRpc('admin_customer_order_detail', { p_order_id: orderId }, { signal })

/** { open, awaiting_verification, refund_window, overdue_follow_ups, zero_listings, attention } */
export const getCustomerOrderCounts = ({ signal } = {}) => callAdminRpc('admin_customer_order_counts', {}, { signal })

const after = (result) => {
  if (!result.error) invalidateAdminSnapshots(CUSTOMER_ORDERS_DOMAIN)
  return result
}

/** The server raises CONFLICT with hint duplicate_of=<order no> for a second active order. */
export const getDuplicateOrderNo = (error) => (error?.code === 'CONFLICT' ? error.details?.duplicate_of || null : null)

export const createCustomerOrder = async (payload, { confirmDuplicate = false } = {}) =>
  after(await callAdminRpc('admin_customer_order_create', { p_payload: payload, p_confirm_duplicate: confirmDuplicate }))

export const updateCustomerOrder = async (orderId, patch) =>
  after(await callAdminRpc('admin_customer_order_update', { p_order_id: orderId, p_patch: patch }))

export const setCustomerOrderStatus = async (orderId, { status, reason, takenOverBy = null }) =>
  after(await callAdminRpc('admin_customer_order_set_status', { p_order_id: orderId, p_status: status, p_reason: reason, p_taken_over_by: takenOverBy }))

/** The amount is required; send a TrxID or the sender's last 4 digits (either one). */
export const recordPaymentClaim = async (orderId, { amountBdt, trxId = null, senderLast4 = null }) =>
  after(await callAdminRpc('admin_customer_order_record_claim', { p_order_id: orderId, p_amount_bdt: amountBdt, p_trx_id: trxId, p_sender_last4: senderLast4 }))

/** decision: 'verify' | 'reject'. Needs payments.review; the server refuses anyone else. */
export const reviewPaymentClaim = async (claimId, { decision, note = null }) =>
  after(await callAdminRpc('admin_customer_order_review_claim', { p_claim_id: claimId, p_decision: decision, p_note: note }))

export const addCustomerOrderNote = async (orderId, body) =>
  after(await callAdminRpc('admin_customer_order_add_note', { p_order_id: orderId, p_body: body }))

export const addCustomerOrderMatch = async (orderId, match) =>
  after(await callAdminRpc('admin_customer_order_add_match', { p_order_id: orderId, p_match: match }))

export const updateCustomerOrderMatch = async (matchId, patch) =>
  after(await callAdminRpc('admin_customer_order_update_match', { p_match_id: matchId, p_patch: patch }))

export const assignCustomerOrder = async (orderId, assignedTo) =>
  after(await callAdminRpc('admin_customer_order_assign', { p_order_id: orderId, p_assigned_to: assignedTo || null }))

export const deleteCustomerOrder = async (orderId, reason) =>
  after(await callAdminRpc('admin_customer_order_delete', { p_order_id: orderId, p_reason: reason }))

/** [{ value: userId, label }] of active admin users, for the assignee controls. */
export const listAssignableAdmins = async ({ signal } = {}) => {
  const result = await listAdminMemberships({ signal })
  if (result.error) return result
  return ok((result.data || []).map((entry) => ({ value: entry.userId, label: entry.user?.name || entry.user?.email || entry.userId })))
}
