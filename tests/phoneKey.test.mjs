import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePhoneForDuplicateKey } from '../src/lib/phoneKey.js'

// Mirrors the SQL generated column: nullif(right(regexp_replace(x, '\D', '', 'g'), 11), '')
test('keeps the last 11 digits', () => {
  assert.equal(normalizePhoneForDuplicateKey('+880 1711-111111'), '01711111111')
  assert.equal(normalizePhoneForDuplicateKey('01711111111'), '01711111111')
  assert.equal(normalizePhoneForDuplicateKey('8801711111111'), '01711111111')
  assert.equal(normalizePhoneForDuplicateKey('1234'), '1234')
})

test('null for empty or non-numeric input', () => {
  assert.equal(normalizePhoneForDuplicateKey(''), null)
  assert.equal(normalizePhoneForDuplicateKey('   '), null)
  assert.equal(normalizePhoneForDuplicateKey('abc'), null)
  assert.equal(normalizePhoneForDuplicateKey(null), null)
  assert.equal(normalizePhoneForDuplicateKey(undefined), null)
})
