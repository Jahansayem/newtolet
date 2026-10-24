import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRange } from '../src/lib/adminDateRange.js'
import { DAILY_METRICS, describeEvent, groupTimelineByDay, normalizeTotals, sumDaily, zeroFillDaily } from '../src/lib/customerStats.js'

const NOW = new Date(2026, 9, 25, 12)
const range = buildRange('custom', { start: '2026-10-23', end: '2026-10-25', now: NOW })

test('zeroFillDaily returns every day in range with numeric metrics', () => {
  const daily = zeroFillDaily([{ day: '2026-10-24', visits: '3', listing_views: 5, signups: null }, { day: '2026-11-01', visits: 99 }], range)
  assert.deepEqual(daily.map((day) => day.date), ['2026-10-23', '2026-10-24', '2026-10-25'])
  assert.equal(daily[1].visits, 3)
  assert.equal(daily[1].listing_views, 5)
  assert.equal(daily[1].signups, 0)
  assert.equal(daily[0].visits, 0)
  for (const metric of DAILY_METRICS) assert.equal(typeof daily[2][metric], 'number')
})

test('zeroFillDaily accepts ISO timestamps for the day column', () => {
  const daily = zeroFillDaily([{ day: new Date(2026, 9, 23, 8).toISOString(), orders: 2 }], range)
  assert.equal(daily[0].orders, 2)
})

test('sumDaily adds each metric across days', () => {
  const totals = sumDaily([{ visits: 1, listing_views: 2 }, { visits: 4, listing_views: '6' }])
  assert.equal(totals.visits, 5)
  assert.equal(totals.listing_views, 8)
  assert.equal(totals.orders, 0)
})

test('normalizeTotals prefers the exact RPC row and derives anonymous visitors otherwise', () => {
  const daily = [{ unique_visitors: 4, signed_in_visitors: 1 }, { unique_visitors: 4, signed_in_visitors: 1 }]
  const fallback = normalizeTotals(null, daily)
  assert.equal(fallback.exact, false)
  assert.equal(fallback.unique_visitors, 8)
  assert.equal(fallback.anonymous_visitors, 6)
  const exact = normalizeTotals({ unique_visitors: '5', signed_in_visitors: '2', anonymous_visitors: '3', tracking_since: '2026-10-25T00:00:00Z' }, daily)
  assert.equal(exact.exact, true)
  assert.equal(exact.unique_visitors, 5)
  assert.equal(exact.anonymous_visitors, 3)
  assert.equal(exact.tracking_since, '2026-10-25T00:00:00Z')
})

test('groupTimelineByDay keeps order within a day', () => {
  const groups = groupTimelineByDay([
    { id: 3, occurred_at: new Date(2026, 9, 25, 10).toISOString() },
    { id: 2, occurred_at: new Date(2026, 9, 25, 9).toISOString() },
    { id: 1, occurred_at: new Date(2026, 9, 24, 9).toISOString() },
  ])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].date, '2026-10-25')
  assert.deepEqual(groups[0].items.map((item) => item.id), [3, 2])
})

test('describeEvent summarises metadata per event type', () => {
  assert.equal(describeEvent({ event_type: 'search', metadata: { search_query: 'Uttara', selected_category: 'Flat' } }), 'Uttara · Flat')
  assert.equal(describeEvent({ event_type: 'search', metadata: {} }), 'Browsed listings')
  assert.equal(describeEvent({ event_type: 'contact_unlock', metadata: { credits_spent: 20 } }), '20 credits')
  assert.equal(describeEvent({ event_type: 'phone_tap', metadata: { placement: 'contact_dialog' } }), 'from contact dialog')
  assert.equal(describeEvent({ event_type: 'listing_view', metadata: { backfill: true, view_count: 4 } }), '4 views before tracking started')
  assert.equal(describeEvent({ event_type: 'listing_view', metadata: {} }), null)
})
