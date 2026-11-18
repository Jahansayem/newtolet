import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AVAILABILITY_STATUSES,
  RENT_INCLUDES_OPTIONS,
  isRentedListing,
  normalizeAvailabilityStatus,
  normalizeRentIncludes,
  toggleRentIncludes,
} from '../src/lib/listingAvailability.js'

test('normalizeAvailabilityStatus accepts known values and defaults the rest to available', () => {
  assert.equal(normalizeAvailabilityStatus('rented'), 'rented')
  assert.equal(normalizeAvailabilityStatus(' Coming_Soon '), 'coming_soon')
  assert.equal(normalizeAvailabilityStatus(undefined), 'available')
  assert.equal(normalizeAvailabilityStatus('sold'), 'available')
})

test('isRentedListing reads the listing field', () => {
  assert.equal(isRentedListing({ availability_status: 'rented' }), true)
  assert.equal(isRentedListing({ availability_status: 'available' }), false)
  assert.equal(isRentedListing({}), false)
  assert.equal(isRentedListing(null), false)
})

test('normalizeRentIncludes drops unknown values and duplicates and keeps canonical order', () => {
  assert.deepEqual(normalizeRentIncludes(['gas', 'WATER', 'gas', 'pool', '', null]), ['water', 'gas'])
  assert.deepEqual(normalizeRentIncludes('water'), [])
  assert.deepEqual(normalizeRentIncludes(undefined), [])
})

test('toggleRentIncludes adds and removes one option', () => {
  assert.deepEqual(toggleRentIncludes(['gas'], 'water'), ['water', 'gas'])
  assert.deepEqual(toggleRentIncludes(['water', 'gas'], 'water'), ['gas'])
})

test('the migration allows exactly the values the app offers', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261118120000_listing_availability_rent_includes.sql', import.meta.url), 'utf8')
  const statusCheck = sql.match(/availability_status in \(([^)]+)\)/)[1]
  assert.deepEqual(statusCheck.match(/'([a-z_]+)'/g).map((v) => v.slice(1, -1)), [...AVAILABILITY_STATUSES])
  const includesCheck = sql.match(/rent_includes <@ array\[([^\]]+)\]/)[1]
  assert.deepEqual(includesCheck.match(/'([a-z_]+)'/g).map((v) => v.slice(1, -1)), [...RENT_INCLUDES_OPTIONS])
})
