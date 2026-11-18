'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FiCopy, FiLink, FiPlus, FiRefreshCw } from 'react-icons/fi'
import {
  PAYMENT_LINKS_DOMAIN,
  cancelPaymentLink,
  checkPaymentLink,
  getPaymentLinkCounts,
  listPaymentLinks,
} from '../../../services/admin/paymentLinks'
import { ADMIN_CACHE_EVENT } from '../../../services/admin/adminCache'
import {
  PAYMENT_LINK_STATUS_OPTIONS,
  formatBdt,
  getPaymentAttemptStatusMeta,
  getPaymentLinkStatusMeta,
} from '../../../lib/paymentLinks'
import { PERMISSIONS } from '../../../lib/adminPermissions'
import { useAdminPermissions } from '../../../contexts/AdminAccessContext'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminList } from '../hooks/useAdminList'
import { useAdminMutation } from '../hooks/useAdminMutation'
import { useToast } from '../../ui/ToastProvider'
import PaymentLinkDetailDialog from '../payment-links/PaymentLinkDetailDialog'
import PaymentLinkFormDialog from '../payment-links/PaymentLinkFormDialog'
import { usePaymentLinkClipboard } from '../payment-links/PaymentLinkShare'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'
import EmptyState from '../../ui/EmptyState'
import FilterBar from '../../ui/FilterBar'
import InlineAlert from '../../ui/InlineAlert'
import Pagination from '../../ui/Pagination'
import ReasonDialog from '../../ui/ReasonDialog'
import StatCard from '../../ui/StatCard'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

const EMPTY_FILTERS = { status: '' }

const Counters = ({ refreshToken }) => {
  const [state, setState] = useState({ status: 'loading', data: null })

  const load = useCallback(async () => {
    const result = await getPaymentLinkCounts()
    setState(result.error ? { status: 'error', data: null } : { status: 'ready', data: result.data })
  }, [])

  useEffect(() => {
    void load()
    const onInvalidate = (event) => {
      if (!event.detail?.domain || event.detail.domain === PAYMENT_LINKS_DOMAIN) void load()
    }
    window.addEventListener(ADMIN_CACHE_EVENT, onInvalidate)
    return () => window.removeEventListener(ADMIN_CACHE_EVENT, onInvalidate)
  }, [load, refreshToken])

  const { data } = state
  const shared = { loading: state.status === 'loading', error: state.status === 'error' ? true : null }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label="Awaiting payment" value={data?.active} hint={data ? `${formatBdt(data.active_bdt)} outstanding` : null} {...shared} />
      <StatCard label="Paid links" value={data?.paid} {...shared} />
      <StatCard label="Collected" value={data ? formatBdt(data.collected_bdt) : null} hint="Through payment links" {...shared} />
    </div>
  )
}

