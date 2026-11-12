import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAfterRowFilter } from '../src/lib/nextPendingFilter.js'

test('no position means no filter', () => {
  assert.equal(buildAfterRowFilter(), '')
  assert.equal(buildAfterRowFilter({ id: 'abc' }), '')
})

test('filters to older rows, with an id tie-break on the same timestamp', () => {
  assert.equal(
    buildAfterRowFilter({ createdAt: '2026-11-01T10:00:00.123456', id: 'aaaa-bbbb' }),
    'created_at.lt."2026-11-01T10:00:00.123456",and(created_at.eq."2026-11-01T10:00:00.123456",id.lt."aaaa-bbbb")'
  )
})

test('without an id only strictly older rows match', () => {
  assert.equal(
    buildAfterRowFilter({ createdAt: '2026-11-01T10:00:00' }),
    'created_at.lt."2026-11-01T10:00:00"'
  )
})

test('quotes cannot be injected into the filter', () => {
  assert.equal(buildAfterRowFilter({ createdAt: '2026"x' }), 'created_at.lt."2026x"')
})
