// Trust moderation: owner ID verifications and listing reports (QA audit 2026-11-14).

import { runAdminListQuery } from './adminQuery'
import { callAdminRpc } from './adminRpc'
import { invalidateAdminSnapshots } from './adminCache'

export const VERIFICATION_LIST_COLUMNS =
  'id, user_id, id_type, front_image_url, back_image_url, verification_status, admin_notes, submitted_at, reviewed_at, users(name, email, phone)'

export const listVerifications = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'user_verifications',
    columns: VERIFICATION_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'submitted_at', dir: 'desc' },
    sortable: ['submitted_at', 'reviewed_at'],
    filters: { verification_status: filters.status },
    filterSpec: { verification_status: { op: 'eq' } },
    search,
    searchColumns: ['id_type'],
    signal,
  })

export const reviewVerification = async (verificationId, { approve, note = null }) => {
  const result = await callAdminRpc('admin_review_user_verification', {
    p_verification_id: verificationId,
    p_approve: approve,
    p_note: note,
  })
  if (!result.error) invalidateAdminSnapshots('verifications')
  return result
}

export const REPORT_LIST_COLUMNS =
  'id, property_id, user_id, reason, message, status, created_at, updated_at, properties(property_id_number, category, property_type, area, state_district, status, is_active)'

export const listReports = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'property_reports',
    columns: REPORT_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'status'],
    filters: { status: filters.status },
    filterSpec: { status: { op: 'eq' } },
    search,
    searchColumns: ['reason', 'message'],
    signal,
  })

export const setReportStatus = async (reportId, status, note = null) => {
  const result = await callAdminRpc('admin_set_report_status', { p_report_id: reportId, p_status: status, p_note: note })
  if (!result.error) invalidateAdminSnapshots('reports')
  return result
}
