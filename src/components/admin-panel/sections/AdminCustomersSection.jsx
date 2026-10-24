'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiActivity, FiDownload, FiEye, FiPhone, FiRefreshCw, FiUnlock, FiUsers } from 'react-icons/fi'
import { exportCustomersCsv, exportDailyStatsCsv, getCustomerDailyStats, getCustomerTimeline, getTopViewedListings, listCustomers } from '../../../services/admin/customers'
import { RANGE_PRESETS, buildRange, formatDateKey, formatRangeLabel } from '../../../lib/adminDateRange'
import { CUSTOMER_EVENT_LABELS, CUSTOMER_EVENT_TONES, describeEvent, groupTimelineByDay } from '../../../lib/customerStats'
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
import InlineAlert from '../../ui/InlineAlert'
import KeyValueList from '../../ui/KeyValueList'
import Pagination from '../../ui/Pagination'
import Skeleton from '../../ui/Skeleton'
import StatCard from '../../ui/StatCard'
import StatusPill from '../../ui/StatusPill'
import Tabs from '../../ui/Tabs'
import { useToast } from '../../ui/ToastProvider'

const formatWhen = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const formatTime = (value) => (value ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
const relative = (value) => {
  if (!value) return 'Never'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} d ago`
  return formatDate(value)
}

const SEGMENTS = [
  { key: 'listing_views', label: 'Views', className: 'bg-brand' },
  { key: 'contact_unlocks', label: 'Unlocks', className: 'bg-success' },
  { key: 'phone_taps', label: 'Phone taps', className: 'bg-marigold-500' },
  { key: 'searches', label: 'Searches', className: 'bg-ink/30' },
]

const listingLabel = (row) => `${row.property_id_number ? `ID ${row.property_id_number} · ` : ''}${row.category || row.property_category || 'Listing'} in ${row.area || row.property_area || row.state_district || row.property_district || '—'}`

const AdminCustomersSection = () => {
  const toast = useToast()
  const [preset, setPreset] = useState('7d')
  const [custom, setCustom] = useState({ start: '', end: '' })
  const range = useMemo(() => buildRange(preset, custom), [preset, custom])

  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(null)
  const [statsStatus, setStatsStatus] = useState('loading')
  const [top, setTop] = useState(null)
  const [topError, setTopError] = useState(null)
  const abortRef = useRef(null)

  const loadOverview = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatsStatus((current) => (current === 'ready' ? 'refreshing' : 'loading'))
    const [statsResult, topResult] = await Promise.all([getCustomerDailyStats(range, { signal: controller.signal }), getTopViewedListings(range, { signal: controller.signal })])
    if (controller.signal.aborted) return
    if (statsResult.error) {
      setStatsError(statsResult.error)
      setStatsStatus('error')
    } else {
      setStats(statsResult.data)
      setStatsError(null)
      setStatsStatus('ready')
    }
    setTop(topResult.error ? [] : topResult.data)
    setTopError(topResult.error || null)
  }, [range])

  useEffect(() => {
    void loadOverview()
    return () => abortRef.current?.abort()
  }, [loadOverview])

  const customersFetcher = useCallback((params, options) => listCustomers({ ...params, filters: { ...params.filters, from: range.startKey, to: range.endKey } }, options), [range.startKey, range.endKey])
  const list = useAdminList({ domain: 'customers', fetcher: customersFetcher, initialSort: { column: 'last_seen', dir: 'desc' }, initialFilters: { activeOnly: 'active' }, cache: false })
  const listRefresh = list.refresh
  useEffect(() => {
    listRefresh()
    // refetch the table when the range changes; useAdminList only watches its own params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startKey, range.endKey])

  const [selectedId, setSelectedId] = useEntityParam('customer')
  const selected = list.items.find((row) => row.id === selectedId) || (selectedId ? { id: selectedId } : null)

  const exportMutation = useAdminMutation(() => exportCustomersCsv({ filters: { ...list.filters, from: range.startKey, to: range.endKey }, search: list.search, sort: list.sort }), {
    successMessage: (result) => `Exported ${result.data?.rows ?? 0} customers${result.data?.truncated ? ' (first 5,000 only)' : ''}`,
    showAuditRef: false,
  })

  const headerActions = useMemo(
    () => (
      <>
        <Button
          variant="secondary"
          icon={<FiRefreshCw />}
          onClick={() => {
            void loadOverview()
            list.refresh()
          }}
          busy={statsStatus === 'refreshing'}
          busyLabel="Refreshing…"
        >
          Refresh
        </Button>
        <Button variant="secondary" icon={<FiDownload />} onClick={() => void exportMutation.run()} busy={exportMutation.busy} busyLabel="Exporting…" disabled={list.totalCount === 0}>
          Export customers
        </Button>
        <Button
          variant="secondary"
          icon={<FiDownload />}
          disabled={!stats?.daily?.length}
          onClick={() => {
            if (exportDailyStatsCsv(range, stats?.daily || [])) toast.success(`Exported ${stats.daily.length} days`)
          }}
        >
          Export daily
        </Button>
      </>
    ),
    // list/stats identity changes every render by design
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadOverview, statsStatus, exportMutation.busy, list.totalCount, stats, range]
  )
  useShellHeader({ actions: headerActions })

  const totals = stats?.totals
  const daily = stats?.daily || []
  const loading = statsStatus === 'loading'
  const maxDay = Math.max(...daily.map((day) => SEGMENTS.reduce((sum, segment) => sum + (day[segment.key] || 0), 0)), 1)
  const trackingSince = totals?.tracking_since ? new Date(totals.tracking_since) : null
  const rangePredatesTracking = trackingSince && range.startDate < trackingSince
  const chartSummary = totals ? `${totals.visits} visits and ${totals.listing_views} listing views between ${formatRangeLabel(range)}.` : 'Loading customer activity'

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Customer',
        sortable: true,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.name || row.email || 'Unnamed account'}</p>
            <p className="truncate text-caption text-muted">
              {row.phone ? <a className="hover:underline" href={`tel:${row.phone}`}>{row.phone}</a> : null}
              {row.phone && row.email ? ' · ' : ''}
              {row.email ? <a className="hover:underline" href={`mailto:${row.email}`}>{row.email}</a> : null}
            </p>
          </div>
        ),
      },
      { key: 'provider', header: 'Sign-in', hideBelow: 'lg', render: (row) => <Badge variant="neutral">{row.provider || 'email'}</Badge> },
      { key: 'last_seen', header: 'Last seen', sortable: true, render: (row) => <span className="whitespace-nowrap text-sm text-ink" title={formatWhen(row.last_seen)}>{relative(row.last_seen)}</span> },
      { key: 'views', header: 'Views', sortable: true, align: 'right', render: (row) => <span className="tabular-nums">{row.views}</span> },
      { key: 'unlocks', header: 'Unlocks', sortable: true, align: 'right', render: (row) => <span className="tabular-nums">{row.unlocks}</span> },
      { key: 'phone_taps', header: 'Taps', align: 'right', hideBelow: 'lg', render: (row) => <span className="tabular-nums">{row.phone_taps}</span> },
      { key: 'inquiries', header: 'Inquiries', align: 'right', hideBelow: 'md', render: (row) => <span className="tabular-nums">{row.inquiries}</span> },
      { key: 'orders', header: 'Orders', sortable: true, align: 'right', hideBelow: 'md', render: (row) => <span className="tabular-nums">{row.orders}</span> },
      { key: 'created_at', header: 'Joined', sortable: true, hideBelow: 'lg', render: (row) => <span className="whitespace-nowrap text-sm text-muted">{formatDate(row.created_at)}</span> },
    ],
    []
  )

  const chips = []
  if (list.filters.activeOnly === 'all') chips.push({ key: 'activeOnly', label: 'All accounts', onRemove: () => list.setFilter('activeOnly', 'active') })

  return (
    <div className="space-y-6">
      <section aria-labelledby="customers-range" className="ui-card space-y-3 p-4">
        <h2 id="customers-range" className="sr-only">
          Date range
        </h2>
        <Tabs tabs={RANGE_PRESETS} value={preset} onChange={setPreset} ariaLabel="Date range" variant="pill" />
        {preset === 'custom' ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="ui-label" htmlFor="customers-start">
                Start date
              </label>
              <input id="customers-start" type="date" className="ui-field" value={custom.start} max={custom.end || undefined} onChange={(event) => setCustom((current) => ({ ...current, start: event.target.value }))} />
            </div>
            <div>
              <label className="ui-label" htmlFor="customers-end">
                End date
              </label>
              <input id="customers-end" type="date" className="ui-field" value={custom.end} min={custom.start || undefined} onChange={(event) => setCustom((current) => ({ ...current, end: event.target.value }))} />
            </div>
          </div>
        ) : null}
        <p className="text-caption text-muted" role="status">
          Showing {formatRangeLabel(range)} ({range.days} {range.days === 1 ? 'day' : 'days'})
        </p>
      </section>

      {statsStatus === 'error' ? (
        <InlineAlert variant={statsError?.permissionDenied ? 'permission' : 'danger'} title="Customer activity could not be loaded" action={<Button size="sm" onClick={() => void loadOverview()}>Retry</Button>}>
          {statsError?.code === 'MISSING_RPC' ? 'The customer_events migration has not been applied to the database yet.' : statsError?.message}
        </InlineAlert>
      ) : null}
      {rangePredatesTracking ? (
        <InlineAlert variant="info" title={`Visit tracking started on ${formatDate(trackingSince)}`}>
          Earlier days only show signed-in activity reconstructed from unlocks, inquiries, orders and the last recorded view per listing.
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Visits" value={totals?.visits} hint="Browser sessions with activity" icon={<FiActivity />} loading={loading} />
        <StatCard label="Unique visitors" value={totals?.unique_visitors} hint={totals ? `${totals.signed_in_visitors} signed in · ${totals.anonymous_visitors} anonymous` : null} icon={<FiUsers />} loading={loading} />
        <StatCard label="Listing views" value={totals?.listing_views} icon={<FiEye />} loading={loading} />
        <StatCard label="Contact unlocks" value={totals?.contact_unlocks} icon={<FiUnlock />} loading={loading} tone="success" />
        <StatCard label="Phone taps" value={totals?.phone_taps} hint="Taps on the call button" icon={<FiPhone />} loading={loading} />
        <StatCard label="Inquiries" value={totals?.inquiries} hint={totals ? `${totals.orders} orders · ${totals.searches} searches · ${totals.signups} new accounts` : null} loading={loading} tone={(totals?.inquiries ?? 0) > 0 ? 'warning' : 'neutral'} />
      </div>

      <section aria-labelledby="activity-heading" className="ui-card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="activity-heading" className="text-base font-semibold text-ink">
              Customer activity per day
            </h2>
            <p className="text-caption text-muted">Listing views, contact unlocks, phone taps and searches by day.</p>
          </div>
          <ul className="flex flex-wrap gap-3 text-caption text-muted" aria-label="Legend">
            {SEGMENTS.map((segment) => (
              <li key={segment.key} className="inline-flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${segment.className}`} aria-hidden="true" />
                {segment.label}
              </li>
            ))}
          </ul>
        </div>
        {loading ? (
          <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-canvas" aria-hidden="true" />
        ) : daily.length === 0 ? (
          <EmptyState title="No activity in this range" />
        ) : (
          <>
            <ol role="img" aria-label={chartSummary} className="space-y-1.5">
              {daily.map((day) => {
                const total = SEGMENTS.reduce((sum, segment) => sum + (day[segment.key] || 0), 0)
                return (
                  <li key={day.date} className="flex items-center gap-3 text-caption text-muted">
                    <span className="w-20 shrink-0 tabular-nums">{formatDateKey(day.date).replace(/ \d{4}$/, '')}</span>
                    <span className="flex h-4 flex-1 overflow-hidden rounded bg-canvas">
                      {SEGMENTS.map((segment) =>
                        day[segment.key] ? <span key={segment.key} className={`block h-4 ${segment.className}`} style={{ width: `${Math.max((day[segment.key] / maxDay) * 100, 1.5)}%` }} /> : null
                      )}
                    </span>
                    <span className="w-14 text-right tabular-nums text-ink" title={`${day.visits} visits`}>
                      {total}
                    </span>
                  </li>
                )
              })}
            </ol>
            <table className="sr-only">
              <caption>Customer activity per day, {formatRangeLabel(range)}</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Visits</th>
                  <th scope="col">Unique visitors</th>
                  <th scope="col">Listing views</th>
                  <th scope="col">Contact unlocks</th>
                  <th scope="col">Phone taps</th>
                  <th scope="col">Searches</th>
                  <th scope="col">Inquiries</th>
                  <th scope="col">Orders</th>
                  <th scope="col">New accounts</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{formatDateKey(day.date)}</th>
                    <td>{day.visits}</td>
                    <td>{day.unique_visitors}</td>
                    <td>{day.listing_views}</td>
                    <td>{day.contact_unlocks}</td>
                    <td>{day.phone_taps}</td>
                    <td>{day.searches}</td>
                    <td>{day.inquiries}</td>
                    <td>{day.orders}</td>
                    <td>{day.signups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section aria-labelledby="customers-heading" className="space-y-4">
        <div>
          <h2 id="customers-heading" className="text-base font-semibold text-ink">
            Customers
          </h2>
          <p className="text-caption text-muted">Signed-in accounts and what they did in the selected range. Anonymous visitors are counted above but have no profile.</p>
        </div>
        <FilterBar
          search={{ value: list.search, onChange: list.setSearch, label: 'Search customers', placeholder: 'Name, phone or email…' }}
          filters={[
            {
              key: 'activeOnly',
              label: 'Show',
              type: 'select',
              value: list.filters.activeOnly,
              onChange: (value) => list.setFilter('activeOnly', value || 'active'),
              options: [
                { value: 'active', label: 'Active in range' },
                { value: 'all', label: 'All accounts' },
              ],
            },
          ]}
          chips={chips}
          onClearAll={list.resetFilters}
          resultCount={list.status === 'loading' ? null : list.totalCount}
          resultLabel="customers"
        />
        <DataTable
          caption="Customers and their activity"
          columns={columns}
          rows={list.items}
          loading={list.isLoading}
          error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
          onRetry={list.retry}
          empty={<EmptyState title="No customers match" description="Try a wider date range, a different search, or show all accounts." />}
          rowActions={(row) => (
            <Button size="sm" variant="secondary" onClick={() => setSelectedId(row.id)}>
              Activity
            </Button>
          )}
          sort={{ key: list.sort.column, direction: list.sort.dir }}
          onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
          getRowLabel={(row) => row.name || row.email || row.id}
          density="compact"
        />
        <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
      </section>

      <section aria-labelledby="top-listings-heading" className="space-y-3">
        <div>
          <h2 id="top-listings-heading" className="text-base font-semibold text-ink">
            Top viewed listings
          </h2>
          <p className="text-caption text-muted">Listings customers opened most in this range.</p>
        </div>
        <DataTable
          caption="Top viewed listings"
          columns={[
            {
              key: 'listing',
              header: 'Listing',
              render: (row) => (
                <Link className="text-sm font-medium text-brand hover:underline" to={`/admin/?tab=properties&id=${row.property_id}`}>
                  {listingLabel(row)}
                </Link>
              ),
            },
            { key: 'status', header: 'Status', hideBelow: 'md', render: (row) => (row.status ? <StatusPill status={row.status} /> : <span className="text-muted">Deleted</span>) },
            { key: 'views', header: 'Views', align: 'right', render: (row) => <span className="tabular-nums">{row.views}</span> },
            { key: 'unique_viewers', header: 'Unique viewers', align: 'right', hideBelow: 'md', render: (row) => <span className="tabular-nums">{row.unique_viewers}</span> },
            { key: 'unlocks', header: 'Unlocks', align: 'right', render: (row) => <span className="tabular-nums">{row.unlocks}</span> },
            { key: 'phone_taps', header: 'Taps', align: 'right', hideBelow: 'lg', render: (row) => <span className="tabular-nums">{row.phone_taps}</span> },
          ]}
          rows={top || []}
          loading={top === null && !topError}
          error={topError}
          onRetry={() => void loadOverview()}
          empty={<EmptyState title="No listing views in this range" />}
          getRowLabel={(row) => listingLabel(row)}
          density="compact"
        />
      </section>

      <CustomerDialog customer={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}

const CustomerDialog = ({ customer, onClose }) => {
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const userId = customer?.id || null

  useEffect(() => {
    if (!userId) {
      setEvents([])
      setPage(1)
      setStatus('idle')
      return undefined
    }
    const controller = new AbortController()
    setStatus(page === 1 ? 'loading' : 'more')
    void getCustomerTimeline(userId, { page, pageSize: 50 }, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      if (result.error) {
        if (result.error.code === 'ABORTED') return
        setError(result.error)
        setStatus('error')
        return
      }
      setError(null)
      setEvents((current) => (page === 1 ? result.data : [...current, ...result.data]))
      setHasMore(Boolean(result.hasMore))
      setTotalCount(result.totalCount || 0)
      setStatus('ready')
    })
    return () => controller.abort()
  }, [userId, page])

  const groups = useMemo(() => groupTimelineByDay(events), [events])
  const anonymousCount = events.filter((event) => !event.user_id).length

  return (
    <Dialog open={Boolean(customer)} onClose={onClose} title={customer ? `${customer.name || customer.email || 'Customer'} · activity` : ''} size="xl" fullScreenOnMobile>
      {customer ? (
        <div className="space-y-5">
          <KeyValueList
            columns={2}
            items={[
              { key: 'phone', label: 'Phone', value: customer.phone },
              { key: 'email', label: 'Email', value: customer.email },
              { key: 'provider', label: 'Sign-in', value: customer.provider },
              { key: 'joined', label: 'Joined', value: customer.created_at ? formatDate(customer.created_at) : null },
              { key: 'last', label: 'Last seen', value: customer.last_seen ? formatWhen(customer.last_seen) : null },
              { key: 'counts', label: 'In range', value: customer.views !== undefined ? `${customer.views} views · ${customer.unlocks} unlocks · ${customer.phone_taps} taps · ${customer.inquiries} inquiries · ${customer.orders} orders` : null },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Link className="ui-btn ui-btn-secondary ui-btn-sm" to={`/admin/?tab=users&id=${customer.id}`}>
              Open in Users
            </Link>
          </div>
          <section aria-labelledby="timeline-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="timeline-heading" className="text-sm font-semibold text-ink">
                Timeline {totalCount ? <span className="font-normal text-muted">· {totalCount} events</span> : null}
              </h3>
              {anonymousCount ? <Badge variant="neutral">{anonymousCount} before sign-in</Badge> : null}
            </div>
            {status === 'loading' ? (
              <div className="space-y-2" aria-hidden="true">
                <Skeleton />
                <Skeleton />
                <Skeleton width="60%" />
              </div>
            ) : status === 'error' ? (
              <InlineAlert variant={error?.permissionDenied ? 'permission' : 'danger'} title="Timeline could not be loaded">
                {error?.message}
              </InlineAlert>
            ) : events.length === 0 ? (
              <EmptyState title="No recorded activity" description="This account has not viewed, unlocked or inquired about anything since tracking started." />
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.date}>
                    <h4 className="text-caption font-semibold uppercase tracking-wide text-muted">{formatDateKey(group.date)}</h4>
                    <ol className="mt-1 divide-y divide-line rounded-[var(--radius-card)] border border-line">
                      {group.items.map((event) => {
                        const summary = describeEvent(event)
                        return (
                          <li key={event.id} className="flex flex-wrap items-start gap-3 px-3 py-2 text-sm">
                            <span className="w-12 shrink-0 tabular-nums text-caption text-muted">{formatTime(event.occurred_at)}</span>
                            <Badge variant={CUSTOMER_EVENT_TONES[event.event_type] || 'neutral'}>{CUSTOMER_EVENT_LABELS[event.event_type] || event.event_type}</Badge>
                            <span className="min-w-0 flex-1">
                              {event.property_id ? (
                                <Link className="text-brand hover:underline" to={`/admin/?tab=properties&id=${event.property_id}`}>
                                  {listingLabel(event)}
                                </Link>
                              ) : null}
                              {summary ? <span className="block text-caption text-muted">{summary}</span> : null}
                            </span>
                            {!event.user_id ? <Badge variant="neutral">anonymous</Badge> : null}
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                ))}
                {hasMore ? (
                  <Button variant="secondary" size="sm" busy={status === 'more'} busyLabel="Loading…" onClick={() => setPage((current) => current + 1)}>
                    Load older activity
                  </Button>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </Dialog>
  )
}

export default AdminCustomersSection
