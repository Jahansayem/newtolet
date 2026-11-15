import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AGENT_BLOCKED_TRANSITIONS,
  CLOSED_STATUSES,
  CUSTOMER_ORDER_STATUSES,
  CUSTOMER_ORDER_STATUS_META,
  CUSTOMER_ORDER_TRANSITIONS,
  PAYMENT_DRIVEN_STATUSES,
  canTransition,
  describeTimelineItem,
  formatListingsCell,
  formatPaymentCell,
  getStatusChangeOptions,
  getTransitionBlocker,
  isAgentAllowed,
  isFollowUpOverdue,
  previewVerification,
  refundWindowDaysLeft,
  summarizePayment,
} from '../src/lib/customerOrderStatus.js'

const migration = readFileSync(new URL('../supabase/migrations/20261116090000_customer_orders.sql', import.meta.url), 'utf8')

// The seeded transition rows: ('FROM', 'TO', true|false)
const sqlTransitions = () => {
  const start = migration.indexOf('insert into public.customer_order_transitions')
  const block = migration.slice(start, migration.indexOf(';', start))
  return [...block.matchAll(/\('([A-Z_]+)',\s*'([A-Z_]+)',\s*(true|false)\)/g)].map(([, from, to, agent]) => ({ from, to, agent: agent === 'true' }))
}

test('the JS transition table is identical to the SQL seed', () => {
  const rows = sqlTransitions()
  assert.ok(rows.length > 50, 'transition rows were parsed from the migration')
  const fromSql = {}
  for (const { from, to } of rows) (fromSql[from] ||= []).push(to)
  for (const status of CUSTOMER_ORDER_STATUSES) {
    assert.deepEqual([...(CUSTOMER_ORDER_TRANSITIONS[status] || [])].sort(), [...(fromSql[status] || [])].sort(), `targets of ${status}`)
  }
  assert.deepEqual(Object.keys(CUSTOMER_ORDER_TRANSITIONS).sort(), [...CUSTOMER_ORDER_STATUSES].sort())
})

test('agent-blocked moves match the SQL agent_allowed flags', () => {
  const blocked = sqlTransitions().filter((row) => !row.agent).map((row) => `${row.from}>${row.to}`).sort()
  assert.deepEqual(AGENT_BLOCKED_TRANSITIONS.map(([from, to]) => `${from}>${to}`).sort(), blocked)
  assert.equal(isAgentAllowed('REFUND_REQUESTED', 'REFUNDED'), false)
  assert.equal(isAgentAllowed('CANCELLED', 'PENDING'), false)
  assert.equal(isAgentAllowed('PENDING', 'SEARCHING_BY_AI'), true)
})

