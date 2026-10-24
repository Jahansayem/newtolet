'use client'

import React, { useMemo, useState } from 'react'
import { FiArchive, FiCheck, FiEye, FiRefreshCw, FiX } from 'react-icons/fi'
import { listFeedback, reviewFeedback, archiveFeedback } from '../../../services/admin/feedback'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmDialog from '../../ui/ConfirmDialog'
import Dialog from '../../ui/Dialog'
import EmptyState from '../../ui/EmptyState'
import FilterBar from '../../ui/FilterBar'
import InlineAlert from '../../ui/InlineAlert'
import Pagination from '../../ui/Pagination'
import ReasonDialog from '../../ui/ReasonDialog'
import { SkeletonRows } from '../../ui/Skeleton'
import StatusPill from '../../ui/StatusPill'
import Tabs from '../../ui/Tabs'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
]

const AdminFeedbackSection = () => {
  const list = useAdminList({ domain: 'feedback', fetcher: listFeedback, initialFilters: { status: 'pending', resolved: '', archived: '' } })
  const [rejectTarget, setRejectTarget] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [previewTarget, setPreviewTarget] = useState(null)

  const reviewMutation = useAdminMutation((id, payload) => reviewFeedback(id, payload), {
    successMessage: (result) => (result.data?.status === 'approved' ? 'Feedback approved' : result.data?.status === 'rejected' ? 'Feedback rejected' : 'Feedback updated'),
    invalidate: ['feedback'],
  })
  const archiveMutation = useAdminMutation((id, reason) => archiveFeedback(id, reason), { successMessage: 'Feedback archived', invalidate: ['feedback'] })

  const refreshAction = useMemo(
    () => (
      <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => list.refresh()} busy={list.isRefreshing} busyLabel="Refreshing…">
        Refresh
      </Button>
    ),
    [list]
  )
  useShellHeader({ actions: refreshAction })

  const busyFor = (id) => reviewMutation.busy && reviewMutation.busyKey === id

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} value={list.filters.status ?? ''} onChange={(key) => list.setFilter('status', key)} ariaLabel="Feedback status" />

      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search feedback', placeholder: 'Name or text…' }}
        filters={[
          { key: 'resolved', label: 'Resolution', type: 'select', value: list.filters.resolved, onChange: (value) => list.setFilter('resolved', value), options: [{ value: 'resolved', label: 'Resolved' }, { value: 'open', label: 'Open' }], placeholder: 'Any' },
          { key: 'archived', label: 'Show', type: 'select', value: list.filters.archived, onChange: (value) => list.setFilter('archived', value), options: [{ value: 'archived', label: 'Archived only' }], placeholder: 'Active feedback' },
        ]}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="entries"
      />

      {list.isLoading ? (
        <div className="ui-card p-6" aria-busy="true">
          <SkeletonRows rows={4} cols={3} />
        </div>
      ) : list.status === 'error' || list.status === 'permission-denied' ? (
        <InlineAlert variant={list.error?.permissionDenied ? 'permission' : 'danger'} action={list.error?.permissionDenied ? null : { label: 'Try again', onClick: list.retry }}>
          {list.error?.message}
        </InlineAlert>
      ) : list.items.length === 0 ? (
        <EmptyState title="No feedback here" description={list.filters.status === 'pending' ? 'Nothing is waiting for review.' : 'Try another tab or clear the search.'} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-busy={list.isRefreshing || undefined}>
          {list.items.map((item) => (
            <li key={item.id} className="ui-card flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-ink">{item.name}</h3>
                  <p className="text-caption text-muted">{formatDate(item.created_at)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={item.status} />
                  <Badge variant={item.is_resolved ? 'success' : 'neutral'}>{item.is_resolved ? 'Resolved' : 'Open'}</Badge>
                  {item.status === 'approved' && item.is_public ? <Badge variant="brand">Visible on homepage</Badge> : null}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{item.feedback}</p>
              {item.rejection_reason ? <p className="ui-note ui-note-danger text-sm">Rejected: {item.rejection_reason}</p> : null}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                {item.status !== 'approved' ? (
                  <Button size="sm" variant="primary" icon={<FiCheck />} busy={busyFor(item.id)} onClick={() => void reviewMutation.run(item.id, { status: 'approved' })}>
                    Approve
                  </Button>
                ) : null}
                {item.status !== 'rejected' ? (
                  <Button size="sm" variant="danger-outline" icon={<FiX />} onClick={() => setRejectTarget(item)}>
                    Reject
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => void reviewMutation.run(item.id, { isResolved: !item.is_resolved })} busy={busyFor(item.id)}>
                  {item.is_resolved ? 'Reopen' : 'Mark resolved'}
                </Button>
                {item.status === 'approved' ? (
                  <label className="ml-auto flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" role="switch" aria-checked={Boolean(item.is_public)} className="h-5 w-5 accent-brand" checked={Boolean(item.is_public)} onChange={(event) => void reviewMutation.run(item.id, { isPublic: event.target.checked })} />
                    Show on homepage
                  </label>
                ) : null}
                <Button size="sm" variant="ghost" icon={<FiEye />} onClick={() => setPreviewTarget(item)}>
                  Preview
                </Button>
                <Button size="sm" variant="ghost" iconOnly aria-label={`Archive feedback from ${item.name}`} onClick={() => setArchiveTarget(item)}>
                  <FiArchive />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />

      <ReasonDialog
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        decision="reject"
        title="Reject this feedback?"
        description="Rejected feedback is hidden from the homepage."
        subject={rejectTarget ? <p className="line-clamp-3">“{rejectTarget.feedback}”</p> : null}
        busy={reviewMutation.busy}
        error={reviewMutation.error}
        showNote={false}
        onConfirm={async ({ reason }) => {
          const target = rejectTarget
          const result = await reviewMutation.run(target.id, { status: 'rejected', rejectionReason: reason })
          if (!result.error) setRejectTarget(null)
        }}
      />

      <Dialog open={Boolean(previewTarget)} onClose={() => setPreviewTarget(null)} title="Public preview" description="How this testimonial appears on the homepage." size="sm">
        {previewTarget ? (
          <figure className="ui-card p-5">
            <blockquote className="text-sm text-ink">“{previewTarget.feedback}”</blockquote>
            <figcaption className="mt-3 text-caption font-semibold text-muted">— {previewTarget.name}</figcaption>
          </figure>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={async () => {
          const target = archiveTarget
          setArchiveTarget(null)
          await archiveMutation.run(target.id, 'Archived from the feedback list')
        }}
        title="Archive this feedback?"
        description="Archived feedback is hidden from the homepage and the active list but kept for records."
        confirmLabel="Archive"
        busy={archiveMutation.busy}
        busyLabel="Archiving…"
      />
    </div>
  )
}

export default AdminFeedbackSection
