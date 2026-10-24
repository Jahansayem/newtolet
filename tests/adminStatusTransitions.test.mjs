import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_STATUS_TRANSITIONS,
  canTransition,
  getAllowedTransitions,
  getStatusOptions,
  isTerminal,
  getStatusLabel,
} from '../src/lib/adminStatusTransitions.js'

test('self transitions are never allowed', () => {
  for (const [domain, map] of Object.entries(ADMIN_STATUS_TRANSITIONS)) {
    for (const status of Object.keys(map)) assert.equal(canTransition(domain, status, status), false, `${domain}.${status}`)
  }
})

test('every target is a known status of its domain', () => {
  for (const [domain, map] of Object.entries(ADMIN_STATUS_TRANSITIONS)) {
    const known = new Set(Object.keys(map))
    for (const [from, targets] of Object.entries(map)) {
      for (const to of targets) assert.ok(known.has(to), `${domain}: ${from} -> ${to}`)
    }
  }
})

test('terminal states', () => {
  assert.equal(isTerminal('payment', 'refunded'), true)
  assert.equal(isTerminal('payment', 'cancelled'), true)
  assert.equal(isTerminal('order', 'completed'), true)
  assert.equal(isTerminal('order', 'pending'), false)
  assert.equal(isTerminal('order', 'nonsense'), false)
})

test('orders include pending_payment and the UI gets it as an option', () => {
  assert.deepEqual(getAllowedTransitions('order', 'pending_payment'), ['pending', 'cancelled'])
  const options = getStatusOptions('order', 'pending_payment')
  const current = options.find((o) => o.value === 'pending_payment')
  assert.ok(current && current.current && !current.disabled)
  assert.equal(options.find((o) => o.value === 'completed').disabled, true)
  assert.equal(options.find((o) => o.value === 'pending').disabled, false)
})

test('unknown current status is still rendered and everything else disabled', () => {
  const options = getStatusOptions('payment', 'paid')
  assert.equal(options[0].value, 'paid')
  assert.equal(options[0].current, true)
  assert.ok(options.slice(1).every((o) => o.disabled))
})

test('dedicated payment transitions are disabled for the generic path', () => {
  const options = getStatusOptions('payment', 'awaiting_admin_approval')
  assert.equal(options.find((o) => o.value === 'credited').disabled, true)
  assert.equal(options.find((o) => o.value === 'failed').disabled, false)
  const withDedicated = getStatusOptions('payment', 'awaiting_admin_approval', { includeDedicated: true })
  assert.equal(withDedicated.find((o) => o.value === 'credited').disabled, false)
})

test('labels fall back to humanised status', () => {
  assert.equal(getStatusLabel('order', 'pending_payment'), 'Pending payment')
  assert.equal(getStatusLabel('order', 'weird_state'), 'Weird state')
  assert.equal(getStatusLabel('order', ''), 'Unknown')
})
