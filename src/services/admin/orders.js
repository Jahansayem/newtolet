// Orders (rental requests): server-paginated list + RPC-backed mutations.

import { runAdminListQuery } from './adminQuery'
import { callAdminRpc } from './adminRpc'
import { invalidateAdminSnapshots } from './adminCache'

export const ORDER_LIST_COLUMNS = `
  id, user_id, division, district, area, sub_area, category, rooms, property_need_from, max_budget,
  additional_preferences, package, cost, status, is_job_feed_posted, job_feed_posted_at, job_feed_title,
  job_feed_description, admin_note, assigned_to, archived_at, created_at, updated_at,
  customer:users!orders_user_id_fkey(id, name, email, phone)
`

const SEARCH_COLUMNS = ['category', 'area', 'district', 'division', 'sub_area', 'job_feed_title']

/**
 * listOrders({ page, pageSize, sort, filters: { status, archived, jobFeed }, search })
 */
export const listOrders = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'orders',
    columns: ORDER_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'status', 'max_budget', 'cost'],
    filters: { status: filters.status, is_job_feed_posted: filters.jobFeed },
    filterSpec: {
      status: { op: 'eq' },
      is_job_feed_posted: { op: 'eq', values: (value) => value === 'posted' },
    },
    search,
    searchColumns: SEARCH_COLUMNS,
    apply: (query) => (filters.archived === 'archived' ? query.not('archived_at', 'is', null) : query.is('archived_at', null)),
    signal,
  })

const after = (result) => {
  if (!result.error) invalidateAdminSnapshots('orders')
  return result
}

export const setOrderStatus = async (orderId, status, note = null) =>
  after(await callAdminRpc('admin_set_order_status', { p_order_id: orderId, p_status: status, p_note: note }))

export const setOrderJobFeed = async (orderId, { title = null, description = null, isPosted = false } = {}) =>
  after(await callAdminRpc('admin_set_order_job_feed', { p_order_id: orderId, p_title: title, p_description: description, p_is_posted: isPosted }))

export const setOrderAssignee = async (orderId, assignedTo) =>
  after(await callAdminRpc('admin_set_order_assignee', { p_order_id: orderId, p_assigned_to: assignedTo }))

export const archiveOrder = async (orderId, reason = null) =>
  after(await callAdminRpc('admin_archive_order', { p_order_id: orderId, p_reason: reason }))

// ---- compatibility wrappers for the old adminService exports ----
export const updateOrderStatus = (orderId, status) => setOrderStatus(orderId, status)
export const updateOrderJobFeed = (orderId, updates = {}) =>
  setOrderJobFeed(orderId, {
    title: updates.job_feed_title ?? null,
    description: updates.job_feed_description ?? null,
    isPosted: Boolean(updates.is_job_feed_posted),
  })
/** @deprecated orders are archived, never hard-deleted */
export const deleteOrder = (orderId) => archiveOrder(orderId, 'Removed from the admin panel')
/** @deprecated use listOrders */
export const getAllOrders = async () => {
  const result = await listOrders({ pageSize: 100 })
  return { data: result.data, error: result.error }
}
