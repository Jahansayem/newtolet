import test from 'node:test'
import assert from 'node:assert/strict'
import { mapPaymentStatus, mapPaymentTransactionRecord, rawValuesFor } from '../src/lib/paymentStatus.js'

test('legacy raw values map to canonical statuses', () => {
  assert.equal(mapPaymentStatus('paid'), 'credited')
  assert.equal(mapPaymentStatus('success'), 'credited')
  assert.equal(mapPaymentStatus('created'), 'pending')
  assert.equal(mapPaymentStatus('awaiting_admin_approval'), 'awaiting_admin_approval')
  assert.equal(mapPaymentStatus(undefined), 'pending')
  assert.equal(mapPaymentStatus('weird'), 'weird')
})

test('rawValuesFor expands a canonical filter to every stored value', () => {
  assert.deepEqual(rawValuesFor('credited'), ['credited', 'paid', 'success'])
  assert.deepEqual(rawValuesFor('pending'), ['pending', 'created'])
  assert.deepEqual(rawValuesFor('custom'), ['custom'])
  assert.deepEqual(rawValuesFor(''), [])
})

test('record mapper keeps the raw status and normalises numbers', () => {
  const mapped = mapPaymentTransactionRecord({ id: 'x', status: 'paid', amount: '500.00', credits_to_add: '50', reference: 'INV-1', payment_method: 'BKASH' })
  assert.equal(mapped.status, 'credited')
  assert.equal(mapped.raw_status, 'paid')
  assert.equal(mapped.amount, 500)
  assert.equal(mapped.credits_to_add, 50)
  assert.equal(mapped.invoice_id, 'INV-1')
  assert.equal(mapped.transaction_id, 'INV-1')
  assert.equal(mapped.payment_method, 'bkash')
  assert.equal(mapped.description, '50 credits purchase')
})
