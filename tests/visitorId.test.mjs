import test from 'node:test'
import assert from 'node:assert/strict'
import { CLIENT_EVENT_TYPES, buildEventPayload, generateUuid, isUuid, readOrCreateId, trackedKey, truncateText } from '../src/lib/visitorId.js'

const fakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial))
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, value), map }
}
const throwingStorage = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
const VISITOR = '6f1c2d3e-4a5b-4c6d-8e7f-901234567890'

test('generateUuid produces valid v4 ids with and without crypto', () => {
  assert.ok(isUuid(generateUuid()))
  assert.ok(isUuid(generateUuid(null)))
  assert.ok(isUuid(generateUuid({ getRandomValues: (bytes) => bytes.fill(7) })))
  assert.equal(generateUuid({ randomUUID: () => 'fixed' }), 'fixed')
})

test('readOrCreateId reuses a valid stored id and replaces a corrupt one', () => {
  const storage = fakeStorage({ k: VISITOR })
  assert.equal(readOrCreateId(storage, 'k'), VISITOR)
  const corrupt = fakeStorage({ k: 'not-a-uuid' })
  const created = readOrCreateId(corrupt, 'k', () => VISITOR)
  assert.equal(created, VISITOR)
  assert.equal(corrupt.map.get('k'), VISITOR)
})

test('readOrCreateId handles missing and throwing storage', () => {
  assert.equal(readOrCreateId(null, 'k'), null)
  assert.ok(isUuid(readOrCreateId(throwingStorage, 'k')))
})

test('isUuid rejects non-uuid input', () => {
  assert.equal(isUuid('abc'), false)
  assert.equal(isUuid(null), false)
  assert.equal(isUuid(123), false)
})

test('truncateText caps at 512 characters and drops empties', () => {
  assert.equal(truncateText('x'.repeat(600)).length, 512)
  assert.equal(truncateText(''), null)
  assert.equal(truncateText(undefined), null)
})

test('buildEventPayload only allows browser event types and needs a visitor id', () => {
  assert.equal(buildEventPayload({ type: 'contact_unlock', visitorId: VISITOR }), null)
  assert.equal(buildEventPayload({ type: 'order', visitorId: VISITOR }), null)
  assert.equal(buildEventPayload({ type: 'listing_view', visitorId: 'nope' }), null)
  for (const type of CLIENT_EVENT_TYPES) assert.ok(buildEventPayload({ type, visitorId: VISITOR }))
})

test('buildEventPayload shapes the RPC arguments', () => {
  const payload = buildEventPayload({
    type: 'listing_view',
    visitorId: VISITOR,
    sessionId: 'bad',
    propertyId: VISITOR,
    pagePath: `/listing/${'a'.repeat(600)}`,
    referrer: 'https://google.com',
    metadata: ['not', 'an', 'object'],
  })
  assert.deepEqual(Object.keys(payload), ['p_event_type', 'p_visitor_id', 'p_session_id', 'p_property_id', 'p_page_path', 'p_referrer', 'p_metadata'])
  assert.equal(payload.p_session_id, null)
  assert.equal(payload.p_property_id, VISITOR)
  assert.equal(payload.p_page_path.length, 512)
  assert.deepEqual(payload.p_metadata, {})
})

test('trackedKey is stable per type and listing', () => {
  assert.equal(trackedKey('listing_view', 'p1'), 'newtolet:tracked:listing_view:p1')
  assert.equal(trackedKey('search'), 'newtolet:tracked:search:none')
})
