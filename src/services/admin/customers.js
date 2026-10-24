// Customers tab data: daily visitor stats, per-customer activity and top
// listings, all through users.view-gated RPCs over public.customer_events.

import { callAdminRpc } from './adminRpc'
import { fetchAllPages } from './adminQuery'
import { ok } from './adminResult'
import { csvFilename, downloadCsv, toCsv } from '../../lib/exportCsv'
import { normalizeTotals, zeroFillDaily } from '../../lib/customerStats'

const iso = (value) => (value instanceof Date ? value.toISOString() : value || null)
const dayStart = (key) => (key ? new Date(`${key}T00:00:00`).toISOString() : null)
const dayEnd = (key) => (key ? new Date(`${key}T23:59:59.999`).toISOString() : null)

/**
 * getCustomerDailyStats(range) -> { daily: [{date, visits, ...}], totals: {..., anonymous_visitors, tracking_since, exact} }
 * Daily rows come from admin_customer_daily_stats; range-level distinct counts
 * from admin_customer_range_totals (falls back to column sums when it fails).
 */
export const getCustomerDailyStats = async (range, { signal } = {}) => {
  const args = { p_from: iso(range.startDate), p_to: iso(range.endDate) }
  const [daily, totals] = await Promise.all([
    callAdminRpc('admin_customer_daily_stats', { ...args, p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka' }, { signal }),
    callAdminRpc('admin_customer_range_totals', args, { signal }),
  ])
  if (daily.error) return daily
  const rows = zeroFillDaily(Array.isArray(daily.data) ? daily.data : [], range)
  const totalsRow = !totals.error && Array.isArray(totals.data) ? totals.data[0] || null : null
  return { ...ok({ daily: rows, totals: normalizeTotals(totalsRow, rows) }), partial: Boolean(totals.error) }
}

/**
 * listCustomers({ page, pageSize, sort, filters: { from, to, activeOnly }, search }) — RPC-backed, server paginated.
 */
export const listCustomers = async ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) => {
  const limit = Math.min(Math.max(Number(pageSize) || 20, 1), 200)
  const safePage = Math.max(Number(page) || 1, 1)
  const offset = (safePage - 1) * limit
  const rpc = await callAdminRpc(
    'admin_customer_list',
    {
      p_search: String(search || '').trim() || null,
      p_from: dayStart(filters.from),
      p_to: dayEnd(filters.to),
      p_active_only: filters.activeOnly !== 'all' && filters.activeOnly !== false,
      p_sort: sort?.column || 'last_seen',
      p_dir: sort?.dir || 'desc',
      p_limit: limit,
      p_offset: offset,
    },
    { signal }
  )
  if (rpc.error) return { ...rpc, data: [], page: safePage, pageSize: limit, totalCount: 0, hasMore: false }
  const rows = (Array.isArray(rpc.data) ? rpc.data : []).map((row) => ({
    ...row,
    views: Number(row.views) || 0,
    unlocks: Number(row.unlocks) || 0,
    phone_taps: Number(row.phone_taps) || 0,
    searches: Number(row.searches) || 0,
    inquiries: Number(row.inquiries) || 0,
    orders: Number(row.orders) || 0,
  }))
  const totalCount = rows.length ? Number(rows[0].total_count) || rows.length : 0
  return ok(rows, { page: safePage, pageSize: limit, totalCount, hasMore: offset + rows.length < totalCount })
}

export const getCustomerTimeline = async (userId, { page = 1, pageSize = 50, visitorId = null } = {}, { signal } = {}) => {
  const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 200)
  const safePage = Math.max(Number(page) || 1, 1)
  const offset = (safePage - 1) * limit
  const rpc = await callAdminRpc('admin_customer_timeline', { p_user_id: userId, p_visitor_id: visitorId, p_limit: limit, p_offset: offset }, { signal })
  if (rpc.error) return { ...rpc, data: [], page: safePage, pageSize: limit, totalCount: 0, hasMore: false }
  const rows = Array.isArray(rpc.data) ? rpc.data : []
  const totalCount = rows.length ? Number(rows[0].total_count) || rows.length : 0
  return ok(rows, { page: safePage, pageSize: limit, totalCount, hasMore: offset + rows.length < totalCount })
}

export const getTopViewedListings = async (range, { limit = 20, signal } = {}) => {
  const rpc = await callAdminRpc('admin_top_viewed_listings', { p_from: iso(range.startDate), p_to: iso(range.endDate), p_limit: limit }, { signal })
  if (rpc.error) return rpc
  return ok(
    (Array.isArray(rpc.data) ? rpc.data : []).map((row) => ({
      ...row,
      id: row.property_id,
      views: Number(row.views) || 0,
      unique_viewers: Number(row.unique_viewers) || 0,
      unlocks: Number(row.unlocks) || 0,
      phone_taps: Number(row.phone_taps) || 0,
    }))
  )
}

const CUSTOMER_CSV_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'provider', label: 'Sign-in' },
  { key: 'created_at', label: 'Joined' },
  { key: 'last_seen', label: 'Last seen' },
  { key: 'views', label: 'Listing views' },
  { key: 'unlocks', label: 'Contact unlocks' },
  { key: 'phone_taps', label: 'Phone taps' },
  { key: 'searches', label: 'Searches' },
  { key: 'inquiries', label: 'Inquiries' },
  { key: 'orders', label: 'Orders' },
  { key: 'id', label: 'User ID' },
]

export const exportCustomersCsv = async (params = {}) => {
  const result = await fetchAllPages(listCustomers, params, { pageSize: 200, maxRows: 5000 })
  if (result.error && (!result.data || result.data.length === 0)) return result
  downloadCsv(csvFilename(`customers-${params.filters?.from || 'all'}-to-${params.filters?.to || 'now'}`), toCsv(result.data, CUSTOMER_CSV_COLUMNS))
  return { ...ok({ rows: result.data.length, truncated: Boolean(result.truncated) }), error: result.error || null }
}

export const exportDailyStatsCsv = (range, daily = []) => {
  if (!daily.length) return false
  return downloadCsv(
    csvFilename(`customer-activity-${range.startKey}-to-${range.endKey}`),
    toCsv(daily, [
      { key: 'date', label: 'Date' },
      { key: 'visits', label: 'Visits' },
      { key: 'unique_visitors', label: 'Unique visitors' },
      { key: 'signed_in_visitors', label: 'Signed-in visitors' },
      { key: 'listing_views', label: 'Listing views' },
      { key: 'contact_unlocks', label: 'Contact unlocks' },
      { key: 'phone_taps', label: 'Phone taps' },
      { key: 'searches', label: 'Searches' },
      { key: 'inquiries', label: 'Inquiries' },
      { key: 'orders', label: 'Orders' },
      { key: 'signups', label: 'New accounts' },
    ])
  )
}
