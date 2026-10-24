'use client'

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiDownload, FiRefreshCw } from 'react-icons/fi'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, exportAuditLogCsv, formatAuditAction, listAuditLog } from '../../../services/admin/auditLog'
import { formatRoleLabels } from '../../../lib/adminPermissions'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import { useEntityParam } from '../hooks/useEntityParam'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'
import Dialog from '../../ui/Dialog'
import EmptyState from '../../ui/EmptyState'
import FilterBar from '../../ui/FilterBar'
import KeyValueList, { diffItems } from '../../ui/KeyValueList'
import Pagination from '../../ui/Pagination'

const formatWhen = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

const ACTION_TONE = (action = '') => {
  if (/reject|soft_delete|blacklist$|set_active|archive|refund/.test(action)) return 'danger'
  if (/approve|unblacklist|set_featured|review/.test(action)) return 'success'
  if (/pricing|settings|set_roles/.test(action)) return 'warning'
  return 'neutral'
}

const entityMeta = (type) => AUDIT_ENTITY_TYPES.find((entry) => entry.value === type) || null

const entityHref = (row) => {
  const meta = entityMeta(row.entity_type)
  if (!meta?.tab || !row.entity_id) return null
  if (['pricing', 'site_settings'].includes(row.entity_type)) return `/admin/?tab=${meta.tab}`
  return `/admin/?tab=${meta.tab}&id=${encodeURIComponent(row.entity_id)}`
}

const shortId = (value) => (typeof value === 'string' && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value || '—')

