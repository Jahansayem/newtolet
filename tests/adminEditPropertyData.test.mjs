import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAdminEditPropertyData } from '../src/utils/adminEditPropertyData.js'

test('blank NOT NULL text columns become empty strings', () => {
  const result = normalizeAdminEditPropertyData({
    category: undefined,
    property_type: null,
    rent_period: '',
    state_district: '   ',
    area: null,
    contact_number: undefined,
  })

  for (const column of ['category', 'property_type', 'rent_period', 'state_district', 'area', 'contact_number']) {
    assert.equal(result[column], '', column)
  }
})

test('blank number and date columns become null', () => {
  const result = normalizeAdminEditPropertyData({
    total_bathrooms: '',
    balcony: undefined,
    room_size_sqft: 'abc',
    lat: '',
    lng: null,
    available_from: '',
    deadline: undefined,
  })

  for (const column of ['total_bathrooms', 'balcony', 'room_size_sqft', 'lat', 'lng', 'available_from', 'deadline']) {
    assert.equal(result[column], null, column)
  }
})

test('a listing with no usable rent is stored as negotiable', () => {
  for (const rent of ['', null, undefined, 0, '0', -500]) {
    const result = normalizeAdminEditPropertyData({ rent_amount_bdt: rent, is_rent_negotiable: false })
    assert.equal(result.rent_amount_bdt, null)
    assert.equal(result.is_rent_negotiable, true)
  }
})

test('complete values pass through, with numeric strings converted', () => {
  const input = {
    category: 'Family',
    property_type: 'Apartment',
    rent_period: 'Monthly',
    state_district: 'Dhaka',
    area: 'Mirpur',
    contact_number: '01700000000',
    short_description: '',
    sub_area: null,
    total_bathrooms: '2',
    balcony: 0,
    rent_amount_bdt: '15000',
    is_rent_negotiable: false,
    lat: 23.8,
    lng: 90.4,
    available_from: '2026-12-01',
    deadline: '2026-12-31',
    status: 'approved',
  }
  const result = normalizeAdminEditPropertyData(input)

  assert.deepEqual(result, { ...input, total_bathrooms: 2, rent_amount_bdt: 15000 })
  assert.equal(input.total_bathrooms, '2', 'input is not mutated')
})
