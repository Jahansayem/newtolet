// Contact-unlock refund requests.

import { supabase } from '../supabaseClient'
import { runAdminListQuery } from './adminQuery'
import { callAdminRpc } from './adminRpc'
import { fail, ok, unwrapSingle } from './adminResult'
import { invalidateAdminSnapshots } from './adminCache'
import { ADMIN_ERROR_CODES } from '../../lib/adminErrorCodes'

export const REFUND_LIST_COLUMNS = `
  id, contact_view_id, user_id, property_id, reason_code, details, status, admin_note, requested_at,
  reviewed_at, reviewed_by, credited_at, credits_restored,
  contact_view:contact_views(id, viewed_at, credits_spent),
  user:users!contact_unlock_refund_requests_user_id_fkey(id, name, email, phone),
  property:properties(id, property_id_number, category, area, state_district)
`

export const listRefundRequests = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'contact_unlock_refund_requests',
    columns: REFUND_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'requested_at', dir: 'desc' },
    sortable: ['requested_at', 'status', 'reviewed_at'],
    filters: { status: filters.status, reason_code: filters.reasonCode },
    filterSpec: { status: { op: 'eq' }, reason_code: { op: 'eq' } },
    search,
    searchColumns: ['details', 'admin_note'],
    signal,
  })

/** Approve/reject; the permission-aware RPC wraps the legacy function and records the reviewer. */
export const reviewRefundRequest = async (requestId, status, adminNote = null) => {
  let result = await callAdminRpc('admin_review_refund_request', { p_request_id: requestId, p_status: status, p_admin_note: adminNote })
  if (result.error && result.error.code === ADMIN_ERROR_CODES.MISSING_RPC) {
    try {
      const { data, error } = await supabase.rpc('review_contact_unlock_refund_request', { p_request_id: requestId, p_status: status, p_admin_note: adminNote })
      result = error ? fail(error) : ok(unwrapSingle(data))
    } catch (error) {
      result = fail(error)
    }
  }
  if (!result.error) invalidateAdminSnapshots('refunds')
  return result
}

// ---- compatibility wrappers ----
export const reviewContactUnlockRefundRequest = reviewRefundRequest
/** @deprecated use listRefundRequests */
export const getAdminContactUnlockRefundRequests = async () => {
  const result = await listRefundRequests({ pageSize: 100 })
  return result.data || []
}