const AdminPaymentLinksSection = () => {
  const { hasPermission } = useAdminPermissions()
  const canManage = hasPermission(PERMISSIONS.PAYMENTS_REVIEW)
  const toast = useToast()
  const { copyLink } = usePaymentLinkClipboard()
  const list = useAdminList({ domain: PAYMENT_LINKS_DOMAIN, fetcher: listPaymentLinks, initialFilters: EMPTY_FILTERS })

  const [createOpen, setCreateOpen] = useState(false)
  const [created, setCreated] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [countsToken, setCountsToken] = useState(0)
  const [attemptsToken, setAttemptsToken] = useState(0)

  // The detail dialog always shows the freshest row from the list.
  const detail = useMemo(() => (detailId ? list.items.find((row) => row.id === detailId) || null : null), [detailId, list.items])

  const refreshAll = useCallback(() => {
    void list.refresh()
    setCountsToken((token) => token + 1)
    setAttemptsToken((token) => token + 1)
  }, [list])

  const checkMutation = useAdminMutation((_id, code) => checkPaymentLink(code), {
    errorMessage: 'The payment could not be checked',
    invalidate: [PAYMENT_LINKS_DOMAIN],
    onSuccess: (result) => {
      const { link, payment, checked } = result.data || {}
      if (link?.status === 'PAID') toast.success('This link is paid', { description: payment?.method ? `Paid with ${payment.method}` : null })
      else if (payment?.status === 'awaiting_admin_approval') toast.info('A payment is held for review', { description: 'Open the Payments tab to approve or reject it.' })
      else toast.info('No payment yet', { description: checked ? 'EPS reports no completed payment on this link.' : 'The customer has not started a payment.' })
      refreshAll()
    },
  })

  const cancelMutation = useAdminMutation((id, reason) => cancelPaymentLink(id, reason), {
    successMessage: 'Payment link cancelled',
    errorMessage: 'The payment link could not be cancelled',
    invalidate: [PAYMENT_LINKS_DOMAIN],
    onSuccess: () => {
      setCancelTarget(null)
      refreshAll()
    },
  })

  const headerActions = useMemo(
    () => (
      <>
        <Button variant="secondary" icon={<FiRefreshCw />} onClick={refreshAll} busy={list.isRefreshing} busyLabel="Refreshing…">
          Refresh
        </Button>
        {canManage ? (
          <Button variant="primary" icon={<FiPlus />} onClick={() => setCreateOpen(true)}>
            New payment link
          </Button>
        ) : null}
      </>
    ),
    [canManage, list.isRefreshing, refreshAll]
  )
  useShellHeader({ actions: headerActions })

  const columns = useMemo(
    () => [
      {
        key: 'created_at',
        header: 'Link',
        sortable: true,
        render: (link) => (
          <div className="min-w-0">
            <button type="button" className="whitespace-nowrap font-mono text-sm font-semibold text-brand hover:underline" onClick={() => setDetailId(link.id)}>
              {link.code}
            </button>
            <p className="whitespace-nowrap text-caption text-muted">{formatDate(link.created_at)}</p>
          </div>
        ),
      },
      {
        key: 'amount_bdt',
        header: 'Amount',
        sortable: true,
        align: 'right',
        render: (link) => <span className="font-semibold tabular-nums text-ink">{formatBdt(link.amount_bdt)}</span>,
      },
      {
        key: 'purpose',
        header: 'For',
        render: (link) => (
          <div className="min-w-0 max-w-[14rem]">
            <p className="truncate text-ink" title={link.purpose}>{link.purpose}</p>
            {link.customer_order_no ? <p className="text-caption text-muted">Order {link.customer_order_no}</p> : null}
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        hideBelow: 'lg',
        render: (link) =>
          link.customer_name || link.customer_phone ? (
            <div className="min-w-0">
              <p className="font-medium text-ink">{link.customer_name || '—'}</p>
              <p className="whitespace-nowrap text-caption tabular-nums text-muted">{link.customer_phone || 'No phone'}</p>
            </div>
          ) : (
            <span className="whitespace-nowrap text-caption text-muted">Asked on the pay page</span>
          ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (link) => {
          const meta = getPaymentLinkStatusMeta(link.status)
          const held = link.last_attempt_status === 'awaiting_admin_approval'
          return (
            <div className="flex flex-col items-start gap-1">
              <Badge variant={meta.variant}>{meta.label}</Badge>
              {link.status === 'PAID' ? (
                <span className="text-caption text-muted">{formatDate(link.paid_at)}</span>
              ) : held ? (
                <Badge variant="warning">Payment held for review</Badge>
              ) : link.status === 'ACTIVE' && link.attempts > 0 ? (
                <span className="text-caption text-muted">
                  {link.attempts} attempt{link.attempts === 1 ? '' : 's'} · last {getPaymentAttemptStatusMeta(link.last_attempt_status).label.toLowerCase()}
                </span>
              ) : null}
            </div>
          )
        },
      },
    ],
    []
  )

  const { filters } = list
  const chips = []
  if (filters.status) chips.push({ key: 'status', label: `Status: ${getPaymentLinkStatusMeta(filters.status).label}`, onRemove: () => list.setFilter('status', '') })

  const missingSchema = list.error?.code === 'MISSING_TABLE' || list.error?.code === 'MISSING_COLUMN'
  const filtered = Boolean(filters.status || list.search)

  return (
    <div className="space-y-4">
      <Counters refreshToken={countsToken} />

      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search payment links', placeholder: 'Code, customer, phone, purpose, order number…' }}
        filters={[
          { key: 'status', label: 'Status', type: 'select', value: filters.status, onChange: (value) => list.setFilter('status', value), options: PAYMENT_LINK_STATUS_OPTIONS, placeholder: 'All statuses' },
        ]}
        chips={chips}
        onClearAll={list.resetFilters}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="links"
      />

      {missingSchema ? (
        <InlineAlert variant="warning" title="Payment links are not set up on this database yet">
          Apply supabase/migrations/20261119090000_payment_links.sql, then refresh.
        </InlineAlert>
      ) : (
        <>
          <DataTable
            caption="Payment links"
            columns={columns}
            rows={list.items}
            loading={list.isLoading}
            error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
            onRetry={list.retry}
            empty={
              filtered ? (
                <EmptyState title="No payment links match" description="Try clearing the search or the status filter." />
              ) : (
                <EmptyState
                  icon={<FiLink />}
                  title="No payment links yet"
                  description="Create a link for any amount, send it to the customer, and it is marked paid here as soon as they pay through EPS."
                  action={
                    canManage ? (
                      <Button variant="primary" icon={<FiPlus />} onClick={() => setCreateOpen(true)}>
                        New payment link
                      </Button>
                    ) : null
                  }
                />
              )
            }
            rowActions={(link) => (
              <div className="flex items-center justify-end gap-1">
                {link.status === 'ACTIVE' ? (
                  <Button size="sm" variant="ghost" iconOnly icon={<FiCopy />} onClick={() => copyLink(link)} aria-label={`Copy payment link ${link.code}`} />
                ) : null}
                {/* Sharing, checking and cancelling live in the detail dialog. */}
                <Button size="sm" variant="secondary" onClick={() => setDetailId(link.id)} aria-label={`Open payment link ${link.code}`}>
                  Open
                </Button>
              </div>
            )}
            sort={{ key: list.sort.column, direction: list.sort.dir }}
            onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
            getRowLabel={(link) => `payment link ${link.code} for ${formatBdt(link.amount_bdt)}`}
          />
          <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
        </>
      )}

      <PaymentLinkFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(link) => {
          setCreated(link)
          refreshAll()
        }}
      />

      <PaymentLinkDetailDialog link={created} mode="created" onClose={() => setCreated(null)} />

      <PaymentLinkDetailDialog
        link={cancelTarget ? null : detail}
        onClose={() => setDetailId(null)}
        canManage={canManage}
        checking={checkMutation.busy}
        refreshToken={attemptsToken}
        onCheck={(link) => void checkMutation.run(link.id, link.code)}
        onCancel={(link) => setCancelTarget(link)}
      />

      <ReasonDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={({ reason }) => void cancelMutation.run(cancelTarget.id, reason)}
        decision="reject"
        title={cancelTarget ? `Cancel payment link ${cancelTarget.code}?` : ''}
        description="The customer will see that the link is no longer active and cannot pay through it."
        subject={cancelTarget ? `${formatBdt(cancelTarget.amount_bdt)} · ${cancelTarget.purpose}` : null}
        reasonHelp="Kept in the audit log. The customer does not see it."
        showNote={false}
        confirmLabel="Cancel link"
        busy={cancelMutation.busy}
        error={cancelMutation.error}
      />
    </div>
  )
}

export default AdminPaymentLinksSection
