'use client'

import React, { useMemo, useState } from 'react'
import { FiArchive, FiCalendar, FiRefreshCw } from 'react-icons/fi'
import { listInquiries, updateInquiry, archiveInquiry } from '../../../services/admin/inquiries'
import { getStatusOptions } from '../../../lib/adminStatusTransitions'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import { useEntityParam } from '../hooks/useEntityParam'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmDialog from '../../ui/ConfirmDialog'
import DataTable from '../../ui/DataTable'
import Dialog from '../../ui/Dialog'
import EmptyState from '../../ui/EmptyState'
import FilterBar from '../../ui/FilterBar'
import FormDialog from '../../ui/FormDialog'
import KeyValueList from '../../ui/KeyValueList'
import Pagination from '../../ui/Pagination'
import StatusPill from '../../ui/StatusPill'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const isOverdue = (inquiry) => inquiry.follow_up_at && new Date(inquiry.follow_up_at) < new Date() && !['resolved', 'closed'].includes(inquiry.status)

const STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const AdminInquiriesSection = () => {
  const list = useAdminList({ domain: 'inquiries', fetcher: listInquiries, initialFilters: { status: '', overdue: '', archived: '' } })
  const [selectedId, setSelectedId] = useEntityParam('id')
  const [followUpTarget, setFollowUpTarget] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)

  const statusMutation = useAdminMutation((id, status) => updateInquiry(id, { status }), { successMessage: 'Inquiry status updated', invalidate: ['inquiries'] })
  const followUpMutation = useAdminMutation((id, payload) => updateInquiry(id, payload), { successMessage: 'Follow-up saved', invalidate: ['inquiries'] })
  const archiveMutation = useAdminMutation((id, reason) => archiveInquiry(id, reason), { successMessage: 'Inquiry archived', invalidate: ['inquiries'] })

  const refreshAction = useMemo(
    () => (
      <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => list.refresh()} busy={list.isRefreshing} busyLabel="Refreshing…">
        Refresh
      </Button>
    ),
    [list]
  )
  useShellHeader({ actions: refreshAction })

  const selected = list.items.find((inquiry) => inquiry.id === selectedId) || null

  const columns = useMemo(
    () => [
      {
        key: 'inquirer',
        header: 'From',
        render: (inquiry) => (
          <div className="min-w-0">
            <p className="font-medium text-ink">{inquiry.name}</p>
            <p className="text-caption text-muted">
              {inquiry.phone ? <a className="hover:underline" href={`tel:${inquiry.phone}`}>{inquiry.phone}</a> : null}
              {inquiry.phone && inquiry.email ? ' · ' : ''}
              {inquiry.email ? <a className="hover:underline" href={`mailto:${inquiry.email}`}>{inquiry.email}</a> : null}
            </p>
          </div>
        ),
      },
      {
        key: 'listing',
        header: 'Listing',
        hideBelow: 'lg',
        render: (inquiry) =>
          inquiry.properties ? (
            <div className="min-w-0">
              <p className="text-sm text-ink">{inquiry.properties.category} in {inquiry.properties.area}</p>
              <p className="text-caption text-muted">{inquiry.properties.state_district}{inquiry.properties.property_id_number ? ` · ID ${inquiry.properties.property_id_number}` : ''}</p>
            </div>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      { key: 'message', header: 'Message', render: (inquiry) => <p className="line-clamp-2 max-w-md text-sm text-ink">{inquiry.message}</p> },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (inquiry) => (
          <label className="block">
            <span className="sr-only">Status for inquiry from {inquiry.name}</span>
            <select
              className="ui-field h-10 min-h-0 py-1 text-sm"
              value={inquiry.status || 'pending'}
              disabled={statusMutation.busy && statusMutation.busyKey === inquiry.id}
              onChange={(event) => void statusMutation.run(inquiry.id, event.target.value)}
            >
              {getStatusOptions('inquiry', inquiry.status || 'pending').map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ),
      },
      {
        key: 'follow_up_at',
        header: 'Follow-up',
        sortable: true,
        render: (inquiry) =>
          inquiry.follow_up_at ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {formatDate(inquiry.follow_up_at)}
              {isOverdue(inquiry) ? <Badge variant="danger">Overdue</Badge> : null}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      { key: 'created_at', header: 'Received', sortable: true, hideBelow: 'lg', render: (inquiry) => formatDate(inquiry.created_at) },
    ],
    [statusMutation]
  )

  const rowActions = (inquiry) => (
    <>
      <Button size="sm" variant="secondary" onClick={() => setSelectedId(inquiry.id)}>
        Details
      </Button>
      <Button size="sm" variant="ghost" icon={<FiCalendar />} onClick={() => setFollowUpTarget(inquiry)}>
        Follow-up
      </Button>
      <Button size="sm" variant="ghost" iconOnly aria-label={`Archive inquiry from ${inquiry.name}`} onClick={() => setArchiveTarget(inquiry)}>
        <FiArchive />
      </Button>
    </>
  )

  const chips = []
  if (list.filters.status) chips.push({ key: 'status', label: `Status: ${STATUS_FILTER_OPTIONS.find((o) => o.value === list.filters.status)?.label}`, onRemove: () => list.setFilter('status', '') })
  if (list.filters.overdue) chips.push({ key: 'overdue', label: 'Overdue follow-ups', onRemove: () => list.setFilter('overdue', '') })
  if (list.filters.archived) chips.push({ key: 'archived', label: 'Archived inquiries', onRemove: () => list.setFilter('archived', '') })

  return (
    <div className="space-y-4">
      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search inquiries', placeholder: 'Name, phone, email or message…' }}
        filters={[
          { key: 'status', label: 'Status', type: 'select', value: list.filters.status, onChange: (value) => list.setFilter('status', value), options: STATUS_FILTER_OPTIONS, placeholder: 'All statuses' },
          { key: 'overdue', label: 'Follow-up', type: 'select', value: list.filters.overdue, onChange: (value) => list.setFilter('overdue', value), options: [{ value: 'overdue', label: 'Overdue only' }], placeholder: 'Any' },
          { key: 'archived', label: 'Show', type: 'select', value: list.filters.archived, onChange: (value) => list.setFilter('archived', value), options: [{ value: 'archived', label: 'Archived only' }], placeholder: 'Active inquiries' },
        ]}
        chips={chips}
        onClearAll={list.resetFilters}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="inquiries"
      />

      <DataTable
        caption="Property inquiries"
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
        onRetry={list.retry}
        empty={<EmptyState title="No inquiries match" description="Try clearing the filters or search." />}
        rowActions={rowActions}
        sort={{ key: list.sort.column, direction: list.sort.dir }}
        onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
        getRowLabel={(inquiry) => `inquiry from ${inquiry.name}`}
      />

      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />

      <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `Inquiry from ${selected.name}` : ''} size="lg" fullScreenOnMobile>
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selected.status} />
              {isOverdue(selected) ? <Badge variant="danger">Follow-up overdue</Badge> : null}
            </div>
            <KeyValueList
              columns={2}
              items={[
                { key: 'phone', label: 'Phone', value: selected.phone },
                { key: 'email', label: 'Email', value: selected.email },
                { key: 'listing', label: 'Listing', value: selected.properties ? `${selected.properties.category} in ${selected.properties.area}, ${selected.properties.state_district}` : null },
                { key: 'pid', label: 'Listing ID', value: selected.properties?.property_id_number },
                { key: 'received', label: 'Received', value: formatDate(selected.created_at) },
                { key: 'follow', label: 'Follow-up', value: selected.follow_up_at ? formatDate(selected.follow_up_at) : null },
                { key: 'note', label: 'Internal note', value: selected.admin_note },
              ]}
            />
            <div>
              <h3 className="text-sm font-semibold text-ink">Message</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{selected.message}</p>
            </div>
          </div>
        ) : null}
      </Dialog>

      <FollowUpDialog inquiry={followUpTarget} onClose={() => setFollowUpTarget(null)} mutation={followUpMutation} />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={async () => {
          const target = archiveTarget
          setArchiveTarget(null)
          await archiveMutation.run(target.id, 'Archived from the inquiries list')
        }}
        title="Archive this inquiry?"
        description="Archived inquiries are hidden from the active list but kept for records. Nothing is deleted."
        confirmLabel="Archive"
        busy={archiveMutation.busy}
        busyLabel="Archiving…"
      />
    </div>
  )
}

