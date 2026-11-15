// Customer Orders API: the pure modules of the Edge Function (routing, key
// scopes, validation, response shaping, error mapping) plus a static check
// that index.ts calls the SQL functions with parameter names that exist.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ApiError, errorBody, fromDbError, okBody } from '../supabase/functions/customer-orders/errors.ts'
import { ROUTE_SCOPE, actorTypeForScope, assertScope, matchRoute } from '../supabase/functions/customer-orders/router.ts'
import {
  ORDER_STATUSES,
  dhakaDayStart,
  dhakaNextDayStart,
  escapePattern,
  normalizePhone,
  parseClaimBody,
  parseCreateBody,
  parseDeleteBody,
  parseListQuery,
  parseMatchBody,
  parseNoteBody,
  parseStatusBody,
  parseUpdateBody,
  parseVerifyBody,
} from '../supabase/functions/customer-orders/validation.ts'
import { serializeDetail, serializeMatch, serializeOrder, serializeTimeline } from '../supabase/functions/customer-orders/serialize.ts'
import { ApiKeyConfigError, bearerToken, matchKey, parseKeyList } from '../supabase/functions/_shared/apiKeys.ts'
import { CUSTOMER_ORDER_STATUSES } from '../src/lib/customerOrderStatus.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20261116090000_customer_orders.sql')
const indexSource = read('../supabase/functions/customer-orders/index.ts')

const throwsApi = (fn, status, code) => {
  let caught = null
  try {
    fn()
  } catch (error) {
    caught = error
  }
  assert.ok(caught instanceof ApiError, `expected an ApiError ${code}`)
  assert.equal(caught.status, status)
  assert.equal(caught.code, code)
  return caught
}

// ---------------------------------------------------------------------------
// Routing and scopes
// ---------------------------------------------------------------------------

test('every endpoint of the spec resolves, through nginx and directly', () => {
  const cases = [
    ['POST', '/orders', 'create', null],
    ['GET', '/orders', 'list', null],
    ['GET', '/orders/by-customer', 'byCustomer', null],
    ['GET', '/orders/NT-2026-0001', 'get', 'NT-2026-0001'],
    ['PATCH', '/orders/NT-2026-0001', 'update', 'NT-2026-0001'],
    ['DELETE', '/orders/NT-2026-0001', 'delete', 'NT-2026-0001'],
    ['POST', '/orders/NT-2026-0001/status', 'status', 'NT-2026-0001'],
    ['POST', '/orders/NT-2026-0001/payment-claim', 'paymentClaim', 'NT-2026-0001'],
    ['POST', '/orders/NT-2026-0001/payment-verify', 'paymentVerify', 'NT-2026-0001'],
    ['POST', '/orders/NT-2026-0001/notes', 'addNote', 'NT-2026-0001'],
    ['POST', '/orders/NT-2026-0001/matches', 'addMatch', 'NT-2026-0001'],
    ['GET', '/orders/NT-2026-0001/timeline', 'timeline', 'NT-2026-0001'],
  ]
  for (const prefix of ['/functions/v1/customer-orders', '/customer-orders', '/api/v1']) {
    for (const [method, path, name, orderNo] of cases) {
      assert.deepEqual(matchRoute(method, `${prefix}${path}`), { name, orderNo }, `${method} ${prefix}${path}`)
    }
  }
  assert.equal(matchRoute('get', '/customer-orders/orders/nt-2026-0012/').orderNo, 'NT-2026-0012')
})

test('unknown routes are 404 and wrong methods are 405', () => {
  throwsApi(() => matchRoute('GET', '/customer-orders'), 404, 'NOT_FOUND')
  throwsApi(() => matchRoute('GET', '/customer-orders/users'), 404, 'NOT_FOUND')
  throwsApi(() => matchRoute('GET', '/customer-orders/orders/not-an-id'), 404, 'NOT_FOUND')
  throwsApi(() => matchRoute('GET', '/customer-orders/orders/NT-2026-0001/refund'), 404, 'NOT_FOUND')
  throwsApi(() => matchRoute('GET', '/customer-orders/orders/NT-2026-0001/status/extra'), 404, 'NOT_FOUND')
  throwsApi(() => matchRoute('PUT', '/customer-orders/orders'), 405, 'METHOD_NOT_ALLOWED')
  throwsApi(() => matchRoute('GET', '/customer-orders/orders/NT-2026-0001/status'), 405, 'METHOD_NOT_ALLOWED')
  throwsApi(() => matchRoute('POST', '/customer-orders/orders/NT-2026-0001/timeline'), 405, 'METHOD_NOT_ALLOWED')
  throwsApi(() => matchRoute('POST', '/customer-orders/orders/by-customer'), 405, 'METHOD_NOT_ALLOWED')
})

