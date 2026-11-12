import test from 'node:test'
import assert from 'node:assert/strict'
import { PROPERTY_COUNT_KEYS, describeFailedCounts, mergePropertyCounts, resolveCountKeys } from '../src/lib/propertyCounts.js'

test('a failed count keeps the last known value', () => {
  const previous = { total: 3000, approved: 300, pending: 2600, rejected: 100, duplicatePending: 40 }
  const next = { total: 3001, approved: null, pending: 2601, rejected: null, duplicatePending: null }
  assert.deepEqual(mergePropertyCounts(previous, next), { total: 3001, approved: 300, pending: 2601, rejected: 100, duplicatePending: 40 })
})

test('a failed count with nothing known stays null, never 0', () => {
  const merged = mergePropertyCounts(null, { total: null, approved: 12 })
  assert.equal(merged.total, null)
  assert.equal(merged.approved, 12)
  assert.equal(merged.pending, null)
})

test('a real zero replaces the previous value', () => {
  assert.equal(mergePropertyCounts({ pending: 5 }, { pending: 0 }).pending, 0)
})

test('a partial retry only touches the counts it asked for', () => {
  const previous = { total: 10, approved: 4, pending: null, rejected: 1, duplicatePending: null }
  assert.deepEqual(mergePropertyCounts(previous, { pending: 5 }), { total: 10, approved: 4, pending: 5, rejected: 1, duplicatePending: null })
})

test('resolveCountKeys returns the requested subset in card order, or everything', () => {
  assert.deepEqual(resolveCountKeys(['rejected', 'pending']), ['pending', 'rejected'])
  assert.deepEqual(resolveCountKeys(null), [...PROPERTY_COUNT_KEYS])
  assert.deepEqual(resolveCountKeys([]), [...PROPERTY_COUNT_KEYS])
  assert.deepEqual(resolveCountKeys(['unknown']), [...PROPERTY_COUNT_KEYS])
})

test('describeFailedCounts names the cards', () => {
  assert.equal(describeFailedCounts([]), '')
  assert.equal(describeFailedCounts(['pending']), 'Pending')
  assert.equal(describeFailedCounts(['rejected', 'pending']), 'Pending and Rejected')
  assert.equal(describeFailedCounts(['total', 'approved', 'pending']), 'Listings, Approved and Pending')
  assert.equal(describeFailedCounts([...PROPERTY_COUNT_KEYS]), 'the counts')
})
