'use client'

import React, { useMemo } from 'react'
import { FiCheck, FiExternalLink, FiEdit2, FiRefreshCw, FiX } from 'react-icons/fi'
import { listReports, setReportStatus } from '../../../services/admin/trust'
import { buildAdminEditPropertyHref, buildListDetailsHref } from '../../../lib/routePaths'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import EmptyState from '../../ui/EmptyState'
import FilterBar from '../../ui/FilterBar'
import InlineAlert from '../../ui/InlineAlert'
import Pagination from '../../ui/Pagination'
import { SkeletonRows } from '../../ui/Skeleton'
import StatusPill from '../../ui/StatusPill'
import Tabs from '../../ui/Tabs'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

const TABS = [
  { key: 'pending', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: '', label: 'All' },
]

/**
 * Reports submitted from listing cards and detail pages ("Report this listing"). Resolve after
 * fixing or removing the listing in the Properties tab; dismiss when nothing was wrong.
 */
const AdminReportsSection = () => {
  const list = useAdminList({ domain: 'reports', fetcher: listReports, initialFilters: { status: 'pending' } })
  const statusMutation = useAdminMutation((id, status) => setReportStatus(id, status), {
    successMessage: (result) => (result.data?.status === 'resolved' ? 'Report resolved' : result.data?.status === 'dismissed' ? 'Report dismissed' : 'Report reopened'),
    invalidate: ['reports'],
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

  const busyFor = (id) => statusMutation.busy && statusMutation.busyKey === id

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} value={list.filters.status ?? ''} onChange={(key) => list.setFilter('status', key)} ariaLabel="Report status" />

      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search reports', placeholder: 'Reason or message…' }}
        filters={[]}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="reports"
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
        <EmptyState title="No reports here" description={list.filters.status === 'pending' ? 'No open reports.' : 'Try another tab.'} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-busy={list.isRefreshing || undefined}>
          {list.items.map((item) => {
            const property = item.properties || {}
            return (
              <li key={item.id} className="ui-card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ink">{item.reason}</h3>
                    <p className="text-caption text-muted">
                      {formatDate(item.created_at)} · Property {property.property_id_number || item.property_id}
                      {property.category ? ` · ${property.category}` : ''}
                      {property.area || property.state_district ? ` · ${[property.area, property.state_district].filter(Boolean).join(', ')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={item.status === 'pending' ? 'pending' : item.status === 'resolved' ? 'approved' : 'rejected'} />
                    {property.status && property.status !== 'approved' ? <Badge variant="neutral">Listing {property.status}</Badge> : null}
                    {property.is_active === false ? <Badge variant="neutral">Listing inactive</Badge> : null}
                  </div>
                </div>
                {item.message ? <p className="whitespace-pre-wrap text-sm text-ink">{item.message}</p> : null}
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <a className="ui-btn ui-btn-ghost ui-btn-sm" href={buildListDetailsHref(item.property_id)} target="_blank" rel="noopener noreferrer">
                    <FiExternalLink aria-hidden="true" /> Open listing
                  </a>
                  <a className="ui-btn ui-btn-secondary ui-btn-sm" href={buildAdminEditPropertyHref(item.property_id)}>
                    <FiEdit2 aria-hidden="true" /> Edit listing
                  </a>
                  {item.status !== 'resolved' ? (
                    <Button size="sm" variant="primary" icon={<FiCheck />} busy={busyFor(item.id)} onClick={() => void statusMutation.run(item.id, 'resolved')}>
                      Resolve
                    </Button>
                  ) : null}
                  {item.status === 'pending' ? (
                    <Button size="sm" variant="ghost" icon={<FiX />} busy={busyFor(item.id)} onClick={() => void statusMutation.run(item.id, 'dismissed')}>
                      Dismiss
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" busy={busyFor(item.id)} onClick={() => void statusMutation.run(item.id, 'pending')}>
                      Reopen
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
    </div>
  )
}

export default AdminReportsSection
