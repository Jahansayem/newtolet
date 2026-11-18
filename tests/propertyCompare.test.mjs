import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_COMPARE_ITEMS,
  buildCompareRows,
  toggleCompareId,
  valuesDiffer,
} from '../src/lib/propertyCompare.js'

test('toggleCompareId adds a new id and removes an existing one', () => {
  assert.deepEqual(toggleCompareId([], 'a'), { ids: ['a'], compared: true, limitReached: false })
  assert.deepEqual(toggleCompareId(['a', 'b'], 'a'), { ids: ['b'], compared: false, limitReached: false })
})

test('toggleCompareId refuses a fifth listing but still allows removing one', () => {
  const full = ['a', 'b', 'c', 'd']
  assert.equal(MAX_COMPARE_ITEMS, 4)
  assert.deepEqual(toggleCompareId(full, 'e'), { ids: full, compared: false, limitReached: true })
  assert.deepEqual(toggleCompareId(full, 'c').ids, ['a', 'b', 'd'])
})

test('toggleCompareId ignores junk in the stored list', () => {
  assert.deepEqual(toggleCompareId(['a', null, '', undefined], 'b').ids, ['a', 'b'])
  assert.deepEqual(toggleCompareId('not-an-array', 'b').ids, ['b'])
})

test('valuesDiffer compares case- and order-insensitively', () => {
  assert.equal(valuesDiffer([2, '2']), false)
  assert.equal(valuesDiffer(['Family', 'family ']), false)
  assert.equal(valuesDiffer([['gas', 'lift'], ['lift', 'gas']]), false)
  assert.equal(valuesDiffer([3, 2]), true)
  assert.equal(valuesDiffer([3, '']), true)
  assert.equal(valuesDiffer([3]), false)
})

test('buildCompareRows flags differing rows, never the Property ID row', () => {
  const a = { property_id_number: 100001, rent_amount_bdt: 15000, total_rooms: 2, area: 'Mirpur', state_district: 'Dhaka', amenities: ['gas'] }
  const b = { property_id_number: 100002, rent_amount_bdt: 15000, total_rooms: 3, area: 'Mirpur', state_district: 'Dhaka', amenities: ['gas'] }
  const rows = Object.fromEntries(buildCompareRows([a, b]).map((row) => [row.key, row]))

  assert.equal(rows.rent.differs, false)
  assert.equal(rows.bedrooms.differs, true)
  assert.deepEqual(rows.bedrooms.values, [2, 3])
  assert.equal(rows.location.values[0], 'Mirpur, Dhaka')
  assert.equal(rows.facilities.differs, false)
  assert.equal(rows.propertyId.differs, false)
})

test('buildCompareRows treats negotiable rent as its own value', () => {
  const rows = buildCompareRows([{ is_rent_negotiable: true, rent_amount_bdt: 1 }, { rent_amount_bdt: 12000 }])
  const rent = rows.find((row) => row.key === 'rent')
  assert.deepEqual(rent.values, ['negotiable', 12000])
  assert.equal(rent.differs, true)
})
