'use client'

import React, { useMemo, useState } from 'react'
import { FiCheck, FiEye, FiRefreshCw, FiX } from 'react-icons/fi'
import { listVerifications, reviewVerification } from '../../../services/admin/trust'
import { getIdDocumentLinks } from '../../../services/verificationService'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import Button from '../../ui/Button'
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

/**
 * Owner ID verification queue. Approving sets users.verified, which shows a "Verified owner"
 * badge on every listing of that owner. ID images live in a private bucket and open through
 * 10-minute signed links.
 */
const AdminVerificationsSection = () => {
  const list = useAdminList({ domain: 'verifications', fetcher: listVerifications, initialFilters: { status: 'pending' } })
  const [rejectTarget, setRejectTarget] = useState(null)
  const [viewer, setViewer] = useState({ open: false, item: null, links: [], error: '', loading: false })

  const reviewMutation = useAdminMutation((id, payload) => reviewVerification(id, payload), {
    successMessage: (result) => (result.data?.status === 'approved' ? 'Owner verified' : 'Verification rejected'),
    invalidate: ['verifications'],
  })

  const refreshAction = useMemo(
    () => (
      <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => list.refresh()} busy={list.isRefreshing} busyLabel="Refreshing…">
        Refresh
      </Button>
    ),
    [list]
  )
  useShellHeader({ actions: refreshAction })

  const openDocuments = async (item) => {
    setViewer({ open: true, item, links: [], error: '', loading: true })
    try {
      const links = await getIdDocumentLinks([item.front_image_url, item.back_image_url])
      setViewer({ open: true, item, links, error: links.length ? '' : 'The ID images could not be found.', loading: false })
    } catch (error) {
      setViewer({ open: true, item, links: [], error: error.message || 'Could not open the ID images.', loading: false })
    }
  }

  const busyFor = (id) => reviewMutation.busy && reviewMutation.busyKey === id

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} value={list.filters.status ?? ''} onChange={(key) => list.setFilter('status', key)} ariaLabel="Verification status" />

      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search verifications', placeholder: 'ID type…' }}
        filters={[]}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="requests"
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
        <EmptyState title="No verification requests here" description={list.filters.status === 'pending' ? 'Nothing is waiting for review.' : 'Try another tab.'} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-busy={list.isRefreshing || undefined}>
          {list.items.map((item) => (
            <li key={item.id} className="ui-card flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-ink">{item.users?.name || 'Unknown owner'}</h3>
                  <p className="text-caption text-muted">{[item.users?.email, item.users?.phone].filter(Boolean).join(' · ') || item.user_id}</p>
                  <p className="mt-1 text-caption text-muted">
                    {item.id_type} · submitted {formatDate(item.submitted_at)}
                    {item.reviewed_at ? ` · reviewed ${formatDate(item.reviewed_at)}` : ''}
                  </p>
                </div>
                <StatusPill status={item.verification_status} />
              </div>
              {item.admin_notes ? <p className="ui-note text-sm">Note: {item.admin_notes}</p> : null}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <Button size="sm" variant="secondary" icon={<FiEye />} onClick={() => void openDocuments(item)}>
                  View ID
                </Button>
                {item.verification_status !== 'approved' ? (
                  <Button size="sm" variant="primary" icon={<FiCheck />} busy={busyFor(item.id)} onClick={() => void reviewMutation.run(item.id, { approve: true })}>
                    Approve
                  </Button>
                ) : null}
                {item.verification_status !== 'rejected' ? (
                  <Button size="sm" variant="danger-outline" icon={<FiX />} onClick={() => setRejectTarget(item)}>
                    {item.verification_status === 'approved' ? 'Revoke' : 'Reject'}
                  </Button>
                ) : null}
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
        title="Reject this verification?"
        description="The owner sees this reason and can submit new ID images. The Verified owner badge is removed."
        busy={reviewMutation.busy}
        error={reviewMutation.error}
        showNote={false}
        onConfirm={async ({ reason }) => {
          const target = rejectTarget
          const result = await reviewMutation.run(target.id, { approve: false, note: reason })
          if (!result.error) setRejectTarget(null)
        }}
      />

      <Dialog
        open={viewer.open}
        onClose={() => setViewer({ open: false, item: null, links: [], error: '', loading: false })}
        title="ID documents"
        description="Links expire after 10 minutes. Do not download or share these images."
        size="lg"
      >
        {viewer.loading ? <p className="text-sm text-muted" role="status">Loading…</p> : null}
        {viewer.error ? <InlineAlert variant="danger">{viewer.error}</InlineAlert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {viewer.links.map((url, index) => (
            <figure key={url} className="space-y-2">
              <img src={url} alt={index === 0 ? 'ID front' : 'ID back'} className="w-full rounded-lg border border-line object-contain" />
              <figcaption className="text-caption text-muted">{index === 0 ? 'Front' : 'Back'}</figcaption>
            </figure>
          ))}
        </div>
      </Dialog>
    </div>
  )
}

export default AdminVerificationsSection