test('agent keys are refused payment-verify and delete; everything else is open to them', () => {
  const error = throwsApi(() => assertScope('paymentVerify', 'agent'), 403, 'FORBIDDEN')
  assert.match(error.message, /cannot verify/i)
  throwsApi(() => assertScope('delete', 'agent'), 403, 'FORBIDDEN')
  for (const [route, scope] of Object.entries(ROUTE_SCOPE)) {
    assert.doesNotThrow(() => assertScope(route, 'admin'), route)
    if (scope === 'agent') assert.doesNotThrow(() => assertScope(route, 'agent'), route)
  }
  assert.deepEqual(Object.keys(ROUTE_SCOPE).filter((route) => ROUTE_SCOPE[route] === 'admin').sort(), ['delete', 'paymentVerify'])
  assert.equal(actorTypeForScope('agent'), 'api_agent')
  assert.equal(actorTypeForScope('admin'), 'api_admin')
})

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

const KEY_A = 'a'.repeat(40)
const KEY_B = 'b'.repeat(40)

test('key lists: labelled, minimum length, no duplicate labels, key never in the message', () => {
  assert.deepEqual(parseKeyList(`Agent-1:${KEY_A}, muse:${KEY_B}`, 'X'), [{ label: 'agent-1', key: KEY_A }, { label: 'muse', key: KEY_B }])
  assert.deepEqual(parseKeyList('', 'X'), [])
  assert.deepEqual(parseKeyList(undefined, 'X'), [])
  assert.throws(() => parseKeyList(KEY_A, 'X'), ApiKeyConfigError)
  assert.throws(() => parseKeyList(`a:${KEY_A},a:${KEY_B}`, 'X'), /used twice/)
  let message = ''
  try {
    parseKeyList('short:secret-value-123', 'ORDERS_AGENT_API_KEYS')
  } catch (error) {
    message = error.message
  }
  assert.match(message, /shorter than 32/)
  assert.ok(!message.includes('secret-value-123'))
})

test('matchKey finds the right key and rejects everything else', async () => {
  const keys = [{ label: 'agent-1', key: KEY_A, scope: 'agent' }, { label: 'ops', key: KEY_B, scope: 'admin' }]
  assert.equal((await matchKey(KEY_B, keys)).scope, 'admin')
  assert.equal((await matchKey(KEY_A, keys)).label, 'agent-1')
  assert.equal(await matchKey(`${KEY_A}x`, keys), null)
  assert.equal(await matchKey('', keys), null)
  assert.equal(bearerToken(`Bearer ${KEY_A}`), KEY_A)
  assert.equal(bearerToken(`bearer  ${KEY_A} `), KEY_A)
  assert.equal(bearerToken(KEY_A), '')
  assert.equal(bearerToken(null), '')
})

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createBody = () => ({
  type: 'HOUSE_SEARCH',
  customer: { name: 'Rahim Uddin', phone: '01712345678', facebook_name: 'Rahim Uddin', facebook_thread_url: 'https://www.facebook.com/messages/t/1' },
  source: 'messenger',
  requirements: {
    area: 'Mirpur 10, Kazipara', rooms: 2, budget_min: 10000, budget_max: 15000, move_in_date: '2026-12-01',
    family_or_bachelor: 'family', gas: 'line', bathrooms: 1, balconies: 1, facilities: 'lift preferred', notes: 'Near metro station if possible',
  },
  assigned_to: 'staff@newtolet.com',
})