const FollowUpDialog = ({ inquiry, onClose, mutation }) => {
  const [draft, setDraft] = useState({ followUpAt: '', note: '' })
  const [key, setKey] = useState(null)
  if (inquiry && key !== inquiry.id) {
    setKey(inquiry.id)
    setDraft({ followUpAt: inquiry.follow_up_at ? inquiry.follow_up_at.slice(0, 10) : '', note: inquiry.admin_note || '' })
  }
  return (
    <FormDialog
      open={Boolean(inquiry)}
      onClose={onClose}
      title="Follow-up and notes"
      description="Set a follow-up date and keep internal notes for this inquiry."
      submitLabel="Save"
      busy={mutation.busy}
      error={mutation.error}
      onSubmit={async () => {
        const result = await mutation.run(inquiry.id, {
          followUpAt: draft.followUpAt ? new Date(`${draft.followUpAt}T09:00:00`).toISOString() : null,
          clearFollowUp: !draft.followUpAt,
          note: draft.note.trim() || null,
        })
        if (!result.error) onClose()
      }}
    >
      <div>
        <label className="ui-label" htmlFor="inquiry-follow-up">Follow-up date</label>
        <input id="inquiry-follow-up" type="date" className="ui-field" value={draft.followUpAt} onChange={(event) => setDraft({ ...draft, followUpAt: event.target.value })} />
        <p className="ui-help">Leave empty to clear the follow-up.</p>
      </div>
      <div>
        <label className="ui-label" htmlFor="inquiry-note">Internal note</label>
        <textarea id="inquiry-note" className="ui-field" rows={3} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
        <p className="ui-help">Only visible to admins.</p>
      </div>
    </FormDialog>
  )
}

export default AdminInquiriesSection
