import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { createLocationIndex, resolveQuery, suggestPlace } from '../src/lib/search/locationIndex.js'
import { buildSearchPlan, districtCondition, quote } from '../src/lib/search/queryPlan.js'
import { editDistance, isPunctuationOnly, normalizeQuery, placeKey } from '../src/lib/search/normalize.js'
import { parseAmenityList, parsePageNumber } from '../src/lib/search/filterOptions.js'

const bundle = JSON.parse(readFileSync(new URL('../src/thetolet_locations_bundle.json', import.meta.url), 'utf8'))
const index = createLocationIndex(bundle)
const plan = (filters) => buildSearchPlan({ category: 'All', propertyType: 'All', ...filters }, index)

test('normalisation strips punctuation, keeps Bangla, converts Bangla digits', () => {
  assert.equal(normalizeQuery('  Mirpur-10, Dhaka!! '), 'mirpur 10 dhaka')
  assert.equal(normalizeQuery('মিরপুর ১০'), 'মিরপুর 10')
  assert.equal(isPunctuationOnly('!!!'), true)
  assert.equal(isPunctuationOnly(''), false)
  assert.equal(placeKey('Bashundhara R.A'), placeKey('Bashundhara R/A'))
  assert.equal(placeKey('Chawk Bazar'), placeKey('Chawkbazar'))
  assert.equal(editDistance('mirpr', 'mirpur'), 1)
})

test("'!!!' matches nothing (empty state, no request)", () => {
  assert.equal(plan({ search: '!!!' }).empty, true)
})

test('city names mean the district, not the whole division', () => {
  for (const city of ['Sylhet', 'Chattogram', 'Dhaka']) {
    const result = plan({ search: city })
    assert.equal(result.place.type, 'district', city)
    assert.doesNotMatch(result.logic, /Habiganj|Cox|Gazipur|Gopalganj/, city)
  }
  assert.match(plan({ search: 'Chattogram' }).logic, /Chittagong%/) // stored spelling variant
})

test('the Division dropdown still covers every district in the division', () => {
  const result = plan({ division: 'Sylhet' })
  for (const district of ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet']) assert.match(result.logic, new RegExp(district))
})

test('area search is tied to its district, so Uttara cannot match Chattogram', () => {
  const result = plan({ search: 'Uttara' })
  assert.equal(result.place.type, 'upazilla')
  assert.match(result.logic, /state_district\.ilike\."Dhaka%"/)
  assert.doesNotMatch(result.logic, /short_description/)
})

test('Mirpur covers both Mirpurs (Dhaka and Kushtia), each within its district', () => {
  const result = plan({ search: 'mirpur' })
  assert.match(result.logic, /Dhaka%/)
  assert.match(result.logic, /Kushtia%/)
  assert.match(result.logic, /sub_area\.ilike\."%Mirpur%"/)
})

test('Bangla and English queries produce the identical query', () => {
  assert.equal(plan({ search: 'মিরপুর' }).logic, plan({ search: 'Mirpur' }).logic)
  assert.equal(plan({ search: 'সিলেট' }).logic, plan({ search: 'Sylhet' }).logic)
  assert.equal(plan({ search: 'ঢাকা' }).logic, plan({ search: 'dhaka' }).logic)
  assert.equal(plan({ search: 'Chittagong' }).logic, plan({ search: 'চট্টগ্রাম' }).logic)
})

test('filter words become filters: "family flat in mirpur with lift"', () => {
  const result = plan({ search: 'family flat in mirpur with lift' })
  assert.equal(result.category, 'Family')
  assert.equal(result.propertyType, 'Apartment')
  assert.deepEqual(result.amenities, [['Lift']])
  assert.equal(result.place.name, 'Mirpur')
  assert.doesNotMatch(result.logic, /%family%|%flat%|%with%/)
})

test('free text without a place searches text columns, every word required', () => {
  const result = plan({ search: 'rooftop garden' })
  assert.equal(result.place, null)
  assert.match(result.logic, /^and\(or\(.*%rooftop%.*\),or\(.*%garden%.*\)\)$/)
})

test('misspelling suggests the right place', () => {
  assert.equal(suggestPlace(index, 'mirpr'), 'Mirpur')
  assert.equal(suggestPlace(index, 'dhanmondy'), 'Dhanmondi')
  assert.equal(plan({ search: 'Mirpr' }).suggestion, 'Mirpur')
  assert.equal(suggestPlace(index, 'xyzq'), '')
})

test('price range excludes negotiable unless asked; include adds an OR branch', () => {
  assert.equal(plan({ minPrice: '5000', maxPrice: '10000' }).logic, '')
  const included = plan({ minPrice: '5000', maxPrice: '10000', includeNegotiable: true }).logic
  assert.match(included, /rent_amount_bdt\.gte\.5000/)
  assert.match(included, /is_rent_negotiable\.is\.true/)
})

test('values are quoted so commas/dots/quotes cannot break the filter tree', () => {
  assert.equal(quote('Bashundhara R.A'), '"Bashundhara R.A"')
  assert.equal(quote('a"b'), '"a\\"b"')
  assert.match(districtCondition("Cox's Bazar"), /"Cox's Bazar%"/)
})

test('resolveQuery keeps numbers with the place as free text', () => {
  const resolved = resolveQuery(index, 'mirpur 10')
  assert.ok(resolved.place)
  assert.ok(['subArea', 'upazilla'].includes(resolved.place.type))
})

test('filter parsing helpers', () => {
  assert.deepEqual(parseAmenityList('gas,LIFT,unknown,gas'), ['lift', 'gas'])
  assert.equal(parsePageNumber('3'), 3)
  assert.equal(parsePageNumber('-1'), 1)
  assert.equal(parsePageNumber('abc'), 1)
})

test('neighbourhood hints search inside their district (Bashundhara, বসুন্ধরা)', () => {
  const english = plan({ search: 'Bashundhara' })
  assert.equal(english.place.type, 'subArea')
  assert.match(english.logic, /state_district\.ilike\."Dhaka%"/)
  assert.equal(plan({ search: 'বসুন্ধরা' }).logic, english.logic)
})

