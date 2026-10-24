// Property inquiries: server-paginated list + RPC-backed mutations.

import { runAdminListQuery } from './adminQuery'
import { callAdminRpc } from './adminRpc'
import { invalidateAdminSnapshots } from './adminCache'

export const INQUIRY_LIST_COLUMNS = `
  id, property_id, name, email, phone, message, status, assigned_to, follow_up_at, admin_note, archived_at,
  created_at, updated_at,
  properties(id, property_id_number, category, short_description, state_district, area)
`

export const listInquiries = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'property_inquiries',
    columns: INQUIRY_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'status', 'follow_up_at'],
    filters: { status: filters.status, assigned_to: filters.assignedTo },
    filterSpec: { status: { op: 'eq' }, assigned_to: { op: 'eq' } },
    search,
    searchColumns: ['name', 'email', 'phone', 'message'],
    apply: (query) => {
      let next = filters.archived === 'archived' ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
      if (filters.overdue === 'overdue') next = next.lt('follow_up_at', new Date().toISOString()).not('status', 'in', '(resolved,closed)')
      return next
    },
    signal,
  })

const after = (result) => {
  if (!result.error) invalidateAdminSnapshots('inquiries')
  return result
}

/**
 * updateInquiry(id, { status, assignedTo, followUpAt, note, clearAssignee, clearFollowUp })
 */
export const updateInquiry = async (inquiryId, { status = null, assignedTo = null, followUpAt = null, note = null, clearAssignee = false, clearFollowUp = false } = {}) =>
  after(
    await callAdminRpc('admin_set_inquiry', {
      p_inquiry_id: inquiryId,
      p_status: status,
      p_assigned_to: assignedTo,
      p_follow_up_at: followUpAt,
      p_note: note,
      p_clear_assignee: clearAssignee,
      p_clear_follow_up: clearFollowUp,
    })
  )

export const archiveInquiry = async (inquiryId, reason = null) =>
  after(await callAdminRpc('admin_archive_inquiry', { p_inquiry_id: inquiryId, p_reason: reason }))
