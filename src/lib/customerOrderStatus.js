// Customer Order statuses, transitions and display helpers.
//
// CUSTOMER_ORDER_TRANSITIONS mirrors public.customer_order_transitions (seeded
// in supabase/migrations/20261116090000_customer_orders.sql); the server
// enforces that table for the dashboard and the agent API alike. This copy only
// pre-disables impossible options in the UI. tests/customerOrderStatus.test.mjs
// fails when the two drift apart.
// Pure module: no Supabase import, safe for node --test.

export const CUSTOMER_ORDER_STATUSES = Object.freeze([
  'PENDING',
  'REQUIREMENTS_COLLECTED',
  'SEARCHING_BY_AI',
  'SEARCHING_BY_HUMAN',
  'PREVIEWS_SENT',
  'PAYMENT_INTERESTED',
  'PAYMENT_CLAIMED',
  'PAYMENT_VERIFIED',
  'MATCHED',
  'COMPLETED',
  'SELF_SERVICE',
  'CANCELLED',
  'REFUND_REQUESTED',
  'REFUNDED',
  'PAYMENT_ISSUE',
  'PAYMENT_FAILED',
])

export const CUSTOMER_ORDER_TRANSITIONS = Object.freeze({
  PENDING: ['REQUIREMENTS_COLLECTED', 'SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN', 'SELF_SERVICE', 'CANCELLED'],
  REQUIREMENTS_COLLECTED: ['SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN', 'PAYMENT_INTERESTED', 'SELF_SERVICE', 'CANCELLED'],
  SEARCHING_BY_AI: ['SEARCHING_BY_HUMAN', 'PREVIEWS_SENT', 'PAYMENT_INTERESTED', 'SELF_SERVICE', 'CANCELLED', 'REFUND_REQUESTED'],
  SEARCHING_BY_HUMAN: ['SEARCHING_BY_AI', 'PREVIEWS_SENT', 'PAYMENT_INTERESTED', 'SELF_SERVICE', 'CANCELLED', 'REFUND_REQUESTED'],
  PREVIEWS_SENT: ['SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN', 'PAYMENT_INTERESTED', 'MATCHED', 'SELF_SERVICE', 'CANCELLED', 'REFUND_REQUESTED'],
  PAYMENT_INTERESTED: ['PAYMENT_ISSUE', 'SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN', 'PREVIEWS_SENT', 'SELF_SERVICE', 'CANCELLED'],
  PAYMENT_CLAIMED: ['PAYMENT_ISSUE', 'SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN', 'PREVIEWS_SENT', 'CANCELLED'],
  PAYMENT_VERIFIED: ['SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN', 'PREVIEWS_SENT', 'MATCHED', 'REFUND_REQUESTED'],
  MATCHED: ['COMPLETED', 'SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN', 'REFUND_REQUESTED'],
  COMPLETED: [],
  SELF_SERVICE: ['PENDING'],
  CANCELLED: ['PENDING'],
  REFUND_REQUESTED: ['REFUNDED', 'SEARCHING_BY_AI', 'SEARCHING_BY_HUMAN'],
  REFUNDED: [],
  PAYMENT_ISSUE: ['PAYMENT_INTERESTED', 'SELF_SERVICE', 'CANCELLED'],
  PAYMENT_FAILED: ['PAYMENT_INTERESTED', 'PAYMENT_ISSUE', 'SELF_SERVICE', 'CANCELLED'],
})

/** Moves an AI-agent API key may not make (humans only): refunds and reopening closed orders. */
export const AGENT_BLOCKED_TRANSITIONS = Object.freeze([
  ['REFUND_REQUESTED', 'REFUNDED'],
  ['REFUND_REQUESTED', 'SEARCHING_BY_AI'],
  ['REFUND_REQUESTED', 'SEARCHING_BY_HUMAN'],
  ['CANCELLED', 'PENDING'],
  ['SELF_SERVICE', 'PENDING'],
])

/** Never chosen by hand: a payment claim / a claim review sets them. */
export const PAYMENT_DRIVEN_STATUSES = Object.freeze(['PAYMENT_CLAIMED', 'PAYMENT_VERIFIED', 'PAYMENT_FAILED'])

/** Closed orders: not counted as open, no follow-up, no payment can be recorded. */
export const CLOSED_STATUSES = Object.freeze(['COMPLETED', 'REFUNDED', 'CANCELLED', 'SELF_SERVICE'])

