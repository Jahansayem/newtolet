import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  PAYMENT_LINK_AMOUNT_MAX,
  PAYMENT_LINK_AMOUNT_MIN,
  PAYMENT_LINK_STATUS_META,
  buildPayLinkUrl,
  buildShareMessage,
  buildWhatsAppShareUrl,
  formatBdt,
  normalizeBdPhone,
  normalizePaymentLinkCode,
  resolvePayPageView,
  validatePaymentLinkForm,
} from '../src/lib/paymentLinks.js'
import {
  buildPayReturnUrls,
  cleanCustomerName,
  getPayBlocker,
  isEpsReference,
  normalizeBdPhone as serverNormalizeBdPhone,
  normalizeLinkCode,
  toPublicLink,
  toPublicPayment,
} from '../supabase/functions/_shared/paymentLinks.js'

const readRepoFile = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8')

const LINK = {
  id: '6f1c2c0e-0000-4000-8000-000000000001',
  code: 'ABCDEFGH23',
  amount_bdt: 1500,
  purpose: 'Service charge for house search',
  customer_name: 'Rahim Uddin',
  customer_phone: '01712345678',
  customer_email: 'rahim@example.com',
  note: 'Promised a discount',
  status: 'ACTIVE',
  paid_at: null,
  paid_payment_id: null,
  created_by: '6f1c2c0e-0000-4000-8000-000000000002',
  created_by_label: 'Finance Admin',
}

test('a pay link always points at the public site', () => {
  assert.equal(buildPayLinkUrl('ABCDEFGH23'), 'https://www.newtolet.com/pay/?c=ABCDEFGH23')
  assert.equal(buildPayLinkUrl('ABCDEFGH23', 'http://localhost:3001/'), 'http://localhost:3001/pay/?c=ABCDEFGH23')
})

test('amounts are shown as taka with Western digits', () => {
  assert.equal(formatBdt(1500), '৳1,500')
  assert.equal(formatBdt(null), '৳0')
})

test('link codes are normalised and anything else is refused', () => {
  assert.equal(normalizePaymentLinkCode(' abcdefgh23 '), 'ABCDEFGH23')
  assert.equal(normalizePaymentLinkCode('ABCDEFGH2'), null)
  assert.equal(normalizePaymentLinkCode('ABCDEFGH01'), null, '0 and 1 are not in the alphabet')
  assert.equal(normalizePaymentLinkCode("ABCDEFGH23'--"), null)
  assert.equal(normalizePaymentLinkCode(null), null)
  assert.equal(normalizeLinkCode('abcdefgh23'), 'ABCDEFGH23')
  assert.equal(normalizeLinkCode('ABCDEFGH23,status.eq.PAID'), null)
})

test('phone numbers are normalised the same way in the browser and on the server', () => {
  for (const normalise of [normalizeBdPhone, serverNormalizeBdPhone]) {
    assert.equal(normalise('01712345678'), '01712345678')
    assert.equal(normalise('+880 1712-345678'), '01712345678')
    assert.equal(normalise('8801712345678'), '01712345678')
    assert.equal(normalise('01212345678'), null)
    assert.equal(normalise('1712345678'), null)
    assert.equal(normalise(''), null)
  }
})

test('the form accepts a complete link and cleans its fields', () => {
  const { values, error } = validatePaymentLinkForm({
    amount: '1500',
    purpose: '  Service   charge ',
    customerName: ' Rahim  Uddin ',
    customerPhone: '+8801712345678',
    customerEmail: ' Rahim@Example.com ',
    note: ' call first ',
    customerOrderId: 'order-1',
  })
  assert.equal(error, null)
  assert.deepEqual(values, {
    amountBdt: 1500,
    purpose: 'Service charge',
    customerName: 'Rahim Uddin',
    customerPhone: '01712345678',
    customerEmail: 'rahim@example.com',
    note: 'call first',
    customerOrderId: 'order-1',
  })
})

test('the form allows a link with no customer details', () => {
  const { values, error } = validatePaymentLinkForm({ amount: '500', purpose: 'Advance' })
  assert.equal(error, null)
  assert.equal(values.customerName, null)
  assert.equal(values.customerPhone, null)
  assert.equal(values.customerOrderId, null)
})

