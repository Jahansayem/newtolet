// Listing quality gate (QA audit 2026-11-14): owner form validation and the AI agent API.
// The agent validator is TypeScript without Deno-only imports; Node 22 strips the types.
import test from 'node:test'
import assert from 'node:assert/strict'

import { validateScreen1Codes, validateScreen2Codes } from '../src/utils/formValidation.js'
import { validateCreateBody, validatePatchBody } from '../supabase/functions/agent-listings/validation.ts'

const screen1 = { category: 'Family', total_rooms: 2, total_bathrooms: 1, balcony: 0, kitchen: 1, floor_level: '2', occupancy: 'Only Family' }

test('owner form: homes need a bedroom count, offices do not', () => {
  assert.equal(validateScreen1Codes({ ...screen1, total_rooms: 0 }).total_rooms.code, 'bedroomsRequired')
  assert.equal(validateScreen1Codes({ ...screen1 }).total_rooms, undefined)
  assert.equal(validateScreen1Codes({ ...screen1, category: 'Office', total_rooms: 0 }).total_rooms, undefined)
  assert.equal(validateScreen1Codes({ ...screen1, total_bathrooms: 0 }).total_bathrooms.code, 'bathroomsInvalid')
})

test('owner form: monthly rent must be at least 100 unless negotiable', () => {
  assert.equal(validateScreen2Codes({ rent_amount_bdt: 1, rent_period: 'Monthly' }).rent_amount_bdt.code, 'rentAmountTooLow')
  assert.equal(validateScreen2Codes({ rent_amount_bdt: 99, rent_period: 'Monthly' }).rent_amount_bdt.params.min, 100)
  assert.equal(validateScreen2Codes({ rent_amount_bdt: 100, rent_period: 'Monthly' }).rent_amount_bdt, undefined)
  assert.equal(validateScreen2Codes({ rent_amount_bdt: '', is_rent_negotiable: true, rent_period: 'Monthly' }).rent_amount_bdt, undefined)
  assert.equal(validateScreen2Codes({ rent_amount_bdt: 80, rent_period: 'Daily' }).rent_amount_bdt, undefined)
})

const agentBody = {
  category: 'Family',
  property_type: 'Apartment',
  rent_period: 'Monthly',
  state_district: 'Dhaka',
  area: 'Mirpur',
  available_from: '2026-12-01',
  total_rooms: 2,
  total_bathrooms: 1,
  rent_amount_bdt: 15000,
}

const agentErrors = (fn, body) => {
  try {
    fn(body)
    return []
  } catch (error) {
    return error.details || [error.message]
  }
}

test('agent API: a normal listing passes', () => {
  assert.deepEqual(agentErrors(validateCreateBody, agentBody), [])
})

test('agent API: 1-Taka placeholder rent is rejected with a clear hint', () => {
  const errors = agentErrors(validateCreateBody, { ...agentBody, rent_amount_bdt: 1 })
  assert.equal(errors.length, 1)
  assert.match(errors[0], /at least 100.*is_rent_negotiable/)
  const { rent_amount_bdt: _omit, ...withoutRent } = agentBody
  assert.deepEqual(agentErrors(validateCreateBody, { ...withoutRent, is_rent_negotiable: true }), [])
  assert.match(agentErrors(validatePatchBody, { rent_amount_bdt: 5 })[0], /at least 100/)
})

test('agent API: homes need bedrooms and bathrooms; shops do not', () => {
  assert.match(agentErrors(validateCreateBody, { ...agentBody, total_rooms: 0 }).join(' '), /total_rooms must be at least 1/)
  assert.match(agentErrors(validateCreateBody, { ...agentBody, total_bathrooms: 0 }).join(' '), /total_bathrooms must be at least 1/)
  assert.deepEqual(agentErrors(validateCreateBody, { ...agentBody, category: 'Shop', property_type: 'Shop', total_rooms: 0, total_bathrooms: 0 }), [])
})
