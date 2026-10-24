// Feedback moderation: server-paginated list + RPC-backed review.

import { runAdminListQuery } from './adminQuery'
import { callAdminRpc } from './adminRpc'
import { invalidateAdminSnapshots } from './adminCache'

export const FEEDBACK_LIST_COLUMNS =
  'id, user_id, name, feedback, status, is_resolved, is_public, rejection_reason, reviewed_at, reviewed_by, archived_at, created_at, updated_at'

export const listFeedback = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'feedback',
    columns: FEEDBACK_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'status'],
    filters: { status: filters.status, is_resolved: filters.resolved },
    filterSpec: { status: { op: 'eq' }, is_resolved: { op: 'eq', values: (value) => value === 'resolved' } },
    search,
    searchColumns: ['name', 'feedback'],
    apply: (query) => (filters.archived === 'archived' ? query.not('archived_at', 'is', null) : query.is('archived_at', null)),
    signal,
  })

const after = (result) => {
  if (!result.error) invalidateAdminSnapshots('feedback')
  return result
}

/** reviewFeedback(id, { status, rejectionReason, isResolved, isPublic }) */
export const reviewFeedback = async (feedbackId, { status = null, rejectionReason = null, isResolved = null, isPublic = null } = {}) =>
  after(
    await callAdminRpc('admin_review_feedback', {
      p_feedback_id: feedbackId,
      p_status: status,
      p_rejection_reason: rejectionReason,
      p_is_resolved: isResolved,
      p_is_public: isPublic,
    })
  )

export const archiveFeedback = async (feedbackId, reason = null) =>
  after(await callAdminRpc('admin_archive_feedback', { p_feedback_id: feedbackId, p_reason: reason }))

// ---- compatibility wrappers (actor ids are ignored; the server uses auth.uid()) ----
export const approveFeedback = (feedbackId) => reviewFeedback(feedbackId, { status: 'approved' })
export const rejectFeedback = (feedbackId, _userId, reason = 'Rejected by admin') => reviewFeedback(feedbackId, { status: 'rejected', rejectionReason: reason })
export const updateFeedbackStatus = (feedbackId, isResolved) => reviewFeedback(feedbackId, { isResolved })
/** @deprecated feedback is archived, never hard-deleted */
export const deleteFeedback = (feedbackId) => archiveFeedback(feedbackId, 'Removed from the admin panel')
/** @deprecated use listFeedback */
export const getAllFeedback = async () => {
  const result = await listFeedback({ pageSize: 100 })
  return { data: result.data, error: result.error }
}