test('the form refuses bad amounts, a missing purpose and bad contact details', () => {
  const bad = (form) => validatePaymentLinkForm({ amount: '500', purpose: 'Advance', ...form })
  for (const amount of ['', 'abc', '12.5', String(PAYMENT_LINK_AMOUNT_MIN - 1), String(PAYMENT_LINK_AMOUNT_MAX + 1), '-5']) {
    const result = bad({ amount })
    assert.equal(result.values, null, `amount ${JSON.stringify(amount)} should be refused`)
    assert.ok(result.error)
  }
  assert.ok(bad({ purpose: 'ab' }).error)
  assert.ok(bad({ purpose: 'x'.repeat(121) }).error)
  assert.ok(bad({ customerPhone: '12345' }).error)
  assert.ok(bad({ customerEmail: 'not-an-email' }).error)
  assert.ok(bad({ note: 'x'.repeat(501) }).error)
  assert.equal(bad({ amount: String(PAYMENT_LINK_AMOUNT_MIN) }).error, null)
  assert.equal(bad({ amount: String(PAYMENT_LINK_AMOUNT_MAX) }).error, null)
})

test('the amount limits match the database', () => {
  const sql = readRepoFile('supabase/migrations/20261119090000_payment_links.sql')
  const match = sql.match(/amount_bdt between (\d+) and (\d+)/)
  assert.ok(match, 'amount check not found in the migration')
  assert.equal(Number(match[1]), PAYMENT_LINK_AMOUNT_MIN)
  assert.equal(Number(match[2]), PAYMENT_LINK_AMOUNT_MAX)
})

