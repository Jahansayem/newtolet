'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiCreditCard, FiDownload, FiHome, FiRefreshCw, FiUserPlus } from 'react-icons/fi'
import { getAnalyticsOverview } from '../../../services/admin/analytics'
import { RANGE_PRESETS, buildRange, formatDateKey, formatRangeLabel } from '../../../lib/adminDateRange'
import { csvFilename, downloadCsv, toCsv } from '../../../lib/exportCsv'
import { useShellHeader } from '../../panel/PanelShellContext'
import Button from '../../ui/Button'
import DataTable from '../../ui/DataTable'
import EmptyState from '../../ui/EmptyState'
import InlineAlert from '../../ui/InlineAlert'
import StatCard from '../../ui/StatCard'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../ui/ToastProvider'

const money = (value) => `৳${Number(value || 0).toLocaleString('en-BD')}`

const AdminAnalyticsSection = () => {
  const toast = useToast()
  const [preset, setPreset] = useState('7d')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const range = useMemo(() => buildRange(preset, custom), [preset, custom])
  const [overview, setOverview] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus((current) => (current === 'ready' ? 'refreshing' : 'loading'))
    const result = await getAnalyticsOverview(range, { signal: controller.signal })
    if (controller.signal.aborted) return
    setOverview(result.data)
    setError(result.error)
    setStatus(result.error ? 'error' : 'ready')
  }, [range])

  useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
  }, [load])

  const exportCsv = () => {
    const listings = overview?.listings?.data?.daily || []
    const payments = Object.fromEntries((overview?.payments?.data?.daily || []).map((day) => [day.date, day.count]))
    const signups = Object.fromEntries((overview?.signups?.data?.daily || []).map((day) => [day.date, day.count]))
    const rows = listings.map((day) => ({ ...day, payments: payments[day.date] || 0, signups: signups[day.date] || 0 }))
    if (!rows.length) return
    downloadCsv(
      csvFilename(`analytics-${range.startKey}-to-${range.endKey}`),
      toCsv(rows, [
        { key: 'date', label: 'Date' },
        { key: 'count', label: 'New listings' },
        { key: 'approved', label: 'Approved' },
        { key: 'pending', label: 'Pending' },
        { key: 'rejected', label: 'Rejected' },
        { key: 'payments', label: 'Credited payments' },
        { key: 'signups', label: 'New accounts' },
      ])
    )
    toast.success(`Exported ${rows.length} days`)
  }

  const headerActions = useMemo(
    () => (
      <>
        <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => void load()} busy={status === 'refreshing'} busyLabel="Refreshing…">
          Refresh
        </Button>
        <Button variant="secondary" icon={<FiDownload />} onClick={exportCsv} disabled={status !== 'ready'}>
          Export CSV
        </Button>
      </>
    ),
    // exportCsv closes over overview/range; recreating per render is intended
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load, status, overview, range]
  )
  useShellHeader({ actions: headerActions })

  const listings = overview?.listings
  const payments = overview?.payments
  const signups = overview?.signups
  const areas = overview?.areas
  const queues = overview?.queues
  const loading = status === 'loading'
  const partial = overview && Object.values(overview).some((block) => block?.error) && status !== 'error'

  const daily = listings?.data?.daily || []
  const maxCount = Math.max(...daily.map((day) => day.count), 1)
  const chartSummary = listings?.data
    ? `${listings.data.totals.created} new listings between ${formatRangeLabel(range)}; busiest day ${daily.reduce((best, day) => (day.count > (best?.count ?? -1) ? day : best), null)?.date || '—'}.`
    : 'Loading listing trend'

  return (
    <div className="space-y-6">
      <section aria-labelledby="range-heading" className="ui-card space-y-3 p-4">
        <h2 id="range-heading" className="sr-only">
          Date range
        </h2>
        <Tabs tabs={RANGE_PRESETS} value={preset} onChange={setPreset} ariaLabel="Date range" variant="pill" />
        {preset === 'custom' ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="ui-label" htmlFor="analytics-start">
                Start date
              </label>
              <input id="analytics-start" type="date" className="ui-field" value={custom.start} max={custom.end || undefined} onChange={(event) => setCustom((current) => ({ ...current, start: event.target.value }))} />
            </div>
            <div>
              <label className="ui-label" htmlFor="analytics-end">
                End date
              </label>
              <input id="analytics-end" type="date" className="ui-field" value={custom.end} min={custom.start || undefined} onChange={(event) => setCustom((current) => ({ ...current, end: event.target.value }))} />
            </div>
          </div>
        ) : null}
        <p className="text-caption text-muted" role="status">
          Showing {formatRangeLabel(range)} ({range.days} {range.days === 1 ? 'day' : 'days'})
        </p>
      </section>

      {status === 'error' ? (
        <InlineAlert variant={error?.permissionDenied ? 'permission' : 'danger'} title="Analytics could not be loaded" action={<Button size="sm" onClick={() => void load()}>Retry</Button>}>
          {error?.message}
        </InlineAlert>
      ) : null}
      {partial ? (
        <InlineAlert variant="warning" title="Some figures are missing">
          One or more queries failed; the cards below show what loaded. Refresh to try again.
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New listings" value={listings?.data?.totals.created} hint={`${listings?.data?.totals.approved ?? 0} approved · ${listings?.data?.totals.pending ?? 0} pending`} icon={<FiHome />} loading={loading} error={listings?.error} />
        <StatCard label="Credited payments" value={payments?.data ? money(payments.data.amountTotal) : undefined} hint={payments?.data ? `${payments.data.count} payments · ${payments.data.creditsTotal} credits` : null} icon={<FiCreditCard />} loading={loading} error={payments?.error} tone="success" />
        <StatCard label="New accounts" value={signups?.data?.count} icon={<FiUserPlus />} loading={loading} error={signups?.error} />
        <StatCard
          label="Moderation backlog"
          value={queues?.data ? (queues.data.pendingProperties ?? 0) + (queues.data.pendingFeedback ?? 0) : undefined}
          hint={queues?.data ? `${queues.data.pendingProperties ?? 0} listings · ${queues.data.pendingFeedback ?? 0} feedback · ${queues.data.awaitingPayments ?? 0} payments` : null}
          loading={loading}
          error={queues?.error}
          tone={(queues?.data?.pendingProperties ?? 0) > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <section aria-labelledby="trend-heading" className="ui-card space-y-4 p-5">
        <div>
          <h2 id="trend-heading" className="text-base font-semibold text-ink">
            New listings per day
          </h2>
          <p className="text-caption text-muted">Approved and pending listings by submission date.</p>
        </div>
        {loading ? (
          <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-canvas" aria-hidden="true" />
        ) : daily.length === 0 ? (
          <EmptyState title="No listings in this range" />
        ) : (
          <>
            <ol role="img" aria-label={chartSummary} className="space-y-1.5">
              {daily.map((day) => (
                <li key={day.date} className="flex items-center gap-3 text-caption text-muted">
                  <span className="w-20 shrink-0 tabular-nums">{formatDateKey(day.date).replace(/ \d{4}$/, '')}</span>
                  <span className="h-4 flex-1 rounded bg-canvas">
                    <span className="block h-4 rounded bg-brand transition-[width] motion-reduce:transition-none" style={{ width: `${Math.max((day.count / maxCount) * 100, day.count > 0 ? 3 : 0)}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums text-ink">{day.count}</span>
                </li>
              ))}
            </ol>
            <table className="sr-only">
              <caption>New listings per day, {formatRangeLabel(range)}</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">New listings</th>
                  <th scope="col">Approved</th>
                  <th scope="col">Pending</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{formatDateKey(day.date)}</th>
                    <td>{day.count}</td>
                    <td>{day.approved}</td>
                    <td>{day.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section aria-labelledby="areas-heading" className="space-y-3">
        <div>
          <h2 id="areas-heading" className="text-base font-semibold text-ink">
            Top areas
          </h2>
          <p className="text-caption text-muted">Where listings submitted in this range are located.</p>
        </div>
        <DataTable
          caption="Top areas by new listings"
          columns={[
            { key: 'area', header: 'Area', render: (row) => <span className="font-medium text-ink">{row.area}</span> },
            { key: 'district', header: 'District', hideBelow: 'md', render: (row) => <span className="text-muted">{row.district}</span> },
            { key: 'count', header: 'Listings', align: 'right', render: (row) => <span className="tabular-nums">{row.count}</span> },
            { key: 'share', header: 'Share', align: 'right', hideBelow: 'md', render: (row) => <span className="tabular-nums text-muted">{row.share}%</span> },
          ]}
          rows={areas?.data || []}
          loading={loading}
          error={areas?.error || null}
          onRetry={() => void load()}
          empty={<EmptyState title="No listings in this range" />}
          getRowLabel={(row) => row.area}
          density="compact"
        />
      </section>
    </div>
  )
}

export default AdminAnalyticsSection
