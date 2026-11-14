import test from 'node:test'
import assert from 'node:assert/strict'

import { buildWhatsAppHref, toWhatsAppNumber } from '../src/utils/whatsapp.js'
import { getListingMapLocation } from '../src/data/locationCentroids.js'

test('WhatsApp numbers use the international form wa.me expects', () => {
  assert.equal(toWhatsAppNumber('+880 1712-345678'), '8801712345678')
  assert.equal(toWhatsAppNumber('01712345678'), '8801712345678')
  assert.equal(toWhatsAppNumber('09649551551'), '') // landline / hotline, not WhatsApp
  assert.equal(toWhatsAppNumber(''), '')
  assert.equal(buildWhatsAppHref('01712345678', 'Hi (ID: 100001)'), 'https://wa.me/8801712345678?text=Hi%20(ID%3A%20100001)')
})

test('map uses real coordinates, else the area, else the district', () => {
  assert.deepEqual(getListingMapLocation({ lat: 24.8973, lng: 91.8793, state_district: 'Sylhet' }), { lat: 24.8973, lng: 91.8793, precision: 'exact' })
  assert.equal(getListingMapLocation({ state_district: 'Dhaka', area: 'Dhaka', sub_area: 'Mirpur-12, Pallabi' }).precision, 'area')
  assert.equal(getListingMapLocation({ state_district: 'Habiganj', area: 'Habiganj Sadar' }).precision, 'district')
  assert.equal(getListingMapLocation({ state_district: 'Chittagong' }).precision, 'district') // stored spelling
  assert.equal(getListingMapLocation({ state_district: 'Atlantis' }), null)
})

test("the Add Property form's default point is not treated as a real location", () => {
  const placeholder = getListingMapLocation({ lat: 23.8103, lng: 90.4125, state_district: 'Habiganj' })
  assert.equal(placeholder.precision, 'district')
  assert.notEqual(placeholder.lat, 23.8103)
})
