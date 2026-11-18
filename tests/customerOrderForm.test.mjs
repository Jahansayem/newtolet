import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  COUNT_OPTIONS,
  FACILITY_OPTIONS,
  SOURCE_OPTIONS,
  changedFields,
  countChoices,
  draftFrom,
  facilityChoices,
  formatFacilities,
  gasChoices,
  normalise,
  parseFacilities,
  sourceChoices,
} from '../src/lib/customerOrderForm.js'
import { SOURCE_LABELS } from '../src/lib/customerOrderStatus.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const existing = {
  id: 'o1',
  customer_name: 'Rahim Uddin',
  customer_phone: '01712345678',
  facebook_name: 'Rahim',
  facebook_thread_url: 'https://www.facebook.com/messages/t/1',
  source: 'manual',
  area: 'Mirpur 10',
  move_in_date: '2026-12-01',
  tenant_type: 'family',
  gas: 'Line',
  facilities: 'lift preferred, parking',
  requirement_notes: null,
  rooms: 6,
  bathrooms: 2,
  balconies: 1,
  budget_min: 10000,
  budget_max: 15000,
  follow_up_at: null,
  assigned_to: null,
}

test('a new order starts on Facebook with the 01 phone prefix', () => {
  const draft = draftFrom(null)
  assert.equal(draft.source, 'messenger')
  assert.equal(draft.customer_phone, '01')
  assert.deepEqual(draft.facilities, [])
  assert.equal(draft.rooms, '')
  assert.equal(draft.gas, '')
})

test('the three source options have labels', () => {
  assert.deepEqual([...SOURCE_OPTIONS], ['messenger', 'phone', 'whatsapp'])
  assert.deepEqual(SOURCE_OPTIONS.map((value) => SOURCE_LABELS[value]), ['Facebook', 'Phone call', 'WhatsApp'])
})

test('the database and the agent API accept every source option', () => {
  const migration = read('supabase/migrations/20261118090000_customer_order_whatsapp_source.sql')
  const api = read('supabase/functions/customer-orders/validation.ts')
  for (const source of SOURCE_OPTIONS) {
    assert.equal(migration.split(`'${source}'`).length - 1, 2, `${source}: table check and co_clean_fields`)
    assert.ok(api.includes(`"${source}"`), `${source}: agent API`)
  }
})

test('an untouched 01 prefix is not a phone number', () => {
  assert.equal(normalise(draftFrom(null)).customer_phone, null)
  assert.equal(normalise({ ...draftFrom(null), customer_phone: ' 01712345678 ' }).customer_phone, '01712345678')
})

test('the thread link is never part of the form values', () => {
  assert.equal('facebook_thread_url' in draftFrom(existing), false)
  assert.equal('facebook_thread_url' in normalise(draftFrom(existing)), false)
})

test('dropdown numbers are sent as whole numbers, blank as null', () => {
  const values = normalise({ ...draftFrom(null), rooms: '3', bathrooms: '' })
  assert.equal(values.rooms, 3)
  assert.equal(values.bathrooms, null)
})

test('facilities: known options are canonical, free text is kept, duplicates dropped', () => {
  assert.deepEqual(parseFacilities('lift preferred, PARKING, parking, , wifi'), ['lift preferred', 'Parking', 'WiFi'])
  assert.equal(formatFacilities(['lift preferred', 'WiFi', 'Lift']), 'Lift, WiFi, lift preferred')
  assert.equal(formatFacilities([]), null)
  assert.deepEqual(facilityChoices(['lift preferred', 'Lift']), [...FACILITY_OPTIONS, 'lift preferred'])
})

test('opening and saving an older order changes nothing', () => {
  assert.deepEqual(changedFields(normalise(draftFrom(existing)), existing), {})
})

test('an edit sends only what changed', () => {
  const draft = { ...draftFrom(existing), gas: 'cylinder', facilities: ['lift preferred', 'Parking', 'CCTV'], rooms: '2' }
  assert.deepEqual(changedFields(normalise(draft), existing), { gas: 'cylinder', facilities: 'Parking, CCTV, lift preferred', rooms: 2 })
})

test('older values stay selectable next to the new options', () => {
  assert.deepEqual(countChoices(6), [...COUNT_OPTIONS, 6])
  assert.deepEqual(countChoices(''), [...COUNT_OPTIONS])
  assert.deepEqual(countChoices(2), [...COUNT_OPTIONS])
  assert.deepEqual(sourceChoices('manual'), [...SOURCE_OPTIONS, 'manual'])
  assert.deepEqual(sourceChoices('phone'), [...SOURCE_OPTIONS])
  assert.equal(draftFrom(existing).gas, 'line')
  assert.deepEqual(gasChoices('line or cylinder').map((option) => option.value), ['line', 'cylinder', 'line or cylinder'])
  assert.equal(gasChoices('line').length, 2)
})
