// Pure shaping for the admin Customers tab (no Supabase import).

import { eachDateKey, toDateKey } from './adminDateRange.js'

export const DAILY_METRICS = Object.freeze([
  'visits',
  'unique_visitors',
  'signed_in_visitors',
  'listing_views',
  'contact_unlocks',
  'phone_taps',
  'whatsapp_taps',
  'searches',
  'inquiries',
  'orders',
  'signups',
])

export const CUSTOMER_EVENT_LABELS = Object.freeze({
  listing_view: 'Viewed listing',
  contact_unlock: 'Unlocked contact',
  phone_tap: 'Tapped phone number',
  whatsapp_tap: 'Tapped WhatsApp',
  search: 'Searched',
  inquiry: 'Sent inquiry',
  order: 'Placed rental request',
})

export const CUSTOMER_EVENT_TONES = Object.freeze({
  listing_view: 'brand',
  contact_unlock: 'success',
  phone_tap: 'warning',
  whatsapp_tap: 'warning',
  search: 'neutral',
  inquiry: 'promoted',
  order: 'promoted',
})

const emptyDay = (date) => Object.fromEntries([['date', date], ...DAILY_METRICS.map((metric) => [metric, 0])])

const dayKeyOf = (value) => {
  if (!value) return null
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  return toDateKey(text)
}

/**
 * zeroFillDaily(rows, range) -> one entry per day in the range, numbers coerced,
 * days without rows filled with zeros. `rows[].day` may be a date string or ISO.
 */
export const zeroFillDaily = (rows = [], range) => {
  const byDay = new Map(eachDateKey(range.startKey, range.endKey).map((date) => [date, emptyDay(date)]))
  for (const row of rows || []) {
    const key = dayKeyOf(row?.day ?? row?.date)
    const target = key ? byDay.get(key) : null
    if (!target) continue
    for (const metric of DAILY_METRICS) target[metric] = Number(row[metric]) || 0
  }
  return Array.from(byDay.values())
}

/** Column sums for the StatCards when the range-totals RPC is unavailable. */
export const sumDaily = (daily = []) => {
  const totals = Object.fromEntries(DAILY_METRICS.map((metric) => [metric, 0]))
  for (const day of daily) for (const metric of DAILY_METRICS) totals[metric] += Number(day[metric]) || 0
  return totals
}

/** Normalises the range-totals RPC row (strings from PostgREST bigints → numbers). */
export const normalizeTotals = (row = null, daily = []) => {
  const base = sumDaily(daily)
  if (!row) return { ...base, anonymous_visitors: Math.max(base.unique_visitors - base.signed_in_visitors, 0), tracking_since: null, exact: false }
  const totals = { ...base }
  for (const metric of [...DAILY_METRICS, 'anonymous_visitors']) if (row[metric] !== undefined && row[metric] !== null) totals[metric] = Number(row[metric]) || 0
  if (totals.anonymous_visitors === undefined) totals.anonymous_visitors = Math.max(totals.unique_visitors - totals.signed_in_visitors, 0)
  return { ...totals, tracking_since: row.tracking_since || null, exact: true }
}

/** Groups timeline events by local day, newest first, preserving the input order inside a day. */
export const groupTimelineByDay = (events = []) => {
  const groups = new Map()
  for (const event of events) {
    const key = toDateKey(event.occurred_at) || 'unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(event)
  }
  return Array.from(groups, ([date, items]) => ({ date, items }))
}

/** Short human summary for a timeline event's metadata. */
export const describeEvent = (event = {}) => {
  const meta = event.metadata || {}
  switch (event.event_type) {
    case 'search': {
      const parts = [meta.search_query || meta.query, meta.selected_category || meta.category, meta.selected_price_range || meta.price_range].filter(Boolean)
      return parts.length ? parts.join(' · ') : 'Browsed listings'
    }
    case 'contact_unlock':
      return meta.credits_spent !== undefined ? `${meta.credits_spent} credits` : null
    case 'phone_tap':
    case 'whatsapp_tap':
      return meta.placement ? `from ${String(meta.placement).replace(/_/g, ' ')}` : null
    case 'inquiry':
      return [meta.name, meta.phone].filter(Boolean).join(' · ') || null
    case 'order':
      return [meta.category, meta.area, meta.district].filter(Boolean).join(', ') || null
    case 'listing_view':
      return meta.backfill ? `${meta.view_count || 1} views before tracking started` : null
    default:
      return null
  }
}
