'use client'

import React, { useMemo, useState } from 'react'
import { FiRotateCcw } from 'react-icons/fi'
import { PRICING_DIFF_LABELS, flattenPricingSnapshot, listPricingVersions, rollbackPricingVersion } from '../../../services/admin/pricing'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmDialog from '../../ui/ConfirmDialog'
import DataTable from '../../ui/DataTable'
import Dialog from '../../ui/Dialog'
import EmptyState from '../../ui/EmptyState'
import KeyValueList, { diffItems } from '../../ui/KeyValueList'
import Pagination from '../../ui/Pagination'

const formatWhen = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

/**
 * Version history for credit pricing. Each row is compared with the version
 * published just before it (the next row in the newest-first list).
 */
const PricingVersionsCard = ({ onRolledBack = null }) => {
  const list = useAdminList({ domain: 'pricing-versions', fetcher: listPricingVersions, initialPageSize: 10, initialSort: { column: 'published_at', dir: 'desc' }, cache: false })
  const [viewing, setViewing] = useState(null)
  const [rollbackTarget, setRollbackTarget] = useState(null)

  const rollbackMutation = useAdminMutation((id) => rollbackPricingVersion(id), {
    successMessage: 'Pricing rolled back',
    invalidate: ['pricing', 'pricing-versions'],
    onSuccess: () => onRolledBack?.(),
  })

  const previousOf = (version) => {
    const index = list.items.findIndex((entry) => entry.id === version.id)
    return index >= 0 ? list.items[index + 1] || null : null
  }

  const changesFor = (version) => diffItems(flattenPricingSnapshot(previousOf(version)?.snapshot || {}), flattenPricingSnapshot(version.snapshot || {}), PRICING_DIFF_LABELS)

  const columns = useMemo(
    () => [
      {
        key: 'id',
        header: 'Version',
        render: (row) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-ink">v{row.id}</span>
            {row.is_rollback_of ? <Badge variant="warning">Rollback to v{row.is_rollback_of}</Badge> : null}
            {list.items[0]?.id === row.id && list.page === 1 ? <Badge variant="success">Live</Badge> : null}
          </span>
        ),
      },
      {
        key: 'published_at',
        header: 'Published',
        sortable: true,
        render: (row) => (
          <div className="min-w-0">
            <p className="text-sm text-ink">{formatWhen(row.published_at)}</p>
            <p className="truncate text-caption text-muted">{row.publisher?.name || row.publisher?.email || 'System'}</p>
          </div>
        ),
      },
      { key: 'note', header: 'Note', hideBelow: 'md', render: (row) => (row.note ? <p className="line-clamp-2 max-w-sm text-sm text-ink">{row.note}</p> : <span className="text-muted">—</span>) },
      {
        key: 'changes',
        header: 'Changes',
        hideBelow: 'lg',
        render: (row) => {
          const count = changesFor(row).length
          return <span className="text-sm text-muted">{previousOf(row) ? `${count} field${count === 1 ? '' : 's'}` : 'Initial snapshot'}</span>
        },
      },
    ],
    // changesFor/previousOf read list.items
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list.items, list.page]
  )

  const viewingDiff = viewing ? changesFor(viewing) : []
  const isLive = (row) => list.page === 1 && list.items[0]?.id === row.id

  return (
    <section aria-labelledby="pricing-versions-heading" className="ui-card space-y-4 p-5">
      <div>
        <h2 id="pricing-versions-heading" className="text-base font-semibold text-ink">
          Version history
        </h2>
        <p className="text-caption text-muted">Every publish is snapshotted. Rolling back publishes the old snapshot as a new version, so nothing is lost.</p>
      </div>
      <DataTable
        caption="Pricing versions"
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
        onRetry={list.retry}
        empty={<EmptyState title="No versions yet" description="The first publish from this panel creates the initial snapshot." />}
        sort={{ key: list.sort.column, direction: list.sort.dir }}
        onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
        rowActions={(row) => (
          <>
            <Button size="sm" variant="secondary" onClick={() => setViewing(row)}>
              View changes
            </Button>
            {!isLive(row) ? (
              <Button size="sm" variant="ghost" icon={<FiRotateCcw />} onClick={() => setRollbackTarget(row)}>
                Roll back
              </Button>
            ) : null}
          </>
        )}
        getRowLabel={(row) => `pricing version ${row.id}`}
        density="compact"
      />
      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} pageSizeOptions={[10, 20, 50]} />

      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing ? `Pricing version v${viewing.id}` : ''} size="lg" fullScreenOnMobile>
        {viewing ? (
          <div className="space-y-4">
            <KeyValueList
              columns={2}
              items={[
                { key: 'when', label: 'Published', value: formatWhen(viewing.published_at) },
                { key: 'by', label: 'By', value: viewing.publisher?.name || viewing.publisher?.email || 'System' },
                { key: 'note', label: 'Note', value: viewing.note },
                { key: 'rollback', label: 'Rollback of', value: viewing.is_rollback_of ? `v${viewing.is_rollback_of}` : null },
              ]}
            />
            <section aria-labelledby="pricing-diff-heading" className="space-y-2">
              <h3 id="pricing-diff-heading" className="text-sm font-semibold text-ink">
                {previousOf(viewing) ? `Changes since v${previousOf(viewing).id}` : 'Snapshot contents'}
              </h3>
              {previousOf(viewing) ? (
                viewingDiff.length ? (
                  <KeyValueList diff items={viewingDiff} />
                ) : (
                  <p className="text-sm text-muted">Identical to the previous version.</p>
                )
              ) : (
                <KeyValueList items={Object.entries(flattenPricingSnapshot(viewing.snapshot || {})).map(([key, value]) => ({ key, label: PRICING_DIFF_LABELS[key] || key, value }))} />
              )}
            </section>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(rollbackTarget)}
        onCancel={() => setRollbackTarget(null)}
        onConfirm={async () => {
          const target = rollbackTarget
          setRollbackTarget(null)
          await rollbackMutation.run(target.id)
        }}
        title={rollbackTarget ? `Roll back to v${rollbackTarget.id}?` : ''}
        description="Package prices, credit amounts and unlock costs will be reset to this snapshot. Buyers see the new prices immediately."
        confirmLabel="Roll back"
        tone="danger"
        busy={rollbackMutation.busy}
        busyLabel="Rolling back…"
      />
    </section>
  )
}

export default PricingVersionsCard
