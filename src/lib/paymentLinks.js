// Payment links: pure helpers shared by the admin tab and the public pay page.
// The server (20261119090000_payment_links.sql) repeats every rule here; this
// file only gives early, friendly feedback.

import { SITE_URL } from './seo/siteMeta.js'

export const PAYMENT_LINK_AMOUNT_MIN = 10
export const PAYMENT_LINK_AMOUNT_MAX = 500000
export const PAYMENT_LINK_QUICK_AMOUNTS = Object.freeze([500, 1000, 2000, 5000])

const BD_PHONE_PATTERN = /^01[3-9]\d{8}$/
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const CODE_PATTERN = /^[A-Z2-9]{10}$/

/** Labels carry the meaning; the Badge variant is only a second cue. */
export const PAYMENT_LINK_STATUS_META = Object.freeze({
  ACTIVE: { label: 'Awaiting payment', variant: 'warning' },
  PAID: { label: 'Paid', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
})

export const PAYMENT_LINK_STATUS_OPTIONS = Object.freeze(
  Object.entries(PAYMENT_LINK_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))
)

export const getPaymentLinkStatusMeta = (status) =>
  PAYMENT_LINK_STATUS_META[status] || { label: status || 'Unknown', variant: 'neutral' }

/** One payment attempt (a payment_transactions row) in admin wording. */
export const PAYMENT_ATTEMPT_STATUS_META = Object.freeze({
  pending: { label: 'Started, not finished', variant: 'neutral' },
  awaiting_admin_approval: { label: 'Paid, held for review', variant: 'warning' },
  crediting: { label: 'Being recorded', variant: 'warning' },
  credited: { label: 'Paid', variant: 'success' },
  cancelled: { label: 'Abandoned', variant: 'neutral' },
  failed: { label: 'Failed', variant: 'danger' },
  refunded: { label: 'Refunded', variant: 'neutral' },
})

export const getPaymentAttemptStatusMeta = (status) =>
  PAYMENT_ATTEMPT_STATUS_META[status] || { label: status || 'Unknown', variant: 'neutral' }

export const formatBdt = (value) => `৳${Number(value || 0).toLocaleString('en-US')}`

export const normalizePaymentLinkCode = (value) => {
  const code = String(value ?? '').trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

/** 017… / +88017… / 88017… -> 017…; null when it is not a BD mobile number. */
export const normalizeBdPhone = (value) => {
  const digits = String(value ?? '').replace(/[\s\-()]/g, '').replace(/^\+?88/, '')
  return BD_PHONE_PATTERN.test(digits) ? digits : null
}

/** Customers always pay on the public site, also when the admin works on admin.newtolet.com. */
export const buildPayLinkUrl = (code, siteUrl = SITE_URL) =>
  `${String(siteUrl).replace(/\/+$/, '')}/pay/?c=${encodeURIComponent(code)}`

export const buildShareMessage = (link, siteUrl = SITE_URL) => {
  const greeting = link.customer_name ? `Hello ${link.customer_name},` : 'Hello,'
  return [
    greeting,
    `Please pay ${formatBdt(link.amount_bdt)} to NewTolet for: ${link.purpose}.`,
    `Secure payment link (card, bKash, Nagad, Rocket): ${buildPayLinkUrl(link.code, siteUrl)}`,
  ].join('\n')
}

/** Opens WhatsApp with the message ready; goes to the customer's chat when a phone is known. */
export const buildWhatsAppShareUrl = (link, siteUrl = SITE_URL) => {
  const phone = normalizeBdPhone(link.customer_phone)
  const text = encodeURIComponent(buildShareMessage(link, siteUrl))
  return phone ? `https://wa.me/88${phone}?text=${text}` : `https://wa.me/?text=${text}`
}

/**
 * Checks the "New payment link" form.
 * Returns { values, error }: `values` is what the RPC takes, `error` a sentence
 * to show (null when the form is fine).
 */
export const validatePaymentLinkForm = (form = {}) => {
  const amountText = String(form.amount ?? '').trim()
  const amount = Number(amountText)
  const purpose = String(form.purpose ?? '').replace(/\s+/g, ' ').trim()
  const name = String(form.customerName ?? '').replace(/\s+/g, ' ').trim()
  const phoneText = String(form.customerPhone ?? '').trim()
  const email = String(form.customerEmail ?? '').trim().toLowerCase()
  const note = String(form.note ?? '').trim()

  const fail = (error) => ({ values: null, error })

  if (amountText === '' || !Number.isInteger(amount)) return fail('Enter the amount as a whole number of BDT.')
  if (amount < PAYMENT_LINK_AMOUNT_MIN || amount > PAYMENT_LINK_AMOUNT_MAX) {
    return fail(`The amount must be between ${formatBdt(PAYMENT_LINK_AMOUNT_MIN)} and ${formatBdt(PAYMENT_LINK_AMOUNT_MAX)}.`)
  }
  if (purpose.length < 3) return fail('Say what the payment is for. The customer sees this on the pay page.')
  if (purpose.length > 120) return fail('Keep "what it is for" under 120 characters.')
  if (name.length > 80) return fail('The customer name is too long (80 characters at most).')

  let phone = null
  if (phoneText) {
    phone = normalizeBdPhone(phoneText)
    if (!phone) return fail('Enter a Bangladeshi mobile number (01XXXXXXXXX), or leave the phone empty.')
  }
  if (email && (!EMAIL_PATTERN.test(email) || email.length > 160)) return fail('The email address does not look right.')
  if (note.length > 500) return fail('Keep the internal note under 500 characters.')

  return {
    values: {
      amountBdt: amount,
      purpose,
      customerName: name || null,
      customerPhone: phone,
      customerEmail: email || null,
      note: note || null,
      customerOrderId: form.customerOrderId || null,
    },
    error: null,
  }
}

/**
 * Which screen the public pay page shows.
 * `state` is the ?state= EPS adds on a failed or cancelled return.
 */
export const resolvePayPageView = ({ link, payment = null, state = null, hasReference = false } = {}) => {
  if (!link) return 'not-found'
  if (link.status === 'PAID') return 'paid'
  if (link.status === 'CANCELLED') return 'closed'
  if (payment?.status === 'awaiting_admin_approval' || payment?.status === 'crediting') return 'review'
  if (state === 'cancelled') return 'cancelled'
  if (state === 'failed' || (hasReference && payment && ['failed', 'cancelled'].includes(payment.status))) return 'failed'
  if (hasReference && payment?.status === 'pending') return 'pending'
  return 'ready'
}