test('the status list matches the SQL CHECK constraint and every status has a label', () => {
  const check = /status text not null default 'PENDING' check \(status in \(([^)]+)\)\)/.exec(migration)
  assert.ok(check, 'status CHECK found')
  const sqlStatuses = [...check[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
  assert.deepEqual([...CUSTOMER_ORDER_STATUSES].sort(), sqlStatuses.sort())
  for (const status of CUSTOMER_ORDER_STATUSES) assert.ok(CUSTOMER_ORDER_STATUS_META[status]?.label, status)
})

test('payment statuses can never be chosen by hand', () => {
  for (const [from, targets] of Object.entries(CUSTOMER_ORDER_TRANSITIONS)) {
    for (const to of targets) assert.ok(!PAYMENT_DRIVEN_STATUSES.includes(to), `${from} -> ${to}`)
  }
  assert.equal(canTransition('PENDING', 'PAYMENT_VERIFIED'), false)
  assert.equal(canTransition('PAYMENT_INTERESTED', 'PAYMENT_CLAIMED'), false)
  assert.equal(canTransition('PAYMENT_CLAIMED', 'PAYMENT_VERIFIED'), false)
})

test('illegal moves from the brief are rejected', () => {
  assert.equal(canTransition('PENDING', 'PAYMENT_VERIFIED'), false)
  assert.equal(canTransition('PAYMENT_CLAIMED', 'COMPLETED'), false)
  assert.equal(canTransition('COMPLETED', 'SEARCHING_BY_AI'), false)
  assert.equal(canTransition('PENDING', 'PENDING'), false)
  assert.equal(canTransition('REFUNDED', 'PENDING'), false)
})

test('search handover works in both directions and search may continue after payment', () => {
  assert.equal(canTransition('SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN'), true)
  assert.equal(canTransition('SEARCHING_BY_HUMAN', 'SEARCHING_BY_AI'), true)
  assert.equal(canTransition('PAYMENT_VERIFIED', 'SEARCHING_BY_HUMAN'), true)
  assert.equal(canTransition('PENDING', 'SEARCHING_BY_AI'), true)
  assert.equal(canTransition('PREVIEWS_SENT', 'SEARCHING_BY_AI'), true)
})

test('closed statuses: only CANCELLED and SELF_SERVICE can be reopened', () => {
  assert.deepEqual(CUSTOMER_ORDER_TRANSITIONS.COMPLETED, [])
  assert.deepEqual(CUSTOMER_ORDER_TRANSITIONS.REFUNDED, [])
  assert.deepEqual(CUSTOMER_ORDER_TRANSITIONS.CANCELLED, ['PENDING'])
  assert.deepEqual(CUSTOMER_ORDER_TRANSITIONS.SELF_SERVICE, ['PENDING'])
  assert.deepEqual([...CLOSED_STATUSES].sort(), ['CANCELLED', 'COMPLETED', 'REFUNDED', 'SELF_SERVICE'])
})

test('partial-payment maths: PENDING -> PARTIAL_PAID -> PAID, amount due, overpayment', () => {
  assert.deepEqual(summarizePayment(500, []), {
    amountPaid: 0, amountVerified: 0, amountDue: 500, overpaid: false, paymentStatus: 'PENDING', paymentVerification: 'UNVERIFIED', openClaims: 0,
  })
  const partial = summarizePayment(500, [{ id: 'a', amount_bdt: 200, status: 'CLAIMED' }])
  assert.equal(partial.paymentStatus, 'PARTIAL_PAID')
  assert.equal(partial.amountPaid, 200)
  assert.equal(partial.amountDue, 300)
  assert.equal(partial.paymentVerification, 'CLAIMED')

  const full = summarizePayment(500, [{ id: 'a', amount_bdt: 200, status: 'CLAIMED' }, { id: 'b', amount_bdt: 300, status: 'CLAIMED' }])
  assert.equal(full.paymentStatus, 'PAID')
  assert.equal(full.amountDue, 0)
  assert.equal(full.overpaid, false)
  assert.equal(full.paymentVerification, 'CLAIMED', 'claims alone never verify')
  assert.equal(full.openClaims, 2)

  const over = summarizePayment(500, [{ id: 'a', amount_bdt: 600, status: 'CLAIMED' }])
  assert.equal(over.overpaid, true)
  assert.equal(over.amountDue, 0)
  assert.equal(over.paymentStatus, 'PAID')
})

test('rejected claims never count; a verified partial payment is not a verified order', () => {
  const rejected = summarizePayment(500, [{ id: 'a', amount_bdt: 500, status: 'REJECTED' }])
  assert.equal(rejected.paymentStatus, 'PENDING')
  assert.equal(rejected.amountDue, 500)
  assert.equal(rejected.paymentVerification, 'UNVERIFIED')

  const verifiedPartial = summarizePayment(500, [{ id: 'a', amount_bdt: 200, status: 'VERIFIED' }, { id: 'b', amount_bdt: 300, status: 'CLAIMED' }])
  assert.equal(verifiedPartial.paymentStatus, 'PAID')
  assert.equal(verifiedPartial.amountVerified, 200)
  assert.equal(verifiedPartial.paymentVerification, 'CLAIMED')

  const verified = summarizePayment(500, [{ id: 'a', amount_bdt: 200, status: 'VERIFIED' }, { id: 'b', amount_bdt: 300, status: 'VERIFIED' }])
  assert.equal(verified.paymentVerification, 'VERIFIED')
})

test('previewVerification says whether one more verified claim completes the order', () => {
  const claims = [{ id: 'a', amount_bdt: 200, status: 'CLAIMED' }, { id: 'b', amount_bdt: 300, status: 'CLAIMED' }]
  assert.deepEqual(previewVerification(500, claims, 'a'), { completesOrder: false, stillUnverified: 300 })
  assert.deepEqual(previewVerification(500, [{ ...claims[0], status: 'VERIFIED' }, claims[1]], 'b'), { completesOrder: true, stillUnverified: 0 })
})

test('status-change options carry the payment guards', () => {
  const unpaid = { status: 'PREVIEWS_SENT', service_charge_bdt: 500, amount_verified: 0 }
  const options = getStatusChangeOptions(unpaid)
  assert.equal(options.find((o) => o.value === 'MATCHED').disabled, true)
  assert.equal(options.find((o) => o.value === 'REFUND_REQUESTED').disabled, true)
  assert.equal(options.find((o) => o.value === 'CANCELLED').disabled, false)
  assert.ok(!options.some((o) => PAYMENT_DRIVEN_STATUSES.includes(o.value)))

  const paid = { status: 'PREVIEWS_SENT', service_charge_bdt: 500, amount_verified: 500 }
  assert.equal(getTransitionBlocker(paid, 'MATCHED'), null)
  assert.equal(getTransitionBlocker(paid, 'REFUND_REQUESTED'), null)
  assert.ok(getTransitionBlocker(paid, 'CANCELLED'))
  assert.ok(getTransitionBlocker({ ...paid, amount_verified: 200 }, 'MATCHED'), 'a verified partial payment does not allow MATCHED')
  assert.deepEqual(getStatusChangeOptions({ status: 'COMPLETED' }), [])
})

test('list cells', () => {
  assert.equal(formatPaymentCell({ payment_status: 'PENDING', amount_paid: 0, amount_due: 500 }), '500 due')
  assert.equal(formatPaymentCell({ payment_status: 'PARTIAL_PAID', amount_paid: 300, amount_due: 200 }), '300 paid, 200 due')
  assert.equal(formatPaymentCell({ payment_status: 'PAID', amount_paid: 500, amount_due: 0 }), 'Paid ✓')
  assert.equal(formatPaymentCell({ payment_status: 'PAID', amount_paid: 600, amount_due: 0, overpaid: true }), 'Paid ✓ (600, overpaid)')
  assert.equal(formatListingsCell({ listings_found_count: 5, listings_verified_count: 2 }), '5 (2 verified)')
  assert.equal(formatListingsCell({ listings_found_count: 0 }), '0')
})

test('refund window and overdue follow-ups ignore closed orders', () => {
  const now = Date.parse('2026-11-16T12:00:00Z')
  assert.equal(refundWindowDaysLeft({ status: 'SEARCHING_BY_HUMAN', payment_verified_at: '2026-11-14T12:00:00Z' }, now), 5)
  assert.equal(refundWindowDaysLeft({ status: 'SEARCHING_BY_HUMAN', payment_verified_at: '2026-11-01T12:00:00Z' }, now), null)
  assert.equal(refundWindowDaysLeft({ status: 'COMPLETED', payment_verified_at: '2026-11-14T12:00:00Z' }, now), null)
  assert.equal(refundWindowDaysLeft({ status: 'PENDING' }, now), null)
  assert.equal(isFollowUpOverdue({ status: 'PENDING', follow_up_at: '2026-11-15T00:00:00Z' }, now), true)
  assert.equal(isFollowUpOverdue({ status: 'CANCELLED', follow_up_at: '2026-11-15T00:00:00Z' }, now), false)
  assert.equal(isFollowUpOverdue({ status: 'PENDING', follow_up_at: '2026-11-17T00:00:00Z' }, now), false)
})

test('timeline entries name the handover and the payment reference', () => {
  const handover = describeTimelineItem({ kind: 'status', from_status: 'SEARCHING_BY_AI', to_status: 'SEARCHING_BY_HUMAN', reason: 'Escalated', taken_over_by: 'Mosiur' })
  assert.equal(handover.title, 'Searching by AI → Searching by human')
  assert.equal(handover.detail, 'Search taken over by Mosiur. Escalated')
  assert.equal(describeTimelineItem({ kind: 'activity', action: 'payment.claim', after: { amount_bdt: 200, sender_last4: '3456' } }).detail, '200 BDT, sender last-4 3456')
  assert.equal(describeTimelineItem({ kind: 'note', body: 'Call after 6pm' }).detail, 'Call after 6pm')
  assert.equal(describeTimelineItem({ kind: 'status', from_status: null, to_status: 'PENDING', reason: 'Order created' }).title, 'Pending')
})
