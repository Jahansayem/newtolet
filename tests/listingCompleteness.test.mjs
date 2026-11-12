import test from 'node:test'
import assert from 'node:assert/strict'
import { getCompletenessFlags, looksLikeInternalNote, summarizeCompleteness } from '../src/lib/listingCompleteness.js'

const complete = {
  total_rooms: 3,
  total_bathrooms: 2,
  area: 'Mirpur',
  contact_number: '+8801712345678',
  short_description: 'Three bedroom family flat on the fourth floor, south facing.',
  floor_level: '4th Floor',
  occupancy: 'Family',
  available_from: '2026-12-01',
  deadline: '2026-12-31',
  rent_amount_bdt: 18000,
  is_rent_negotiable: false,
  photoCount: 4,
  amenities: ['Lift'],
  isDuplicatePhone: false,
}
const codes = (listing) => getCompletenessFlags(listing).map((flag) => flag.code)

test('a complete listing has no flags', () => {
  assert.deepEqual(codes(complete), [])
  assert.deepEqual(summarizeCompleteness([]), { count: 0, level: 'ok', text: 'Complete', description: 'No issues found' })
})

test('rooms 0, no floor, no occupancy, no area, no amenities are flagged', () => {
  const flags = codes({ ...complete, total_rooms: 0, floor_level: '', occupancy: null, area: ' ', amenities: [] })
  assert.deepEqual(flags, ['rooms', 'area', 'floor', 'occupancy', 'amenities'])
})

test('missing photos, bathrooms and dates are warnings', () => {
  const flags = getCompletenessFlags({ ...complete, photoCount: 0, total_bathrooms: null, available_from: '' })
  assert.deepEqual(flags.map((flag) => flag.code), ['bathrooms', 'photos', 'dates'])
  assert.ok(flags.every((flag) => flag.level === 'warning'))
})

test('counts that were not loaded are not reported as missing', () => {
  const { photoCount, amenities, ...withoutCounts } = complete
  assert.ok(photoCount && amenities)
  assert.deepEqual(codes(withoutCounts), [])
  assert.deepEqual(codes({ ...withoutCounts, images: [] }), ['photos'])
})

test('a deadline before the available-from date is flagged', () => {
  assert.deepEqual(codes({ ...complete, deadline: '2026-11-01' }), ['dates'])
})

test('short phone numbers and short descriptions are critical', () => {
  const flags = getCompletenessFlags({ ...complete, contact_number: '01712', short_description: 'Flat' })
  assert.deepEqual(flags.map((flag) => [flag.code, flag.level]), [['phone', 'critical'], ['description', 'critical']])
})

test('internal-note wording in the description is flagged', () => {
  for (const text of [
    'Note: owner did not give the floor, check later',
    'Family flat, rent not mentioned in the post',
    'Source: https://facebook.com/groups/tolet/posts/1',
    'Flat for rent [location unclear]',
    'Probably a sublet, could not confirm the area',
    'Posted by: Rahim, 2 rooms',
  ]) {
    assert.equal(looksLikeInternalNote(text), true, text)
  }
  assert.deepEqual(codes({ ...complete, short_description: 'Note: rent not specified by the owner' }), ['note'])
})

test('ordinary adverts are not mistaken for internal notes', () => {
  for (const text of [
    'Two bedroom flat near the main road, gas and lift available.',
    'Family bashar jonno 3 room er flat, 2 baranda, 4th floor.',
    'দুই রুমের ফ্ল্যাট ভাড়া হবে, মিরপুর ১০',
    'Sublet for a small family. No bachelors please.',
  ]) {
    assert.equal(looksLikeInternalNote(text), false, text)
  }
})

test('very low rent and duplicate phones are warnings; negotiable rent is not flagged', () => {
  assert.deepEqual(codes({ ...complete, rent_amount_bdt: 50 }), ['rent'])
  assert.deepEqual(codes({ ...complete, rent_amount_bdt: null, is_rent_negotiable: true }), [])
  assert.deepEqual(codes({ ...complete, isDuplicatePhone: true }), ['duplicate'])
})

test('the summary reports the count, the worst level and the labels', () => {
  const summary = summarizeCompleteness(getCompletenessFlags({ ...complete, total_rooms: 0, floor_level: '' }))
  assert.equal(summary.count, 2)
  assert.equal(summary.level, 'critical')
  assert.equal(summary.text, '2 issues')
  assert.equal(summary.description, 'Rooms missing, No floor')
  assert.equal(summarizeCompleteness(getCompletenessFlags({ ...complete, floor_level: '' })).text, '1 issue')
})
