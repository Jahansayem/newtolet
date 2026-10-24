'use client'

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiCheck, FiExternalLink, FiRefreshCw, FiX } from 'react-icons/fi'
import { buildListDetailsHref } from '../../lib/routePaths'
import { listRefundRequests, reviewRefundRequest } from '../../services/admin/refunds'
import { getPropertyDisplayLabel } from '../../utils/propertyDisplaySerial'
import { useAdminPermissions } from '../../contexts/AdminAccessContext'
import { PERMISSIONS } from '../../lib/adminPermissions'
import { useShellHeader } from '../../components/panel/PanelShellContext'
import { useAdminList } from '../../components/admin-panel/hooks/useAdminList'
import { useAdminMutation } from '../../components/admin-panel/hooks/useAdminMutation'
import { useEntityParam } from '../../components/admin-panel/hooks/useEntityParam'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import Dialog from '../../components/ui/Dialog'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import InlineAlert from '../../components/ui/InlineAlert'
import KeyValueList from '../../components/ui/KeyValueList'
import Pagination from '../../components/ui/Pagination'
import ReasonDialog from '../../components/ui/ReasonDialog'
import StatusPill from '../../components/ui/StatusPill'
import Tabs from '../../components/ui/Tabs'

const REASON_LABELS = { rented_out: 'Already rented out', unreachable: 'Phone unreachable', wrong_location: 'Wrong location', other: 'Other' }
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

