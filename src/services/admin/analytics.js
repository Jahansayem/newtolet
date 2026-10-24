// Range-bound analytics for the admin Analytics tab. Each query is limited to
// the selected date range and a hard row cap; nothing reads a whole table.

import { supabase } from '../supabaseClient'
import { rawValuesFor } from '../../lib/paymentStatus'
import { bucketByDay } from '../../lib/adminDateRange'
import { fail, normalizeSupabaseError, ok } from './adminResult'
import { getAdminQueueCounts } from './dashboard'

export const ANALYTICS_ROW_CAP = 5000

const inRange = (query, range, column = 'created_at') => query.gte(column, range.startDate.toISOString()).lte(column, range.endDate.toISOString())

const withSignal = (query, signal) => (signal && typeof query.abortSignal === 'function' ? query.abortSignal(signal) : query)

/**
 * getListingTrend(range) -> { daily: [{ date, count, approved, pending, rejected }], totals, truncated }
 */
export const getListingTrend = async (range, { signal } = {}) => {
  const { data, error } = await withSignal(
    inRange(supabase.from('properties').select('created_at, status').is('deleted_at', null), range).order('created_at', { ascending: true }).limit(ANALYTICS_ROW_CAP),
    signal
  )
  if (error) return fail(error)
  const rows = data || []
  const daily = bucketByDay(rows, (row) => row.created_at, range.startKey, range.endKey)
  const byDay = Object.fromEntries(daily.map((day) => [day.date, { ...day, approved: 0, pending: 0, rejected: 0 }]))
  const totals = { created: rows.length, approved: 0, pending: 0, rejected: 0 }
  for (const row of rows) {
    const status = row.status || 'pending'
    if (totals[status] !== undefined) totals[status] += 1
    const key = new Date(row.created_at)
    const dayKey = `${key.getFullYear()}-${String(key.getMonth() + 1).padStart(2, '0')}-${String(key.getDate()).padStart(2, '0')}`
    if (byDay[dayKey] && byDay[dayKey][status] !== undefined) byDay[dayKey][status] += 1
  }
  return ok({ daily: Object.values(byDay), totals, truncated: rows.length >= ANALYTICS_ROW_CAP })
}

/** getTopAreas(range, limit) -> [{ area, district, count, share }] for listings created in the range. */
export const getTopAreas = async (range, { limit = 10, signal } = {}) => {
  const { data, error } = await withSignal(
    inRange(supabase.from('properties').select('area, state_district').is('deleted_at', null), range).limit(ANALYTICS_ROW_CAP),
    signal
  )
  if (error) return fail(error)
  const counts = new Map()
  for (const row of data || []) {
    const area = (row.area || '').trim() || 'Unknown area'
    const district = (row.state_district || '').trim() || 'Unknown district'
    const key = `${area}|${district}`
    const entry = counts.get(key) || { area, district, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }
  const total = (data || []).length || 1
  const rows = Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area))
    .slice(0, limit)
    .map((entry) => ({ ...entry, id: `${entry.area}|${entry.district}`, share: Math.round((entry.count / total) * 100) }))
  return ok(rows, { totalCount: (data || []).length })
}

/** getPaymentTotals(range) -> { count, amountTotal, creditsTotal, daily: [{ date, count }] } for credited payments. */
export const getPaymentTotals = async (range, { signal } = {}) => {
  const { data, error } = await withSignal(
    inRange(supabase.from('payment_transactions').select('amount, credits_to_add, status, created_at').in('status', rawValuesFor('credited')), range).limit(ANALYTICS_ROW_CAP),
    signal
  )
  if (error) return fail(error)
  const rows = data || []
  const amountTotal = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const creditsTotal = rows.reduce((sum, row) => sum + (Number(row.credits_to_add) || 0), 0)
  return ok({ count: rows.length, amountTotal, creditsTotal, daily: bucketByDay(rows, (row) => row.created_at, range.startKey, range.endKey) })
}

/** New accounts created in the range, bucketed per day. */
export const getSignupTrend = async (range, { signal } = {}) => {
  const { data, error } = await withSignal(inRange(supabase.from('users').select('created_at'), range).limit(ANALYTICS_ROW_CAP), signal)
  if (error) return fail(error)
  return ok({ count: (data || []).length, daily: bucketByDay(data || [], (row) => row.created_at, range.startKey, range.endKey) })
}

/**
 * getAnalyticsOverview(range) runs every query with allSettled so one failure
 * leaves the others visible; `partial` flags that at least one block failed.
 */
export const getAnalyticsOverview = async (range, { signal } = {}) => {
  const settled = await Promise.allSettled([
    getListingTrend(range, { signal }),
    getTopAreas(range, { signal }),
    getPaymentTotals(range, { signal }),
    getSignupTrend(range, { signal }),
    getAdminQueueCounts(),
  ])
  const unwrap = (entry) => (entry.status === 'fulfilled' ? entry.value : fail(normalizeSupabaseError(entry.reason)))
  const [listings, areas, payments, signups, queues] = settled.map(unwrap)
  const blocks = { listings, areas, payments, signups, queues }
  const errors = Object.values(blocks).map((block) => block?.error).filter(Boolean)
  return {
    data: blocks,
    error: errors.length === Object.keys(blocks).length ? errors[0] : null,
    partial: errors.length > 0,
    auditId: null,
  }
}