test('create body from the spec maps onto the SQL payload', () => {
  const { fields, assignedTo, confirmDuplicate } = parseCreateBody(createBody())
  assert.deepEqual(fields, {
    customer_name: 'Rahim Uddin', customer_phone: '01712345678', facebook_name: 'Rahim Uddin',
    facebook_thread_url: 'https://www.facebook.com/messages/t/1', source: 'messenger',
    area: 'Mirpur 10, Kazipara', rooms: 2, budget_min: 10000, budget_max: 15000, move_in_date: '2026-12-01',
    tenant_type: 'family', gas: 'line', bathrooms: 1, balconies: 1, facilities: 'lift preferred', requirement_notes: 'Near metro station if possible',
  })
  assert.equal(assignedTo, 'staff@newtolet.com')
  assert.equal(confirmDuplicate, false)
  assert.equal(parseCreateBody({ customer: { name: 'X', facebook_thread_url: 'https://fb.com/t/1' }, confirm_duplicate: true }).confirmDuplicate, true)
})

test('a caller can never send a price, an amount, a payment status or a payment number', () => {
  for (const key of ['service_charge_bdt', 'amount', 'price', 'amount_paid', 'amount_due', 'payment_status', 'payment_verification', 'bkash_number', 'status', 'listings_found_count']) {
    const error = throwsApi(() => parseCreateBody({ ...createBody(), [key]: 50 }), 400, 'VALIDATION_ERROR')
    assert.ok(error.details.some((detail) => detail.includes(key) && detail.includes('set by the server')), key)
  }
  throwsApi(() => parseCreateBody({ ...createBody(), requirements: { area: 'Mirpur', amount_due: 0 } }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseUpdateBody({ service_charge_bdt: 1 }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseCreateBody({ ...createBody(), surprise: true }), 400, 'VALIDATION_ERROR')
})

test('an order needs a customer name and at least one contact channel; PAID_AD is refused', () => {
  throwsApi(() => parseCreateBody({ customer: { phone: '01712345678' } }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseCreateBody({ customer: { name: 'No Contact' } }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseCreateBody({ customer: { name: ' ', phone: '01712345678' } }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseCreateBody({ ...createBody(), type: 'PAID_AD' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseCreateBody([]), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseCreateBody({ customer: 'Rahim' }), 400, 'VALIDATION_ERROR')
  assert.doesNotThrow(() => parseCreateBody({ customer: { name: 'Thread Only', facebook_thread_url: 'https://fb.com/t/1' } }))
})

test('update body: partial, nothing-to-update, assignee can be cleared', () => {
  assert.deepEqual(parseUpdateBody({ requirements: { budget_max: 18000, notes: null } }).fields, { budget_max: 18000, requirement_notes: null })
  assert.equal(parseUpdateBody({ assigned_to: null }).assignedTo, null)
  assert.equal(parseUpdateBody({ requirements: { rooms: 3 } }).assignedTo, undefined)
  throwsApi(() => parseUpdateBody({}), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseUpdateBody({ type: 'HOUSE_SEARCH' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseUpdateBody({ confirm_duplicate: true }), 400, 'VALIDATION_ERROR')
})

test('status body: known status and a reason are required', () => {
  assert.deepEqual(parseStatusBody({ to_status: 'searching_by_human', reason: ' Escalated ', taken_over_by: 'Mosiur' }), {
    toStatus: 'SEARCHING_BY_HUMAN', reason: 'Escalated', takenOverBy: 'Mosiur',
  })
  throwsApi(() => parseStatusBody({ to_status: 'SEARCHING', reason: 'x' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseStatusBody({ to_status: 'NEW', reason: 'x' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseStatusBody({ to_status: 'PAYMENT_INTERESTED' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseStatusBody({ to_status: 'PAYMENT_INTERESTED', reason: '  ' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseStatusBody({ to_status: 'CANCELLED', reason: 'x', amount: 1 }), 400, 'VALIDATION_ERROR')
  assert.deepEqual([...ORDER_STATUSES].sort(), [...CUSTOMER_ORDER_STATUSES].sort())
})

test('payment claim: amount is required, TrxID or last-4 (either one), nothing else', () => {
  assert.deepEqual(parseClaimBody({ amount_bdt: 500, trx_id: '9HX7K2M4P1' }), { amountBdt: 500, trxId: '9HX7K2M4P1', senderLast4: null })
  assert.deepEqual(parseClaimBody({ amount_bdt: 200, sender_last4: '3456' }), { amountBdt: 200, trxId: null, senderLast4: '3456' })
  assert.deepEqual(parseClaimBody({ amount_bdt: 200, sender_last4: 3456 }).senderLast4, '3456')
  const noAmount = throwsApi(() => parseClaimBody({ trx_id: '9HX7K2M4P1' }), 400, 'VALIDATION_ERROR')
  assert.ok(noAmount.details.some((detail) => detail.includes('amount_bdt is required')))
  throwsApi(() => parseClaimBody({ amount_bdt: 500 }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseClaimBody({ amount_bdt: 0, trx_id: 'ABCDEF1' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseClaimBody({ amount_bdt: -5, trx_id: 'ABCDEF1' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseClaimBody({ amount_bdt: 99.5, trx_id: 'ABCDEF1' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseClaimBody({ amount_bdt: '500', trx_id: 'ABCDEF1' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseClaimBody({ amount_bdt: 500, sender_last4: '345' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseClaimBody({ amount_bdt: 500, trx_id: 'ABCDEF1', screenshot: 'http://x/y.png' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseClaimBody({ amount_bdt: 500, trx_id: 'ABCDEF1', status: 'VERIFIED' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseClaimBody({ amount_bdt: 500, trx_id: 'ABCDEF1', bkash_number: '01660034589' }), 400, 'VALIDATION_ERROR')
})

test('verify, note, match and delete bodies', () => {
  assert.deepEqual(parseVerifyBody({ action: 'verify' }), { claimId: null, action: 'verify', note: null })
  assert.equal(parseVerifyBody({ action: 'REJECT', note: 'Not received', claim_id: '11111111-2222-4333-8444-555555555555' }).action, 'reject')
  throwsApi(() => parseVerifyBody({ action: 'reject' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseVerifyBody({ action: 'approve' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseVerifyBody({ action: 'verify', claim_id: 'abc' }), 400, 'VALIDATION_ERROR')
  assert.deepEqual(parseNoteBody({ note: ' call after 6pm ' }), { note: 'call after 6pm' })
  throwsApi(() => parseNoteBody({ note: '' }), 400, 'VALIDATION_ERROR')
  assert.deepEqual(parseMatchBody({ reference_id: 'R-1', general_location: 'Mirpur 10', rent: 14000, verification_status: 'unverified' }).match, {
    reference_id: 'R-1', general_location: 'Mirpur 10', rent: 14000, verification_status: 'unverified',
  })
  throwsApi(() => parseMatchBody({ general_location: 'Mirpur 10' }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseMatchBody({ reference_id: 'R-1', listings_found_count: 9 }), 400, 'VALIDATION_ERROR')
  throwsApi(() => parseMatchBody({ reference_id: 'R-1', owner_permission: 'yes' }), 400, 'VALIDATION_ERROR')
  assert.deepEqual(parseDeleteBody({ reason: 'Duplicate' }), { reason: 'Duplicate' })
  throwsApi(() => parseDeleteBody({}), 400, 'VALIDATION_ERROR')
})

test('list query: every filter of the spec, defaults and limits', () => {
  const q = parseListQuery(new URLSearchParams(
    'q=rahim&status=SEARCHING_BY_AI&status=previews_sent,PAYMENT_INTERESTED&type=HOUSE_SEARCH&phone=%2B8801712345678&area=Mirpur' +
    '&budget_min=8000&budget_max=15000&rooms=2&move_in_from=2026-12-01&move_in_to=2026-12-31&assigned_to=staff@newtolet.com' +
    '&source=messenger&created_via=ai_agent&payment_status=partial_paid&has_listings=false&listings_found_min=1' +
    '&created_from=2026-11-01&created_to=2026-11-16&sort=move_in&page=2&per_page=50',
  ))
  assert.deepEqual(q, {
    q: 'rahim', statuses: ['SEARCHING_BY_AI', 'PREVIEWS_SENT', 'PAYMENT_INTERESTED'], phone: '01712345678', area: 'Mirpur',
    budgetMin: 8000, budgetMax: 15000, rooms: 2, moveInFrom: '2026-12-01', moveInTo: '2026-12-31', assignedTo: 'staff@newtolet.com',
    source: 'messenger', createdVia: 'ai_agent', paymentStatus: 'PARTIAL_PAID', hasListings: false, listingsFoundMin: 1,
    createdFrom: '2026-11-01', createdTo: '2026-11-16', sort: 'move_in', page: 2, perPage: 50,
  })
  const defaults = parseListQuery(new URLSearchParams(''))
  assert.equal(defaults.sort, 'newest')
  assert.equal(defaults.page, 1)
  assert.equal(defaults.perPage, 20)
  assert.equal(defaults.hasListings, null)
})

test('list query rejects bad values instead of ignoring them', () => {
  const bad = (query) => throwsApi(() => parseListQuery(new URLSearchParams(query)), 400, 'VALIDATION_ERROR')
  bad('per_page=101')
  bad('page=0')
  bad('status=SEARCHING')
  bad('status=NEW')
  bad('type=PAID_AD')
  bad('phone=12345')
  bad('payment_status=HALF')
  bad('has_listings=yes')
  bad('move_in_from=2026-02-31')
  bad('created_to=16-11-2026')
  bad('budget_min=20000&budget_max=10000')
  bad('sort=random')
  bad('unknown_filter=1')
})

test('phone, pattern and Dhaka-day helpers', () => {
  assert.equal(normalizePhone('+880 1712-345678'), '01712345678')
  assert.equal(normalizePhone('8801712345678'), '01712345678')
  assert.equal(normalizePhone('01212345678'), null)
  assert.equal(normalizePhone('0171234567'), null)
  assert.equal(escapePattern('50%_off (a,b)*'), '50\\%\\_off a b')
  assert.equal(dhakaDayStart('2026-11-16'), '2026-11-16T00:00:00+06:00')
  assert.equal(dhakaNextDayStart('2026-12-31'), '2027-01-01T00:00:00+06:00')
})

// ---------------------------------------------------------------------------
// Response shaping and owner-contact masking
// ---------------------------------------------------------------------------

const orderRow = (overrides = {}) => ({
  id: '11111111-2222-4333-8444-555555555555', order_no: 'NT-2026-0001', type: 'HOUSE_SEARCH', status: 'PAYMENT_CLAIMED',
  search_mode: 'AI', search_taken_over_by: null, created_via: 'ai_agent', created_by_label: 'agent-1', source: 'messenger',
  customer_name: 'Rahim Uddin', customer_phone: '01712345678', facebook_name: null, facebook_thread_url: null,
  area: 'Mirpur 10', rooms: 2, budget_min: 10000, budget_max: 15000, move_in_date: '2026-12-01', tenant_type: 'family',
  gas: null, bathrooms: null, balconies: null, facilities: null, requirement_notes: null, service_charge_bdt: 500,
  payment_status: 'PARTIAL_PAID', amount_paid: 200, amount_verified: 200, amount_due: 300, overpaid: false, payment_verification: 'CLAIMED',
  listings_found_count: 2, listings_verified_count: 1, listings_unverified_count: 1, contact_unlocked: false,
  assigned_to: null, assignee_name: null, follow_up_at: null, payment_claimed_at: null, payment_verified_at: null,
  idempotency_key: 'thread-1', legacy_order_id: null, deleted_at: null, created_at: '2026-11-16T04:00:00+00:00', updated_at: '2026-11-16T04:00:00+00:00',
  ...overrides,
})

const matchRow = (overrides = {}) => ({
  id: 'aaaaaaaa-2222-4333-8444-555555555555', reference_id: 'R-1', property_id: null, general_location: 'Mirpur 10', rent: 14000,
  verification_status: 'verified', owner_contact_phone: '01911111111', exact_address: 'House 5, Road 2', owner_permission: true,
  created_by_label: 'agent-1', created_at: '2026-11-16T05:00:00+00:00', ...overrides,
})

test('every order response carries the derived payment and listings fields', () => {
  const order = serializeOrder(orderRow())
  assert.equal(order.id, 'NT-2026-0001')
  for (const key of ['payment_status', 'amount_paid', 'amount_due', 'payment_verification', 'listings_found_count', 'listings_verified_count', 'listings_unverified_count', 'service_charge_bdt']) {
    assert.ok(key in order, key)
  }
  assert.deepEqual(
    [order.payment_status, order.amount_paid, order.amount_due, order.payment_verification, order.listings_found_count, order.listings_verified_count, order.listings_unverified_count],
    ['PARTIAL_PAID', 200, 300, 'CLAIMED', 2, 1, 1],
  )
  assert.equal(order.requirements.family_or_bachelor, 'family')
  assert.equal(order.customer.phone, '01712345678')
  // Internal columns stay internal.
  assert.ok(!('idempotency_key' in order) && !('legacy_order_id' in order) && !('deleted_at' in order))
})

test('owner phone and exact address are returned only for a fully paid + verified order with owner permission', () => {
  const locked = serializeMatch(matchRow(), false)
  assert.equal(locked.owner_contact_available, false)
  assert.ok(!('owner_contact_phone' in locked) && !('exact_address' in locked))

  // A verified PARTIAL payment: the order is not unlocked, so nothing is returned.
  const partial = serializeDetail(orderRow({ payment_verification: 'CLAIMED', amount_verified: 200, contact_unlocked: false }), [], [matchRow()], [])
  assert.ok(!JSON.stringify(partial).includes('01911111111'))
  assert.ok(!JSON.stringify(partial).includes('House 5'))
  assert.equal(partial.owner_contact_unlocked, false)

  // Unlocked order, but the owner has not agreed for this listing.
  const noPermission = serializeMatch(matchRow({ owner_permission: false }), true)
  assert.ok(!('owner_contact_phone' in noPermission))

  const unlocked = serializeDetail(orderRow({ status: 'PAYMENT_VERIFIED', payment_verification: 'VERIFIED', contact_unlocked: true }), [], [matchRow(), matchRow({ id: 'b', owner_permission: false, owner_contact_phone: '01922222222' })], [])
  assert.equal(unlocked.matches[0].owner_contact_phone, '01911111111')
  assert.equal(unlocked.matches[0].exact_address, 'House 5, Road 2')
  assert.ok(!JSON.stringify(unlocked).includes('01922222222'))
})

test('timeline entries never carry owner phone or exact address', () => {
  const timeline = serializeTimeline([
    { kind: 'activity', action: 'match.update', before: { owner_contact_phone: '01911111111' }, after: { owner_contact_phone: '01933333333', exact_address: 'House 9', verification_status: 'verified' } },
    { kind: 'note', body: 'call after 6pm' },
  ])
  assert.deepEqual(timeline[0].after, { verification_status: 'verified' })
  assert.deepEqual(timeline[0].before, {})
  assert.equal(timeline[1].body, 'call after 6pm')
  assert.deepEqual(serializeTimeline(null), [])
})

// ---------------------------------------------------------------------------
// Envelope and database-error mapping
// ---------------------------------------------------------------------------

test('JSON envelope', () => {
  assert.deepEqual(okBody({ id: 'NT-2026-0001' }), { success: true, data: { id: 'NT-2026-0001' } })
  assert.deepEqual(okBody([], { page: 1 }), { success: true, data: [], meta: { page: 1 } })
  assert.deepEqual(errorBody(new ApiError(403, 'FORBIDDEN', 'No')), { success: false, error: { code: 'FORBIDDEN', message: 'No' } })
})

test('SQL errors map onto the documented codes', () => {
  const map = (message, hint) => fromDbError({ message, hint })
  assert.deepEqual([map('ADMIN_VALIDATION: amount_bdt is required for a payment claim.').status, map('ADMIN_VALIDATION: x').code], [400, 'VALIDATION_ERROR'])
  assert.equal(map('ADMIN_VALIDATION: amount_bdt is required for a payment claim.').message, 'amount_bdt is required for a payment claim.')
  assert.deepEqual([map('ADMIN_NOT_FOUND: Order was not found.').status, map('ADMIN_NOT_FOUND: x').code], [404, 'NOT_FOUND'])
  assert.deepEqual([map('ADMIN_PERMISSION_DENIED: x').status, map('ADMIN_PERMISSION_DENIED: x').code], [403, 'FORBIDDEN'])

  const transition = map('ADMIN_INVALID_TRANSITION: Cannot move PENDING → PAYMENT_VERIFIED.', 'entity=customer_order;from=PENDING;to=PAYMENT_VERIFIED')
  assert.equal(transition.status, 422)
  assert.equal(transition.code, 'INVALID_TRANSITION')
  assert.deepEqual(transition.extra, { from_status: 'PENDING', to_status: 'PAYMENT_VERIFIED' })

  const duplicate = map('ADMIN_CONFLICT: An active order (NT-2026-0007) already exists for this customer and area.', 'duplicate_of=NT-2026-0007')
  assert.equal(duplicate.status, 409)
  assert.equal(duplicate.code, 'DUPLICATE_ORDER_WARNING')
  assert.equal(errorBody(duplicate).error.existing_order_id, 'NT-2026-0007')

  assert.equal(map('ADMIN_CONFLICT: This TrxID is already recorded on the order.', 'duplicate_trx').code, 'CONFLICT')
  const unknown = map('relation "secret_table" does not exist')
  assert.equal(unknown.status, 500)
  assert.ok(!unknown.message.includes('secret_table'), 'database text is not leaked')
})

// ---------------------------------------------------------------------------
// index.ts <-> SQL contract
// ---------------------------------------------------------------------------

const sqlParams = (fn) => {
  const start = migration.indexOf(`create or replace function public.${fn}(`)
  assert.ok(start >= 0, `${fn} exists in the migration`)
  const open = migration.indexOf('(', start)
  let depth = 0
  let end = open
  for (let i = open; i < migration.length; i += 1) {
    if (migration[i] === '(') depth += 1
    if (migration[i] === ')') depth -= 1
    if (depth === 0) {
      end = i
      break
    }
  }
  return [...migration.slice(open + 1, end).matchAll(/\b(p_[a-z0-9_]+)\b/g)].map((m) => m[1])
}

test('every rpc call in index.ts uses a function and parameter names that exist in the migration', () => {
  const calls = [...indexSource.matchAll(/rpc\((?:supabase,\s*)?"(co_[a-z_]+)",\s*\{([^}]*)\}/g)]
  assert.ok(calls.length >= 10, `found ${calls.length} rpc calls`)
  const actor = ['p_actor_type', 'p_actor_id', 'p_actor_label']
  for (const [, fn, body] of calls) {
    const params = sqlParams(fn)
    const sent = [...body.matchAll(/\b(p_[a-z0-9_]+)\s*:/g)].map((m) => m[1])
    if (body.includes('...actor')) sent.push(...actor)
    for (const name of sent) assert.ok(params.includes(name), `${fn} has no parameter ${name}`)
    // Parameters without a SQL default must be sent.
    const signature = migration.slice(migration.indexOf(`create or replace function public.${fn}(`), migration.indexOf('returns', migration.indexOf(`create or replace function public.${fn}(`)))
    for (const name of params) {
      const hasDefault = new RegExp(`${name}\\s+[a-z]+\\s+default`).test(signature)
      if (!hasDefault) assert.ok(sent.includes(name), `${fn} call is missing ${name}`)
    }
  }
})

test('index.ts never writes to a customer-order table directly', () => {
  assert.ok(!/\.(insert|update|upsert|delete)\(/.test(indexSource), 'all writes go through co_* functions')
  const code = indexSource.replace(/\/\/.*$/gm, '')
  assert.ok(!/service_charge|price/i.test(code), 'the API layer never names a price')
  // The only amount the API ever forwards is the amount a customer paid on a claim.
  assert.deepEqual([...new Set([...code.matchAll(/\bp_[a-z_]*amount[a-z_]*/g)].map((m) => m[0]))], ['p_amount_bdt'])
})
