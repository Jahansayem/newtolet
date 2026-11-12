import test from 'node:test'
import assert from 'node:assert/strict'
import { buildComparison, countDifferences, planKeepOne } from '../src/lib/duplicateCompare.js'

const base = {
  id: 'a',
  status: 'pending',
  rent_amount_bdt: 15000,
  rent_period: 'Monthly',
  is_rent_negotiable: false,
  category: 'Family',
  property_type: 'Flat',
  total_rooms: 2,
  total_bathrooms: 1,
  floor_level: '3rd Floor',
  occupancy: 'Family',
  state_district: 'Dhaka',
  area: 'Mirpur',
  sub_area: 'Section 10',
  available_from: '2026-12-01',
  deadline: '2026-12-31',
  photoCount: 2,
  amenities: ['Lift', 'Generator'],
  short_description: 'Two bedroom flat',
  created_at: '2026-11-10T10:00:00',
  submitted_by: { name: 'Rahim' },
}
const row = (rows, key) => rows.find((entry) => entry.key === key)

test('identical listings have no differences', () => {
  const rows = buildComparison([base, { ...base, id: 'b' }])
  assert.equal(countDifferences(rows), 0)
  assert.deepEqual(row(rows, 'rent').values, ['৳15,000 / Monthly', '৳15,000 / Monthly'])
})

test('fields that differ are marked, one value per listing in order', () => {
  const rows = buildComparison([base, { ...base, id: 'b', total_rooms: 3, floor_level: null, rent_amount_bdt: 18000 }])
  assert.deepEqual(rows.filter((entry) => entry.differs).map((entry) => entry.key), ['rent', 'total_rooms', 'floor_level'])
  assert.deepEqual(row(rows, 'total_rooms').values, ['2', '3'])
  assert.deepEqual(row(rows, 'floor_level').values, ['3rd Floor', ''])
})

test('case, spacing and amenity order are not differences', () => {
  const rows = buildComparison([base, { ...base, id: 'b', area: ' mirpur ', short_description: 'Two  bedroom FLAT', amenities: ['Generator', 'Lift'] }])
  assert.equal(countDifferences(rows), 0)
})

test('status, submitted date and submitter never count as differences', () => {
  const rows = buildComparison([base, { ...base, id: 'b', status: 'approved', created_at: '2026-11-11T09:00:00', submitted_by: { name: 'Karim' } }])
  assert.equal(countDifferences(rows), 0)
  assert.deepEqual(row(rows, 'status').values, ['pending', 'approved'])
  assert.deepEqual(row(rows, 'submitter').values, ['Rahim', 'Karim'])
})

test('negotiable rent and AI submitter are described', () => {
  const rows = buildComparison([{ ...base, rent_amount_bdt: null, is_rent_negotiable: true, isAiSubmitted: true }])
  assert.deepEqual(row(rows, 'rent').values, ['Negotiable'])
  assert.deepEqual(row(rows, 'submitter').values, ['AI agent'])
})

const group = [
  { id: 'a', status: 'pending' },
  { id: 'b', status: 'pending' },
  { id: 'c', status: 'approved' },
  { id: 'd', status: 'rejected' },
  { id: 'e', status: 'pending' },
]

test('keep one and reject the rest: only other pending listings are rejected', () => {
  assert.deepEqual(planKeepOne(group, 'a', 'reject'), { approveIds: ['a'], rejectIds: ['b', 'e'], leftIds: ['c', 'd'] })
})

test('keep one and leave the rest: nothing else changes', () => {
  assert.deepEqual(planKeepOne(group, 'b', 'leave'), { approveIds: ['b'], rejectIds: [], leftIds: ['a', 'c', 'd', 'e'] })
})

test('keeping a listing that is already approved does not approve it again', () => {
  assert.deepEqual(planKeepOne(group, 'c', 'reject'), { approveIds: [], rejectIds: ['a', 'b', 'e'], leftIds: ['d'] })
})

test('keeping a rejected listing approves it', () => {
  assert.deepEqual(planKeepOne(group, 'd', 'leave').approveIds, ['d'])
})

test('an unknown listing gives an empty plan', () => {
  assert.deepEqual(planKeepOne(group, 'zzz', 'reject'), { approveIds: [], rejectIds: [], leftIds: [] })
})
