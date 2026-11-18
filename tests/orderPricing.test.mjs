import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  ORDER_DISCOUNT_PERCENT,
  ORDER_REGULAR_PRICE_BDT,
  getOrderPricing,
  isOrderAwaitingPayment,
} from '../src/lib/orderPricing.js'

test('the current offer is 1000 BDT less 50%', () => {
  assert.deepEqual(getOrderPricing(), {
    regular: 1000,
    discountPercent: 50,
    payable: 500,
    hasDiscount: true,
  })
})

test('the displayed price matches what the database charges', () => {
  const sql = readFileSync(
    fileURLToPath(new URL('../supabase/migrations/20261118100000_order_eps_payment.sql', import.meta.url)),
    'utf8'
  )
  const read = (key) => {
    const match = sql.match(new RegExp(`'${key}',\\s*(\\d+)`))
    assert.ok(match, `${key} not found in order_home_pricing()`)
    return Number(match[1])
  }

  assert.equal(read('regular_bdt'), ORDER_REGULAR_PRICE_BDT)
  assert.equal(read('discount_percent'), ORDER_DISCOUNT_PERCENT)
  assert.equal(read('payable_bdt'), getOrderPricing().payable)
})

test('only pending_payment orders can be paid for', () => {
  assert.equal(isOrderAwaitingPayment({ status: 'pending_payment' }), true)
  for (const status of ['pending', 'confirmed', 'completed', 'cancelled', undefined]) {
    assert.equal(isOrderAwaitingPayment({ status }), false)
  }
  assert.equal(isOrderAwaitingPayment(null), false)
})
