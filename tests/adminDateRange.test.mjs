import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_RANGE_DAYS, bucketByDay, buildRange, eachDateKey, parseDateKey, toDateKey } from '../src/lib/adminDateRange.js'

const NOW = new Date(2026, 9, 25, 15, 30) // 25 Oct 2026, local

test('7d preset covers today and the six days before it', () => {
  const range = buildRange('7d', { now: NOW })
  assert.equal(range.startKey, '2026-10-19')
  assert.equal(range.endKey, '2026-10-25')
  assert.equal(range.days, 7)
  assert.equal(range.endDate.getHours(), 23)
  assert.equal(range.startDate.getHours(), 0)
})

test('month preset starts on the first of the current month', () => {
  const range = buildRange('month', { now: NOW })
  assert.equal(range.startKey, '2026-10-01')
  assert.equal(range.endKey, '2026-10-25')
  assert.equal(range.days, 25)
})

test('30d preset spans exactly 30 days', () => {
  assert.equal(buildRange('30d', { now: NOW }).days, 30)
})

test('custom range swaps reversed dates and caps the span', () => {
  const swapped = buildRange('custom', { start: '2026-10-20', end: '2026-10-10', now: NOW })
  assert.equal(swapped.startKey, '2026-10-10')
  assert.equal(swapped.endKey, '2026-10-20')
  const capped = buildRange('custom', { start: '2020-01-01', end: '2026-10-25', now: NOW })
  assert.equal(capped.days, MAX_RANGE_DAYS)
})

test('custom range falls back to the last 7 days when inputs are missing or malformed', () => {
  const range = buildRange('custom', { start: 'nope', end: '', now: NOW })
  assert.equal(range.startKey, '2026-10-19')
  assert.equal(range.endKey, '2026-10-25')
})

test('unknown presets resolve to 7d', () => {
  assert.equal(buildRange('yesterday', { now: NOW }).preset, '7d')
})

test('date keys round-trip and reject impossible dates', () => {
  assert.equal(toDateKey(new Date(2026, 1, 3)), '2026-02-03')
  assert.equal(parseDateKey('2026-02-30'), null)
  assert.equal(parseDateKey('2026-2-3'), null)
  assert.equal(toDateKey('not a date'), null)
})

test('eachDateKey is inclusive and empty for reversed input', () => {
  assert.deepEqual(eachDateKey('2026-10-23', '2026-10-25'), ['2026-10-23', '2026-10-24', '2026-10-25'])
  assert.deepEqual(eachDateKey('2026-10-25', '2026-10-23'), [])
})

test('bucketByDay keeps zero days and ignores rows outside the range', () => {
  const rows = [{ created_at: new Date(2026, 9, 23, 9).toISOString() }, { created_at: new Date(2026, 9, 23, 18).toISOString() }, { created_at: new Date(2026, 9, 1).toISOString() }]
  assert.deepEqual(bucketByDay(rows, (row) => row.created_at, '2026-10-22', '2026-10-24'), [
    { date: '2026-10-22', count: 0 },
    { date: '2026-10-23', count: 2 },
    { date: '2026-10-24', count: 0 },
  ])
})