const AdminAuditLogSection = () => {
  const list = useAdminList({
    domain: 'audit',
    fetcher: listAuditLog,
    initialPageSize: 50,
    initialFilters: { entityType: '', action: '', from: '', to: '' },
    cache: false,
  })
  const [selectedId, setSelectedId] = useEntityParam('entry')
  const [showRaw, setShowRaw] = useState(false)

  const exportMutation = useAdminMutation(() => exportAuditLogCsv({ filters: list.filters, search: list.search }), {
    successMessage: (result) => `Exported ${result.data?.rows ?? 0} audit rows${result.data?.truncated ? ' (first 5,000 only)' : ''}`,
    showAuditRef: false,
  })

  const headerActions = useMemo(
    () => (
      <>
        <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => list.refresh()} busy={list.isRefreshing} busyLabel="Refreshing…">
          Refresh
        </Button>
        <Button variant="secondary" icon={<FiDownload />} onClick={() => void exportMutation.run()} busy={exportMutation.busy} busyLabel="Exporting…" disabled={list.totalCount === 0}>
          Export CSV
        </Button>
      </>
    ),
    [list, exportMutation]
  )
  useShellHeader({ actions: headerActions })

  const selected = list.items.find((row) => String(row.id) === String(selectedId)) || null

  const columns = useMemo(
    () => [
      { key: 'created_at', header: 'When', render: (row) => <span className="whitespace-nowrap text-sm text-ink">{formatWhen(row.created_at)}</span> },
      {
        key: 'actor',
        header: 'Actor',
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.actor_name || row.actor_email || shortId(row.actor_id)}</p>
            <p className="truncate text-caption text-muted">{row.actor_roles?.length ? formatRoleLabels(row.actor_roles) : row.actor_email || 'Legacy admin'}</p>
          </div>
        ),
      },
      {
        key: 'action',
        header: 'Action',
        render: (row) => <Badge variant={ACTION_TONE(row.action)}>{formatAuditAction(row.action)}</Badge>,
      },
      {
        key: 'entity',
        header: 'Entity',
        render: (row) => {
          const href = entityHref(row)
          const label = `${entityMeta(row.entity_type)?.label || row.entity_type} · ${shortId(row.entity_id)}`
          return href ? (
            <Link className="text-sm text-brand hover:underline" to={href}>
              {label}
            </Link>
          ) : (
            <span className="text-sm text-ink">{label}</span>
          )
        },
      },
      { key: 'reason', header: 'Reason', hideBelow: 'lg', render: (row) => (row.reason ? <p className="line-clamp-2 max-w-sm text-sm text-ink">{row.reason}</p> : <span className="text-muted">—</span>) },
      { key: 'id', header: 'Ref', hideBelow: 'md', align: 'right', render: (row) => <span className="font-mono text-caption text-muted">#{row.id}</span> },
    ],
    []
  )

  const chips = []
  if (list.filters.entityType) chips.push({ key: 'entityType', label: `Entity: ${entityMeta(list.filters.entityType)?.label || list.filters.entityType}`, onRemove: () => list.setFilter('entityType', '') })
  if (list.filters.action) chips.push({ key: 'action', label: `Action: ${formatAuditAction(list.filters.action)}`, onRemove: () => list.setFilter('action', '') })
  if (list.filters.from) chips.push({ key: 'from', label: `From ${list.filters.from}`, onRemove: () => list.setFilter('from', '') })
  if (list.filters.to) chips.push({ key: 'to', label: `Until ${list.filters.to}`, onRemove: () => list.setFilter('to', '') })

  const diff = selected ? diffItems(selected.before || {}, selected.after || {}) : []

  return (
    <div className="space-y-4">
      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Entity ID', placeholder: 'Paste a listing, user or payment id…' }}
        filters={[
          { key: 'entityType', label: 'Entity', type: 'select', value: list.filters.entityType, onChange: (value) => list.setFilter('entityType', value), options: AUDIT_ENTITY_TYPES, placeholder: 'All entities' },
          { key: 'action', label: 'Action', type: 'select', value: list.filters.action, onChange: (value) => list.setFilter('action', value), options: AUDIT_ACTIONS.map((action) => ({ value: action, label: formatAuditAction(action) })), placeholder: 'All actions' },
          { key: 'from', label: 'From', type: 'date', value: list.filters.from, onChange: (value) => list.setFilter('from', value) },
          { key: 'to', label: 'Until', type: 'date', value: list.filters.to, onChange: (value) => list.setFilter('to', value) },
        ]}
        chips={chips}
        onClearAll={list.resetFilters}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="entries"
      />

      <DataTable
        caption="Admin audit log"
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
        onRetry={list.retry}
        empty={<EmptyState title="No audit entries match" description="Every admin action through the panel is recorded here. Try widening the date range." />}
        rowActions={(row) => (
          <Button size="sm" variant="secondary" onClick={() => setSelectedId(row.id)}>
            Details
          </Button>
        )}
        getRowLabel={(row) => `audit entry ${row.id}`}
        density="compact"
      />

      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} pageSizeOptions={[50, 100, 200]} />

      <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `${formatAuditAction(selected.action)} · #${selected.id}` : ''} size="xl" fullScreenOnMobile>
        {selected ? (
          <div className="space-y-5">
            <KeyValueList
              columns={2}
              items={[
                { key: 'when', label: 'When', value: formatWhen(selected.created_at) },
                { key: 'actor', label: 'Actor', value: `${selected.actor_name || selected.actor_email || shortId(selected.actor_id)}${selected.actor_roles?.length ? ` (${formatRoleLabels(selected.actor_roles)})` : ''}` },
                { key: 'entity', label: 'Entity', value: `${entityMeta(selected.entity_type)?.label || selected.entity_type} · ${selected.entity_id || '—'}` },
                { key: 'reason', label: 'Reason', value: selected.reason },
              ]}
            />
            {entityHref(selected) ? (
              <Link className="ui-btn ui-btn-secondary ui-btn-sm" to={entityHref(selected)}>
                Open {entityMeta(selected.entity_type)?.label?.toLowerCase() || 'entity'}
              </Link>
            ) : null}
            <section aria-labelledby="audit-diff-heading" className="space-y-2">
              <h3 id="audit-diff-heading" className="text-sm font-semibold text-ink">
                Changes
              </h3>
              {diff.length ? <KeyValueList diff items={diff} columns={2} /> : <p className="text-sm text-muted">No field-level differences were recorded for this entry.</p>}
            </section>
            {selected.metadata && Object.keys(selected.metadata).length ? (
              <KeyValueList items={Object.entries(selected.metadata).map(([key, value]) => ({ key, label: key.replace(/_/g, ' '), value: typeof value === 'object' ? JSON.stringify(value) : String(value) }))} columns={2} />
            ) : null}
            <div>
              <Button size="sm" variant="ghost" aria-expanded={showRaw} aria-controls="audit-raw" onClick={() => setShowRaw((value) => !value)}>
                {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
              </Button>
              {showRaw ? (
                <pre id="audit-raw" className="mt-2 max-h-72 overflow-auto rounded-[var(--radius-card)] bg-canvas p-3 text-caption text-ink">
                  {JSON.stringify({ before: selected.before, after: selected.after, metadata: selected.metadata }, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}

export default AdminAuditLogSection
