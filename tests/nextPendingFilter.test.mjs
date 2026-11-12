import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAfterInListFilter } from '../src/lib/nextPendingFilter.js'

test('no position means no filter', () => {
  assert.equal(buildAfterInListFilter(), '')
  assert.equal(buildAfterInListFilter({ column: 'created_at', value: '2026-11-01T10:00:00' }), '')
  assert.equal(buildAfterInListFilter({ id: 'abc', value: 1 }), '')
})

test('newest first: older rows, same timestamp with a later id, then rows without a value', () => {
  assert.equal(
    buildAfterInListFilter({ column: 'created_at', dir: 'desc', value: '2026-11-01T10:00:00.123456', id: 'aaaa-bbbb' }),
    'created_at.lt."2026-11-01T10:00:00.123456",and(created_at.eq."2026-11-01T10:00:00.123456",id.gt."aaaa-bbbb"),created_at.is.null'
  )
})

test('ascending sort looks for larger values', () => {
  assert.equal(
    buildAfterInListFilter({ column: 'rent_amount_bdt', dir: 'asc', value: 15000, id: 'aaaa' }),
    'rent_amount_bdt.gt."15000",and(rent_amount_bdt.eq."15000",id.gt."aaaa"),rent_amount_bdt.is.null'
  )
})

test('a row without a value is only followed by other rows without one', () => {
  assert.equal(buildAfterInListFilter({ column: 'rent_amount_bdt', dir: 'desc', value: null, id: 'aaaa' }), 'and(rent_amount_bdt.is.null,id.gt."aaaa")')
})

test('zero is a value, not an empty one', () => {
  assert.equal(
    buildAfterInListFilter({ column: 'rent_amount_bdt', dir: 'desc', value: 0, id: 'a' }),
    'rent_amount_bdt.lt."0",and(rent_amount_bdt.eq."0",id.gt."a"),rent_amount_bdt.is.null'
  )
})

test('quotes and odd column names cannot be injected into the filter', () => {
  assert.equal(
    buildAfterInListFilter({ column: 'created_at', value: '2026"x', id: 'a"b' }),
    'created_at.lt."2026x",and(created_at.eq."2026x",id.gt."ab"),created_at.is.null'
  )
  assert.equal(buildAfterInListFilter({ column: 'created_at,id', value: 1, id: 'a' }), '')
})
