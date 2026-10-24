// Append-only admin audit log, read through admin_list_audit_log (audit.view).

import { callAdminRpc } from './adminRpc'
import { fetchAllPages } from './adminQuery'
import { ok } from './adminResult'
import { csvFilename, downloadCsv, toCsv } from '../../lib/exportCsv'

export const AUDIT_ENTITY_TYPES = [
  { value: 'property', label: 'Listings', tab: 'properties' },
  { value: 'user', label: 'Users', tab: 'users' },
  { value: 'payment', label: 'Payments', tab: 'payments' },
  { value: 'order', label: 'Orders', tab: 'orders' },
  { value: 'inquiry', label: 'Inquiries', tab: 'inquiries' },
  { value: 'feedback', label: 'Feedback', tab: 'feedback' },
  { value: 'refund_request', label: 'Refund requests', tab: 'refunds' },
  { value: 'pricing', label: 'Pricing', tab: 'credits' },
  { value: 'site_settings', label: 'Site settings', tab: 'settings' },
]

export const AUDIT_ACTIONS = [
  'property.set_status',
  'property.set_featured',
  'property.soft_delete',
  'user.set_active',
  'user.set_roles',
  'user.set_employee',
  'user.adjust_credits',
  'user.blacklist',
  'user.unblacklist',
  'payment.approve',
  'payment.reject',
  'payment.refund',
  'order.set_status',
  'order.set_job_feed',
  'order.assign',
  'order.archive',
  'inquiry.update',
  'inquiry.archive',
  'feedback.review',
  'feedback.archive',
  'refund.review',
  'pricing.update',
  'pricing.rollback',
  'settings.update',
]

export const formatAuditAction = (action = '') => action.replace(/[._]/g, ' ').replace(/^\w/, (char) => char.toUpperCase())

const dayStart = (key) => (key ? new Date(`${key}T00:00:00`).toISOString() : null)
const dayEnd = (key) => (key ? new Date(`${key}T23:59:59.999`).toISOString() : null)

/**
 * listAuditLog({ page, pageSize ≤ 200, filters: { entityType, entityId, actorId, action, from, to }, search })
 * `search` is matched against entity_id when no explicit entityId filter is set.
 */
export const listAuditLog = async ({ page = 1, pageSize = 50, filters = {}, search = '' } = {}, { signal } = {}) => {
  const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 200)
  const safePage = Math.max(Number(page) || 1, 1)
  const offset = (safePage - 1) * limit
  const entityId = String(filters.entityId || search || '').replace(/^#/, '').trim() || null
  const rpc = await callAdminRpc(
    'admin_list_audit_log',
    {
      p_entity_type: filters.entityType || null,
      p_entity_id: entityId,
      p_actor_id: filters.actorId || null,
      p_action: filters.action || null,
      p_from: dayStart(filters.from),
      p_to: dayEnd(filters.to),
      p_limit: limit,
      p_offset: offset,
    },
    { signal }
  )
  if (rpc.error) return { ...rpc, data: [], page: safePage, pageSize: limit, totalCount: 0, hasMore: false }
  const rows = Array.isArray(rpc.data) ? rpc.data : []
  const totalCount = rows.length ? Number(rows[0].total_count) || rows.length : 0
  return ok(rows, { page: safePage, pageSize: limit, totalCount, hasMore: offset + rows.length < totalCount })
}

const AUDIT_CSV_COLUMNS = [
  { key: 'id', label: 'Audit ID' },
  { key: 'created_at', label: 'When (UTC)' },
  { key: (row) => row.actor_name || row.actor_email || row.actor_id || '', label: 'Actor' },
  { key: (row) => (row.actor_roles || []).join(' '), label: 'Actor roles' },
  { key: 'action', label: 'Action' },
  { key: 'entity_type', label: 'Entity type' },
  { key: 'entity_id', label: 'Entity ID' },
  { key: 'reason', label: 'Reason' },
  { key: (row) => (row.before ? JSON.stringify(row.before) : ''), label: 'Before' },
  { key: (row) => (row.after ? JSON.stringify(row.after) : ''), label: 'After' },
  { key: (row) => (row.metadata ? JSON.stringify(row.metadata) : ''), label: 'Metadata' },
]

export const exportAuditLogCsv = async (params = {}) => {
  const result = await fetchAllPages(listAuditLog, params, { pageSize: 200, maxRows: 5000 })
  if (result.error && (!result.data || result.data.length === 0)) return result
  downloadCsv(csvFilename(`audit-log${params.filters?.entityType ? `-${params.filters.entityType}` : ''}`), toCsv(result.data, AUDIT_CSV_COLUMNS))
  return { ...ok({ rows: result.data.length, truncated: Boolean(result.truncated) }), error: result.error || null }
}