test('every link status in the database has a label', () => {
  const sql = readRepoFile('supabase/migrations/20261119090000_payment_links.sql')
  const match = sql.match(/status in \(('[A-Z]+'(?:, '[A-Z]+')*)\)\),\s*\n\s*paid_at/)
  assert.ok(match, 'status check not found in the migration')
  const statuses = match[1].split(',').map((value) => value.trim().replace(/'/g, ''))
  assert.deepEqual(statuses.sort(), Object.keys(PAYMENT_LINK_STATUS_META).sort())
})

test('the share message carries the amount, the purpose and the link', () => {
  const message = buildShareMessage(LINK)
  assert.match(message, /Hello Rahim Uddin,/)
  assert.match(message, /৳1,500/)
  assert.match(message, /Service charge for house search/)
  assert.match(message, /https:\/\/www\.newtolet\.com\/pay\/\?c=ABCDEFGH23/)
  assert.match(buildShareMessage({ ...LINK, customer_name: null }), /^Hello,/)
})

test('WhatsApp opens the customer chat when a phone is known', () => {
  assert.ok(buildWhatsAppShareUrl(LINK).startsWith('https://wa.me/8801712345678?text='))
  assert.ok(buildWhatsAppShareUrl({ ...LINK, customer_phone: null }).startsWith('https://wa.me/?text='))
  const text = decodeURIComponent(buildWhatsAppShareUrl(LINK).split('text=')[1])
  assert.equal(text, buildShareMessage(LINK))
})

test('the pay page shows the right screen for each situation', () => {
  const active = { status: 'ACTIVE' }
  assert.equal(resolvePayPageView({ link: null }), 'not-found')
  assert.equal(resolvePayPageView({ link: active }), 'ready')
  assert.equal(resolvePayPageView({ link: { status: 'PAID' }, state: 'failed' }), 'paid', 'a paid link wins over a stale failed return')
  assert.equal(resolvePayPageView({ link: { status: 'CANCELLED' } }), 'closed')
  assert.equal(resolvePayPageView({ link: active, payment: { status: 'awaiting_admin_approval' }, hasReference: true }), 'review')
  assert.equal(resolvePayPageView({ link: active, state: 'cancelled', hasReference: true }), 'cancelled')
  assert.equal(resolvePayPageView({ link: active, state: 'failed', hasReference: true }), 'failed')
  assert.equal(resolvePayPageView({ link: active, payment: { status: 'cancelled' }, hasReference: true }), 'failed')
  assert.equal(resolvePayPageView({ link: active, payment: { status: 'pending' }, hasReference: true }), 'pending')
  // An old abandoned attempt must not block a fresh visit to the link.
  assert.equal(resolvePayPageView({ link: active, payment: { status: 'cancelled' }, hasReference: false }), 'ready')
})

test('the public view of a link hides everything private', () => {
  const view = toPublicLink(LINK)
  assert.deepEqual(view, {
    code: 'ABCDEFGH23',
    amount_bdt: 1500,
    purpose: 'Service charge for house search',
    customer_first_name: 'Rahim',
    needs_name: false,
    needs_phone: false,
    status: 'ACTIVE',
    paid_at: null,
  })
  const serialised = JSON.stringify(view)
  for (const secret of ['01712345678', 'rahim@example.com', 'Promised a discount', 'Uddin', 'Finance Admin', LINK.id, LINK.created_by]) {
    assert.ok(!serialised.includes(secret), `${secret} leaked into the public link`)
  }
})

test('the public view asks for the details the admin left out', () => {
  const view = toPublicLink({ ...LINK, customer_name: null, customer_phone: null })
  assert.equal(view.customer_first_name, null)
  assert.equal(view.needs_name, true)
  assert.equal(view.needs_phone, true)
})

test('the public view of a payment carries no gateway payload', () => {
  assert.equal(toPublicPayment(null), null)
  const view = toPublicPayment({
    id: 'payment-1',
    status: 'credited',
    amount: '1500.00',
    reference: '176350000000012345',
    credited_at: '2026-11-19T10:00:00Z',
    gateway_payload: { epsTransactionId: 'C2549190401', financialEntity: 'bKash', customerEmail: 'rahim@example.com' },
  })
  assert.deepEqual(view, {
    status: 'credited',
    amount: 1500,
    reference: '176350000000012345',
    eps_transaction_id: 'C2549190401',
    method: 'bKash',
    paid_at: '2026-11-19T10:00:00Z',
  })
})

test('only digit strings are accepted as an EPS reference', () => {
  assert.equal(isEpsReference('176350000000012345'), true)
  assert.equal(isEpsReference('123456789'), false, 'shorter than 10 digits')
  assert.equal(isEpsReference('1763500000000,status.eq.credited'), false)
  assert.equal(isEpsReference("1763500000000' or 1=1"), false)
  assert.equal(isEpsReference(''), false)
  assert.equal(isEpsReference(undefined), false)
})

test('customer names are trimmed and bounded', () => {
  assert.equal(cleanCustomerName('  Rahim   Uddin '), 'Rahim Uddin')
  assert.equal(cleanCustomerName('R'), null)
  assert.equal(cleanCustomerName('x'.repeat(81)), null)
  assert.equal(cleanCustomerName(null), null)
})

test('EPS returns the customer to the pay page with the attempt reference', () => {
  const urls = buildPayReturnUrls('https://www.newtolet.com/', 'ABCDEFGH23', '176350000000012345')
  assert.deepEqual(urls, {
    successUrl: 'https://www.newtolet.com/pay/?c=ABCDEFGH23&reference=176350000000012345',
    failUrl: 'https://www.newtolet.com/pay/?c=ABCDEFGH23&state=failed&reference=176350000000012345',
    cancelUrl: 'https://www.newtolet.com/pay/?c=ABCDEFGH23&state=cancelled&reference=176350000000012345',
  })
})

test('a link can be paid only while it is active and unpaid', () => {
  assert.equal(getPayBlocker(LINK, 0), null)
  assert.deepEqual(getPayBlocker(null), { status: 404, message: 'Payment link not found' })
  assert.equal(getPayBlocker({ ...LINK, status: 'PAID' }).status, 409)
  assert.equal(getPayBlocker({ ...LINK, status: 'CANCELLED' }).status, 409)
  // An active link with a payment already verified or held for review.
  assert.equal(getPayBlocker(LINK, 1).status, 409)
})

test('link payments never reach the credit path in the Edge Function', () => {
  const source = readRepoFile('supabase/functions/_shared/payment-transactions.ts')
  const linkBranch = source.indexOf('if (syncedPayment.payment_link_id)')
  const autoCredit = source.indexOf('AUTO_APPROVAL_THRESHOLD_BDT || !amountMatches')
  assert.ok(linkBranch > 0, 'payment link branch missing from syncGatewayPayment')
  assert.ok(autoCredit > linkBranch, 'the payment link branch must come before the auto-credit check')
})

test('the sign-in-free verify function refuses payment link payments', () => {
  const verify = readRepoFile('supabase/functions/paymently-verify/index.ts')
  assert.match(verify, /if \(!payment \|\| payment\.payment_link_id\)/)
  // The link code is the customer's only credential; it must not be copied
  // into a column another function can return.
  const links = readRepoFile('supabase/functions/payment-links/index.ts')
  assert.ok(!/description:.*link\.code/.test(links), 'the link code must stay out of payment_transactions.description')
})

test('the pay page is translated in both languages with the same keys', async () => {
  const [{ default: en }, { default: bn }] = await Promise.all([
    import('../src/i18n/locales/en/payments.js'),
    import('../src/i18n/locales/bn/payments.js'),
  ])
  const keys = (value, prefix = '') =>
    Object.entries(value).flatMap(([key, child]) =>
      child && typeof child === 'object' ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]
    )
  assert.ok(en.payments.link.payButton.includes('{amount}'))
  assert.ok(bn.payments.link.payButton.includes('{amount}'))
  assert.deepEqual(keys(bn.payments.link).sort(), keys(en.payments.link).sort())
})
