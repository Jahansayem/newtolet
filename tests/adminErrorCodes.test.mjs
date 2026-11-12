import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyError, ADMIN_ERROR_CODES as C, parseHintDetails } from '../src/lib/adminErrorCodes.js'

const cases = [
  ['abort', { name: 'AbortError', message: 'aborted' }, C.ABORTED, false, false],
  ['synthetic 503', { code: 'SUPABASE_CONNECTION_UNAVAILABLE', status: 503, message: 'unreachable' }, C.UNAVAILABLE, true, false],
  ['failed to fetch', new TypeError('Failed to fetch'), C.UNAVAILABLE, true, false],
  ['restricted', { code: 'SUPABASE_PROJECT_RESTRICTED', status: 402, message: 'quota' }, C.RESTRICTED, false, false],
  ['jwt expired', { code: 'PGRST301', message: 'JWT expired', status: 401 }, C.AUTH_EXPIRED, false, true],
  ['rls', { code: '42501', message: 'new row violates row-level security policy' }, C.PERMISSION_DENIED, false, true],
  ['http 403', { status: 403, message: 'Forbidden' }, C.PERMISSION_DENIED, false, true],
  ['rpc permission prefix', { code: 'P0001', message: 'ADMIN_PERMISSION_DENIED: You do not have the payments.review permission.' }, C.PERMISSION_DENIED, false, true],
  ['rpc transition prefix', { code: 'P0001', message: 'ADMIN_INVALID_TRANSITION: A payment cannot move from credited to failed.', hint: 'entity=payment;from=credited;to=failed' }, C.INVALID_TRANSITION, false, false],
  ['rpc validation prefix', { code: 'P0001', message: 'ADMIN_VALIDATION: A reason is required.' }, C.VALIDATION, false, false],
  ['rpc conflict prefix', { code: 'P0001', message: 'ADMIN_CONFLICT: already blacklisted' }, C.CONFLICT, false, false],
  ['rpc credits prefix', { code: 'P0001', message: 'ADMIN_INSUFFICIENT_CREDITS: only 5 credits' }, C.INSUFFICIENT_CREDITS, false, false],
  ['rpc not found prefix', { code: 'P0001', message: 'ADMIN_NOT_FOUND: Listing was not found.' }, C.NOT_FOUND, false, false],
  ['legacy admin required', { code: 'P0001', message: 'Admin access required.' }, C.PERMISSION_DENIED, false, true],
  ['legacy already reviewed', { code: 'P0001', message: 'Refund request has already been reviewed.' }, C.INVALID_TRANSITION, false, false],
  ['legacy unknown rpc', { code: 'P0001', message: 'Something odd' }, C.RPC_ERROR, false, false],
  ['no rows', { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, C.NOT_FOUND, false, false],
  ['unique', { code: '23505', message: 'duplicate key value' }, C.CONFLICT, false, false],
  ['check status', { code: '23514', message: 'violates check constraint "feedback_status_check"' }, C.INVALID_TRANSITION, false, false],
  ['check other', { code: '23514', message: 'violates check constraint "amount_positive"' }, C.CHECK_VIOLATION, false, false],
  ['fk', { code: '23503', message: 'violates foreign key constraint' }, C.FK_VIOLATION, false, false],
  ['missing table', { code: 'PGRST205', message: "Could not find the table 'public.activities'" }, C.MISSING_TABLE, false, false],
  ['missing column', { code: 'PGRST204', message: "Could not find the 'is_employee' column of 'users'" }, C.MISSING_COLUMN, false, false],
  ['missing rpc', { code: 'PGRST202', message: 'Could not find the function public.admin_x' }, C.MISSING_RPC, false, false],
  ['invalid uuid', { code: '22P02', message: 'invalid input syntax for type uuid' }, C.INVALID_INPUT, false, false],
  ['too many requests', { status: 429, message: 'Too Many Requests' }, C.TRANSIENT, true, false],
  ['server 500', { status: 500, message: 'Internal' }, C.TRANSIENT, true, false],
  ['server 500 with an empty body', { status: 500, message: '' }, C.TRANSIENT, true, false],
  ['gateway timeout with an empty body', { status: 504, message: '' }, C.TIMEOUT, true, false],
  ['request timeout', { status: 408, message: 'Request Timeout' }, C.TIMEOUT, true, false],
  ['statement timeout', { code: '57014', message: 'canceling statement due to statement timeout', status: 500 }, C.TIMEOUT, true, false],
  ['empty error without a status', { message: '' }, C.UNKNOWN, false, false],
  ['unknown', { message: 'what' }, C.UNKNOWN, false, false],
  ['string error', 'plain string', C.UNKNOWN, false, false],
  ['null', null, C.UNKNOWN, false, false],
]

for (const [name, input, code, retryable, permissionDenied] of cases) {
  test(`classifyError: ${name}`, () => {
    const result = classifyError(input)
    assert.equal(result.code, code)
    assert.equal(result.retryable, retryable, 'retryable')
    assert.equal(result.permissionDenied, permissionDenied, 'permissionDenied')
    assert.ok(typeof result.message === 'string' && result.message.length > 0, 'message present')
  })
}

test('rpc prefix is stripped from the message and hint parsed into details', () => {
  const result = classifyError({ code: 'P0001', message: 'ADMIN_INVALID_TRANSITION: A payment cannot move from credited to failed.', hint: 'entity=payment;from=credited;to=failed' })
  assert.equal(result.message, 'A payment cannot move from credited to failed.')
  assert.deepEqual(result.details, { entity: 'payment', from: 'credited', to: 'failed' })
})

test('parseHintDetails tolerates garbage', () => {
  assert.equal(parseHintDetails(''), null)
  assert.equal(parseHintDetails(null), null)
  assert.equal(parseHintDetails('no-equals'), null)
  assert.deepEqual(parseHintDetails('a=1;b=two;=skip;c='), { a: '1', b: 'two', c: '' })
})

test('a timeout is reported as a timeout, not as an unreachable server', () => {
  const result = classifyError({ status: 504, message: '' })
  assert.match(result.message, /timed out/i)
  assert.doesNotMatch(result.message, /unreachable/i)
})

test('unknown errors keep their original message', () => {
  assert.equal(classifyError({ message: 'what' }).message, 'what')
})
