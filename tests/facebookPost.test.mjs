import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_ATTEMPTS,
  MAX_PHOTOS,
  MESSAGE_MAX,
  buildFacebookPostMessage,
  facebookPhotoUrls,
  facebookRentLabel,
  nextRetryDelayMinutes,
} from '../supabase/functions/_shared/facebookPost.js'

const ID = '0b6f1a52-7c1e-4d0b-9f3e-2a1b3c4d5e6f'
const listing = {
  id: ID,
  property_id_number: 100123,
  category: 'Family',
  property_type: 'Apartment',
  total_rooms: 3,
  total_bathrooms: 2,
  floor_level: '4',
  room_size_sqft: 1200,
  rent_amount_bdt: 18000,
  rent_period: 'Monthly',
  is_rent_negotiable: false,
  state_district: 'Dhaka',
  area: 'Mirpur',
  sub_area: 'Section 10',
  short_description: 'Bright south-facing flat near the metro station.',
  available_from: '2026-12-01',
  contact_number: '01700000000',
}

test('message has headline, rent, place, facts, link and hashtags', () => {
  const message = buildFacebookPostMessage(listing, { amenities: ['Lift', 'Generator'] })
  assert.match(message, /^🏠 3 Bedroom Family Flat for Rent in Mirpur, Dhaka/)
  assert.match(message, /💰 Rent: ৳18,000\/month/)
  assert.match(message, /📍 Section 10, Mirpur, Dhaka/)
  assert.match(message, /🛏 3 bed · 🚿 2 bath · 📐 1,200 sq ft · 🏢 Floor 4/)
  assert.match(message, /✅ Lift, Generator/)
  assert.match(message, /📅 Available from 1 Dec 2026/)
  assert.match(message, /Bright south-facing flat/)
  assert.ok(message.includes(`https://www.newtolet.com/listdetails/?id=${ID}`))
  assert.match(message, /Ref: NT-100123/)
  assert.match(message, /#NewTolet #ToLet #Mirpur #Dhaka #BasaVara$/)
})

test('message never contains the contact number', () => {
  assert.ok(!buildFacebookPostMessage(listing).includes('01700000000'))
})

test('missing fields are left out instead of printed empty', () => {
  const message = buildFacebookPostMessage({ id: ID, property_type: 'Room', area: 'Uttara' })
  assert.ok(!message.includes('undefined'))
  assert.ok(!message.includes('null'))
  assert.ok(!message.includes('📅'))
  assert.match(message, /💰 Rent: Negotiable/)
})

test('long descriptions are clamped to the message limit', () => {
  const message = buildFacebookPostMessage({ ...listing, short_description: 'word '.repeat(2000) })
  assert.ok(message.length <= MESSAGE_MAX + 2, `length ${message.length}`)
  assert.match(message, /…/)
  assert.ok(message.includes(`?id=${ID}`))
})

test('rent label handles negotiable and non-monthly periods', () => {
  assert.equal(facebookRentLabel({ rent_amount_bdt: 5000, is_rent_negotiable: true }), '৳5,000/month (negotiable)')
  assert.equal(facebookRentLabel({ rent_amount_bdt: 800, rent_period: 'Daily' }), '৳800/day')
  assert.equal(facebookRentLabel({}), 'Negotiable')
})

test('photo urls are http(s), unique and capped', () => {
  const rows = [
    { image_url: 'https://api.newtolet.com/a.jpg' },
    { image_url: 'https://api.newtolet.com/a.jpg' },
    { image_url: 'data:image/png;base64,xx' },
    'https://api.newtolet.com/b.jpg',
    ...Array.from({ length: 20 }, (_, i) => ({ image_url: `https://api.newtolet.com/${i}.jpg` })),
  ]
  const urls = facebookPhotoUrls(rows)
  assert.equal(urls.length, MAX_PHOTOS)
  assert.deepEqual(urls.slice(0, 2), ['https://api.newtolet.com/a.jpg', 'https://api.newtolet.com/b.jpg'])
})

test('retry delays grow, then stop at MAX_ATTEMPTS', () => {
  assert.equal(nextRetryDelayMinutes(1), 2)
  assert.equal(nextRetryDelayMinutes(4), 120)
  assert.equal(nextRetryDelayMinutes(MAX_ATTEMPTS), null)
})
