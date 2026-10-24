'use client'

import React, { useMemo, useState } from 'react'
import { FiCheckCircle, FiCopy, FiDownload, FiRefreshCw, FiRotateCcw, FiXCircle } from 'react-icons/fi'
import { approvePayment, exportPaymentsCsv, listPayments, refundPayment, reviewPayment } from '../../services/admin/payments'
import { PAYMENT_STATUSES } from '../../lib/paymentStatus'
import { getStatusLabel } from '../../lib/adminStatusTransitions'
import { useAdminPermissions } from '../../contexts/AdminAccessContext'
import { PERMISSIONS } from '../../lib/adminPermissions'
import { useShellHeader } from '../../components/panel/PanelShellContext'
import { useAdminList } from '../../components/admin-panel/hooks/useAdminList'
import { useAdminMutation } from '../../components/admin-panel/hooks/useAdminMutation'
import { useEntityParam } from '../../components/admin-panel/hooks/useEntityParam'
import { useToast } from '../../components/ui/ToastProvider'
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

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const formatAmount = (value) => `৳${Number(value || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const TABS = [
  { key: 'awaiting_admin_approval', label: 'Awaiting approval' },
  { key: '', label: 'All' },
  { key: 'credited', label: 'Credited' },
  { key: 'failed', label: 'Failed' },
]

const PaymentMonitoring = () => {
  const { hasPermission } = useAdminPermissions()
  const canReview = hasPermission(PERMISSIONS.PAYMENTS_REVIEW)
  const toast = useToast()
  const list = useAdminList({ domain: 'payments', fetcher: listPayments, initialFilters: { status: 'awaiting_admin_approval', dateRange: null } })
  const [selectedId, setSelectedId] = useEntityParam('id')
  const [decision, setDecision] = useState(null) // { payment, kind: 'reject'|'refund' }
  const [exporting, setExporting] = useState(false)

  const approveMutation = useAdminMutation((id) => approvePayment(id), { successMessage: 'Payment approved and credits granted', invalidate: ['payments', 'users'] })
  const reviewMutation = useAdminMutation((id, kind, reason) => (kind === 'refund' ? refundPayment(id, reason) : reviewPayment(id, kind, reason)), {
    successMessage: (result) => `Payment ${getStatusLabel('payment', result.data?.status).toLowerCase()}`,
    invalidate: ['payments', 'users'],
  })

  const handleExport = async () => {
    setExporting(true)
    const result = await exportPaymentsCsv({ filters: list.filters, search: list.search, sort: list.sort })
    setExporting(false)
    if (result.error && !result.data) toast.error('Export failed', { description: result.error.message })
    else toast.success(`Exported ${result.data.rows} payments${result.data.truncated ? ' (first 5,000)' : ''}`)
  }

  const headerActions = useMemo(
    () => (
      <>
        <Button variant="secondary" icon={<FiDownload />} onClick={handleExport} busy={exporting} busyLabel="Exporting…">
          Export CSV
        </Button>
        <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => list.refresh()} busy={list.isRefreshing} busyLabel="Refreshing…">
          Refresh
        </Button>
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exporting, list.isRefreshing, list.filters, list.search, list.sort]
  )
  useShellHeader({ actions: headerActions })

  const selected = list.items.find((payment) => payment.id === selectedId) || null

  const copyId = async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.info('Transaction id copied')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'transaction_id',
        header: 'Transaction',
        render: (payment) => (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-ink">{String(payment.transaction_id || '').slice(0, 12)}</span>
            <Button size="sm" variant="ghost" iconOnly aria-label={`Copy transaction id ${payment.transaction_id}`} onClick={() => copyId(payment.transaction_id)} className="h-8 w-8 min-h-0">
              <FiCopy />
            </Button>
          </div>
        ),
      },
      {
        key: 'buyer',
        header: 'User',
        render: (payment) => (
          <div className="min-w-0">
            <p className="font-medium text-ink">{payment.buyer?.name || 'Unknown'}</p>
            <p className="truncate text-caption text-muted">{payment.buyer?.email || payment.customer_phone || '—'}</p>
          </div>
        ),
      },
      { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (payment) => <span className="font-semibold">{formatAmount(payment.amount)}</span> },
      { key: 'credits_to_add', header: 'Credits', align: 'right', hideBelow: 'lg', render: (payment) => payment.credits_to_add },
      { key: 'payment_method', header: 'Method', hideBelow: 'lg', render: (payment) => <span className="capitalize">{payment.payment_method || payment.provider || '—'}</span> },
      { key: 'status', header: 'Status', sortable: true, render: (payment) => <StatusPill status={payment.status} /> },
      { key: 'created_at', header: 'Date', sortable: true, hideBelow: 'lg', render: (payment) => formatDateTime(payment.created_at) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const rowActions = (payment) => (
    <>
      <Button size="sm" variant="secondary" onClick={() => setSelectedId(payment.id)}>
        Details
      </Button>
      {canReview && payment.status === 'awaiting_admin_approval' ? (
        <Button size="sm" variant="primary" icon={<FiCheckCircle />} busy={approveMutation.busy && approveMutation.busyKey === payment.id} busyLabel="Approving…" onClick={() => void approveMutation.run(payment.id)}>
          Approve
        </Button>
      ) : null}
    </>
  )

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} value={list.filters.status ?? ''} onChange={(key) => list.setFilter('status', key)} ariaLabel="Payment status" />

      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search payments', placeholder: 'Transaction, invoice, phone or method…' }}
        filters={[
          { key: 'status', label: 'Status', type: 'select', value: list.filters.status, onChange: (value) => list.setFilter('status', value), options: PAYMENT_STATUSES.map((status) => ({ value: status, label: getStatusLabel('payment', status) })), placeholder: 'All statuses' },
          { key: 'from', label: 'From', type: 'date', value: list.filters.dateRange?.gte?.slice(0, 10) || '', onChange: (value) => list.setFilter('dateRange', { ...(list.filters.dateRange || {}), gte: value ? `${value}T00:00:00` : undefined }) },
          { key: 'to', label: 'To', type: 'date', value: list.filters.dateRange?.lte?.slice(0, 10) || '', onChange: (value) => list.setFilter('dateRange', { ...(list.filters.dateRange || {}), lte: value ? `${value}T23:59:59` : undefined }) },
        ]}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="payments"
      />

      {!canReview ? <InlineAlert variant="info">You can view payments. Approving or rejecting needs the finance role.</InlineAlert> : null}

      <DataTable
        caption="Payment transactions"
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
        onRetry={list.retry}
        empty={<EmptyState title="No payments match" description={list.filters.status === 'awaiting_admin_approval' ? 'Nothing is waiting for approval.' : 'Try another tab or clear the filters.'} />}
        rowActions={rowActions}
        sort={{ key: list.sort.column, direction: list.sort.dir }}
        onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
        getRowLabel={(payment) => `payment ${payment.transaction_id}`}
      />

      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />

      <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} title="Payment details" size="lg" fullScreenOnMobile>
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selected.status} />
              {selected.raw_status && selected.raw_status !== selected.status ? <Badge variant="neutral">Gateway: {selected.raw_status}</Badge> : null}
            </div>
            <KeyValueList
              columns={2}
              items={[
                { key: 'txn', label: 'Transaction id', value: selected.transaction_id },
                { key: 'invoice', label: 'Invoice', value: selected.invoice_id },
                { key: 'amount', label: 'Amount', value: formatAmount(selected.amount) },
                { key: 'credits', label: 'Credits to add', value: selected.credits_to_add },
                { key: 'user', label: 'User', value: selected.buyer?.name },
                { key: 'email', label: 'Email', value: selected.buyer?.email },
                { key: 'phone', label: 'Customer phone', value: selected.customer_phone },
                { key: 'method', label: 'Method', value: selected.payment_method || selected.provider },
                { key: 'package', label: 'Package', value: selected.package?.package_name },
                { key: 'created', label: 'Created', value: formatDateTime(selected.created_at) },
                { key: 'approved', label: 'Approved', value: selected.approved_at ? formatDateTime(selected.approved_at) : null },
                { key: 'credited', label: 'Credited', value: selected.credited_at ? formatDateTime(selected.credited_at) : null },
                { key: 'rejected', label: 'Rejected', value: selected.rejected_at ? formatDateTime(selected.rejected_at) : null },
                { key: 'refunded', label: 'Refunded', value: selected.refunded_at ? formatDateTime(selected.refunded_at) : null },
                { key: 'note', label: 'Review note', value: selected.review_note },
                { key: 'description', label: 'Description', value: selected.description },
              ]}
            />
            {selected.status === 'awaiting_admin_approval' ? (
              <InlineAlert variant="warning" title="Ready for approval">
                Gateway verification completed. Approving adds {selected.credits_to_add} credits to the user.
              </InlineAlert>
            ) : null}
            {canReview ? (
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                {selected.status === 'awaiting_admin_approval' ? (
                  <>
                    <Button variant="primary" icon={<FiCheckCircle />} busy={approveMutation.busy} busyLabel="Approving…" onClick={() => void approveMutation.run(selected.id)}>
                      Approve and grant credits
                    </Button>
                    <Button variant="danger-outline" icon={<FiXCircle />} onClick={() => setDecision({ payment: selected, kind: 'reject' })}>
                      Reject
                    </Button>
                  </>
                ) : null}
                {selected.status === 'pending' ? (
                  <Button variant="danger-outline" icon={<FiXCircle />} onClick={() => setDecision({ payment: selected, kind: 'cancel' })}>
                    Cancel payment
                  </Button>
                ) : null}
                {selected.status === 'credited' ? (
                  <Button variant="danger-outline" icon={<FiRotateCcw />} onClick={() => setDecision({ payment: selected, kind: 'refund' })}>
                    Refund and reverse credits
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <ReasonDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        decision={decision?.kind === 'refund' ? 'custom' : 'reject'}
        title={decision?.kind === 'refund' ? 'Refund this payment?' : decision?.kind === 'cancel' ? 'Cancel this payment?' : 'Reject this payment?'}
        description={
          decision?.kind === 'refund'
            ? `${decision.payment.credits_to_add} credits will be removed from the user's balance and the payment marked refunded.`
            : 'The payment will be marked as failed or cancelled and no credits will be granted.'
        }
        subject={decision ? <p>{formatAmount(decision.payment.amount)} · {decision.payment.buyer?.name || 'Unknown user'} · {decision.payment.transaction_id}</p> : null}
        reasonRequired
        confirmLabel={decision?.kind === 'refund' ? 'Refund' : decision?.kind === 'cancel' ? 'Cancel payment' : 'Reject'}
        busy={reviewMutation.busy}
        error={reviewMutation.error}
        showNote={false}
        onConfirm={async ({ reason }) => {
          const { payment, kind } = decision
          const result = await reviewMutation.run(payment.id, kind, reason)
          if (!result.error) {
            setDecision(null)
            setSelectedId(null)
          }
        }}
      />
    </div>
  )
}

export default PaymentMonitoring