const TABS = [
  { key: 'requested', label: 'Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
]

const ContactUnlockRefundReview = () => {
  const { hasPermission } = useAdminPermissions()
  const canReview = hasPermission(PERMISSIONS.REFUNDS_REVIEW)
  const list = useAdminList({ domain: 'refunds', fetcher: listRefundRequests, initialSort: { column: 'requested_at', dir: 'desc' }, initialFilters: { status: 'requested', reasonCode: '' } })
  const [selectedId, setSelectedId] = useEntityParam('id')
  const [decision, setDecision] = useState(null) // { request, status }

  const reviewMutation = useAdminMutation((id, status, note) => reviewRefundRequest(id, status, note), {
    successMessage: (result, _id, status) => (status === 'approved' ? 'Refund approved and credits restored' : 'Refund request rejected'),
    invalidate: ['refunds', 'users'],
  })

  const headerActions = useMemo(
    () => (
      <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => list.refresh()} busy={list.isRefreshing} busyLabel="Refreshing…">
        Refresh
      </Button>
    ),
    [list]
  )
  useShellHeader({ actions: headerActions })

  const selected = list.items.find((request) => request.id === selectedId) || null

  const columns = useMemo(
    () => [
      {
        key: 'property',
        header: 'Listing',
        render: (request) => (
          <div className="min-w-0">
            <p className="font-medium text-ink">{request.property?.category || 'Property'}</p>
            <p className="text-caption text-muted">{getPropertyDisplayLabel(request.property)} · {[request.property?.area, request.property?.state_district].filter(Boolean).join(', ')}</p>
          </div>
        ),
      },
      {
        key: 'user',
        header: 'User',
        render: (request) => (
          <div className="min-w-0">
            <p className="font-medium text-ink">{request.user?.name || 'Unknown'}</p>
            <p className="truncate text-caption text-muted">{request.user?.email || request.user?.phone || '—'}</p>
          </div>
        ),
      },
      { key: 'reason_code', header: 'Reason', render: (request) => <Badge variant="neutral">{REASON_LABELS[request.reason_code] || request.reason_code}</Badge> },
      { key: 'credits', header: 'Credits', align: 'right', render: (request) => Number(request.contact_view?.credits_spent || 0) },
      { key: 'status', header: 'Status', sortable: true, render: (request) => <StatusPill status={request.status} /> },
      { key: 'requested_at', header: 'Requested', sortable: true, hideBelow: 'lg', render: (request) => formatDateTime(request.requested_at) },
    ],
    []
  )

  const rowActions = (request) => (
    <>
      <Button size="sm" variant="secondary" onClick={() => setSelectedId(request.id)}>
        Details
      </Button>
      {canReview && request.status === 'requested' ? (
        <>
          <Button size="sm" variant="primary" icon={<FiCheck />} onClick={() => setDecision({ request, status: 'approved' })}>
            Approve
          </Button>
          <Button size="sm" variant="danger-outline" icon={<FiX />} onClick={() => setDecision({ request, status: 'rejected' })}>
            Reject
          </Button>
        </>
      ) : null}
    </>
  )

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} value={list.filters.status ?? ''} onChange={(key) => list.setFilter('status', key)} ariaLabel="Refund request status" />

      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search refund requests', placeholder: 'Details or admin note…' }}
        filters={[{ key: 'reasonCode', label: 'Reason', type: 'select', value: list.filters.reasonCode, onChange: (value) => list.setFilter('reasonCode', value), options: Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label })), placeholder: 'All reasons' }]}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="requests"
      />

      {!canReview ? <InlineAlert variant="info">You can view refund requests. Approving or rejecting needs the finance role.</InlineAlert> : null}

      <DataTable
        caption="Contact unlock refund requests"
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
        onRetry={list.retry}
        empty={<EmptyState title="No refund requests" description={list.filters.status === 'requested' ? 'Nothing is waiting for review.' : 'Try another tab.'} />}
        rowActions={rowActions}
        sort={{ key: list.sort.column, direction: list.sort.dir }}
        onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
        getRowLabel={(request) => `refund request from ${request.user?.name || 'user'}`}
      />

      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />

      <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} title="Refund request" size="lg" fullScreenOnMobile>
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selected.status} />
              <Badge variant="neutral">{REASON_LABELS[selected.reason_code] || selected.reason_code}</Badge>
            </div>
            <KeyValueList
              columns={2}
              items={[
                { key: 'listing', label: 'Listing', value: `${selected.property?.category || 'Property'} · ${getPropertyDisplayLabel(selected.property)}` },
                { key: 'location', label: 'Location', value: [selected.property?.area, selected.property?.state_district].filter(Boolean).join(', ') },
                { key: 'user', label: 'User', value: selected.user?.name },
                { key: 'email', label: 'Email', value: selected.user?.email },
                { key: 'phone', label: 'Phone', value: selected.user?.phone },
                { key: 'unlocked', label: 'Unlocked', value: formatDateTime(selected.contact_view?.viewed_at) },
                { key: 'spent', label: 'Credits spent', value: Number(selected.contact_view?.credits_spent || 0) },
                { key: 'requested', label: 'Requested', value: formatDateTime(selected.requested_at) },
                { key: 'reviewed', label: 'Reviewed', value: selected.reviewed_at ? formatDateTime(selected.reviewed_at) : null },
                { key: 'restored', label: 'Credits restored', value: selected.credits_restored },
                { key: 'note', label: 'Admin note', value: selected.admin_note },
              ]}
            />
            {selected.details ? (
              <div>
                <h3 className="text-sm font-semibold text-ink">User's explanation</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{selected.details}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Link to={buildListDetailsHref(selected.property?.id || selected.property_id)} className="ui-btn ui-btn-secondary" target="_blank" rel="noopener">
                <FiExternalLink aria-hidden="true" /> Open listing
              </Link>
              {canReview && selected.status === 'requested' ? (
                <>
                  <Button variant="primary" icon={<FiCheck />} onClick={() => setDecision({ request: selected, status: 'approved' })}>
                    Approve and restore credits
                  </Button>
                  <Button variant="danger-outline" icon={<FiX />} onClick={() => setDecision({ request: selected, status: 'rejected' })}>
                    Reject
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>

      <ReasonDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        decision={decision?.status === 'approved' ? 'approve' : 'reject'}
        title={decision?.status === 'approved' ? 'Approve this refund?' : 'Reject this refund?'}
        description={decision?.status === 'approved' ? `${Number(decision?.request.contact_view?.credits_spent || 0)} credits will be returned to the user.` : 'The user keeps the unlock and no credits are returned.'}
        subject={decision ? <p>{decision.request.user?.name || 'User'} · {REASON_LABELS[decision.request.reason_code] || decision.request.reason_code}</p> : null}
        reasonLabel="Admin note"
        reasonHelp="Shown to the user with the decision."
        reasonRequired={decision?.status === 'rejected'}
        showNote={false}
        busy={reviewMutation.busy}
        error={reviewMutation.error}
        onConfirm={async ({ reason }) => {
          const { request, status } = decision
          const result = await reviewMutation.run(request.id, status, reason || '')
          if (!result.error) {
            setDecision(null)
            setSelectedId(null)
          }
        }}
      />
    </div>
  )
}

export default ContactUnlockRefundReview