export const CUSTOMER_ORDER_STATUS_META = Object.freeze({
  PENDING: { label: 'Pending', variant: 'warning' },
  REQUIREMENTS_COLLECTED: { label: 'Requirements collected', variant: 'brand' },
  SEARCHING_BY_AI: { label: 'Searching by AI', variant: 'brand' },
  SEARCHING_BY_HUMAN: { label: 'Searching by human', variant: 'brand' },
  PREVIEWS_SENT: { label: 'Previews sent', variant: 'brand' },
  PAYMENT_INTERESTED: { label: 'Payment interested', variant: 'warning' },
  PAYMENT_CLAIMED: { label: 'Payment claimed', variant: 'warning' },
  PAYMENT_VERIFIED: { label: 'Payment verified', variant: 'success' },
  MATCHED: { label: 'Matched', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  SELF_SERVICE: { label: 'Self service', variant: 'neutral' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  REFUND_REQUESTED: { label: 'Refund requested', variant: 'warning' },
  REFUNDED: { label: 'Refunded', variant: 'neutral' },
  PAYMENT_ISSUE: { label: 'Payment issue', variant: 'danger' },
  PAYMENT_FAILED: { label: 'Payment failed', variant: 'danger' },
})

export const PAYMENT_STATUS_META = Object.freeze({
  PENDING: { label: 'Nothing paid', variant: 'neutral' },
  PARTIAL_PAID: { label: 'Partially paid', variant: 'warning' },
  PAID: { label: 'Paid', variant: 'success' },
})

export const PAYMENT_VERIFICATION_META = Object.freeze({
  UNVERIFIED: { label: 'Unverified', variant: 'neutral' },
  CLAIMED: { label: 'Claimed, not verified', variant: 'warning' },
  VERIFIED: { label: 'Verified', variant: 'success' },
})

export const CLAIM_STATUS_META = Object.freeze({
  CLAIMED: { label: 'Awaiting verification', variant: 'warning' },
  VERIFIED: { label: 'Verified', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
})

export const CREATED_VIA_LABELS = Object.freeze({
  customer: 'Customer (website)',
  ai_agent: 'AI agent',
  human_agent: 'Human agent',
})

export const SOURCE_LABELS = Object.freeze({
  messenger: 'Facebook',
  lead_generation: 'Lead generation',
  manual: 'Manual entry',
  phone: 'Phone call',
  whatsapp: 'WhatsApp',
  website: 'Website',
})

const humanize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())

export const getCustomerOrderStatusMeta = (status) =>
  CUSTOMER_ORDER_STATUS_META[status] || { label: humanize(status) || 'Unknown', variant: 'neutral' }

export const getCustomerOrderStatusLabel = (status) => getCustomerOrderStatusMeta(status).label

export const isClosedStatus = (status) => CLOSED_STATUSES.includes(status)

export const getAllowedTargets = (from) => CUSTOMER_ORDER_TRANSITIONS[from] || []

export const canTransition = (from, to) => Boolean(from && to && from !== to && getAllowedTargets(from).includes(to))

export const isAgentAllowed = (from, to) =>
  canTransition(from, to) && !AGENT_BLOCKED_TRANSITIONS.some(([f, t]) => f === from && t === to)

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

/**
 * Why a move the transition table allows is still refused for this order
 * (same guards as co_set_status). Returns null when the move is fine.
 */
export const getTransitionBlocker = (order, to) => {
  const charge = toNumber(order?.service_charge_bdt)
  const verified = toNumber(order?.amount_verified)
  if (to === 'MATCHED' && verified < charge) return 'Needs the full charge paid and verified'
  if (to === 'REFUND_REQUESTED' && verified <= 0) return 'Only after a verified payment'
  if ((to === 'CANCELLED' || to === 'SELF_SERVICE') && verified > 0) return 'Has a verified payment: use Refund requested'
  return null
}

/**
 * Options for the "Change status" control: only the targets reachable from the
 * order's current status, each with `disabled` + `hint` when a guard blocks it.
 */
export const getStatusChangeOptions = (order) =>
  getAllowedTargets(order?.status).map((value) => {
    const hint = getTransitionBlocker(order, value)
    return { value, label: getCustomerOrderStatusLabel(value), disabled: Boolean(hint), hint }
  })

/**
 * Payment totals from the claims of one order. Same rules as the
 * customer_orders_enriched view: rejected claims never count, amount_due never
 * goes below zero, an overpayment is flagged, and VERIFIED means the VERIFIED
 * claims alone cover the charge.
 */
export const summarizePayment = (serviceCharge, claims = []) => {
  const charge = toNumber(serviceCharge)
  const live = (claims || []).filter((claim) => claim && claim.status !== 'REJECTED')
  const amountPaid = live.reduce((sum, claim) => sum + toNumber(claim.amount_bdt), 0)
  const amountVerified = live.filter((claim) => claim.status === 'VERIFIED').reduce((sum, claim) => sum + toNumber(claim.amount_bdt), 0)
  return {
    amountPaid,
    amountVerified,
    amountDue: Math.max(charge - amountPaid, 0),
    overpaid: amountPaid > charge,
    paymentStatus: amountPaid <= 0 ? 'PENDING' : amountPaid < charge ? 'PARTIAL_PAID' : 'PAID',
    paymentVerification: amountVerified >= charge && charge > 0 ? 'VERIFIED' : live.length > 0 ? 'CLAIMED' : 'UNVERIFIED',
    openClaims: live.filter((claim) => claim.status === 'CLAIMED').length,
  }
}

/** What verifying one more claim would do: enough to mark the whole order verified, or how much is still missing. */
export const previewVerification = (serviceCharge, claims, claimId) => {
  const next = (claims || []).map((claim) => (claim.id === claimId ? { ...claim, status: 'VERIFIED' } : claim))
  const summary = summarizePayment(serviceCharge, next)
  return {
    completesOrder: summary.paymentVerification === 'VERIFIED',
    stillUnverified: Math.max(toNumber(serviceCharge) - summary.amountVerified, 0),
  }
}

const bdt = (value) => toNumber(value).toLocaleString('en-US')

/** List cell: "500 due", "300 paid, 200 due", "Paid ✓". */
export const formatPaymentCell = (order) => {
  const paid = toNumber(order?.amount_paid)
  const due = toNumber(order?.amount_due)
  if (order?.payment_status === 'PAID' || (paid > 0 && due === 0)) return order?.overpaid ? `Paid ✓ (${bdt(paid)}, overpaid)` : 'Paid ✓'
  if (paid > 0) return `${bdt(paid)} paid, ${bdt(due)} due`
  return `${bdt(due)} due`
}

/** List cell: "5 (2 verified)"; "0" when nothing was found. */
export const formatListingsCell = (order) => {
  const total = toNumber(order?.listings_found_count)
  if (total === 0) return '0'
  return `${total} (${toNumber(order?.listings_verified_count)} verified)`
}

export const REFUND_WINDOW_DAYS = 7

/** Whole days left in the 7-day refund window, or null when it does not apply. */
export const refundWindowDaysLeft = (order, now = Date.now()) => {
  if (!order?.payment_verified_at || isClosedStatus(order.status)) return null
  const start = new Date(order.payment_verified_at).getTime()
  if (Number.isNaN(start)) return null
  const left = REFUND_WINDOW_DAYS - (now - start) / 86400000
  return left > 0 ? Math.ceil(left) : null
}

export const isFollowUpOverdue = (order, now = Date.now()) => {
  if (!order?.follow_up_at || isClosedStatus(order.status)) return false
  const at = new Date(order.follow_up_at).getTime()
  return !Number.isNaN(at) && at < now
}

const ACTIVITY_LABELS = Object.freeze({
  'order.create': 'Order created',
  'order.update': 'Details updated',
  'order.assign': 'Assignee changed',
  'order.delete': 'Order deleted',
  'payment.claim': 'Payment recorded',
  'payment.verify': 'Payment verified',
  'payment.reject': 'Payment rejected',
  'match.add': 'Listing attached',
  'match.update': 'Listing updated',
  'match.remove': 'Listing removed',
})

const ACTOR_TYPE_LABELS = Object.freeze({ admin: 'Staff', api_agent: 'AI agent', api_admin: 'Admin key', system: 'System' })

export const describeActor = (item) => {
  const type = ACTOR_TYPE_LABELS[item?.actor_type] || 'Unknown'
  return item?.actor_label ? `${type}: ${item.actor_label}` : type
}

/** { title, detail, variant } for one timeline entry (status change, note or activity). */
export const describeTimelineItem = (item) => {
  if (item?.kind === 'status') {
    const to = getCustomerOrderStatusLabel(item.to_status)
    const title = item.from_status ? `${getCustomerOrderStatusLabel(item.from_status)} → ${to}` : to
    const handover = item.to_status === 'SEARCHING_BY_HUMAN' && item.taken_over_by ? `Search taken over by ${item.taken_over_by}. ` : ''
    return { title, detail: `${handover}${item.reason || ''}`.trim() || null, variant: getCustomerOrderStatusMeta(item.to_status).variant }
  }
  if (item?.kind === 'note') return { title: 'Internal note', detail: item.body || null, variant: 'neutral' }
  const after = item?.after && typeof item.after === 'object' ? item.after : {}
  let detail = null
  if (item?.action === 'payment.claim') {
    detail = `${bdt(after.amount_bdt)} BDT, ${after.trx_id ? `TrxID ${after.trx_id}` : `sender last-4 ${after.sender_last4}`}`
  } else if (item?.action === 'payment.verify' || item?.action === 'payment.reject') {
    detail = [after.amount_bdt ? `${bdt(after.amount_bdt)} BDT` : null, after.note].filter(Boolean).join(' · ') || null
  } else if (item?.action === 'match.add') {
    detail = [after.reference_id, after.verification_status].filter(Boolean).join(' · ') || null
  } else if (item?.action === 'order.update') {
    detail = Object.keys(after).map(humanize).join(', ') || null
  } else if (item?.action === 'order.delete') {
    detail = after.reason || null
  }
  return {
    title: ACTIVITY_LABELS[item?.action] || humanize(String(item?.action || 'activity').replace(/\./g, ' ')),
    detail,
    variant: item?.action === 'payment.verify' ? 'success' : item?.action === 'payment.reject' ? 'danger' : 'neutral',
  }
}
