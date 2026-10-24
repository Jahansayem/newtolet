// Allowed status transitions per admin-managed entity.
//
// Mirrors public.admin_status_transitions (seeded in the admin roles
// migration). The server enforces the same table inside every RPC; this copy
// only pre-disables impossible options in the UI and gives friendlier copy.
// Pure module: no Supabase import, safe for node --test.

export const ADMIN_STATUS_TRANSITIONS = Object.freeze({
  payment: Object.freeze({
    pending: ['awaiting_admin_approval', 'failed', 'cancelled'],
    awaiting_admin_approval: ['credited', 'failed', 'cancelled'],
    crediting: ['credited', 'failed'],
    credited: ['refunded'],
    failed: ['pending'],
    cancelled: [],
    refunded: [],
  }),
  order: Object.freeze({
    pending_payment: ['pending', 'cancelled'],
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
    completed: [],
    cancelled: ['pending'],
  }),
  property: Object.freeze({
    pending: ['approved', 'rejected'],
    approved: ['rejected', 'pending'],
    rejected: ['approved', 'pending'],
  }),
  inquiry: Object.freeze({
    pending: ['contacted', 'resolved', 'closed'],
    contacted: ['resolved', 'closed', 'pending'],
    resolved: ['closed', 'contacted'],
    closed: ['pending'],
  }),
  refund: Object.freeze({
    requested: ['approved', 'rejected'],
    approved: [],
    rejected: [],
  }),
  feedback: Object.freeze({
    pending: ['approved', 'rejected'],
    approved: ['rejected'],
    rejected: ['approved'],
  }),
  withdrawal: Object.freeze({
    requested: ['approved', 'rejected'],
    approved: ['paid', 'rejected'],
    rejected: [],
    paid: [],
  }),
})

// Targets that the generic "set status" path must never write directly; they
// have dedicated RPCs with side effects (crediting, refunds).
export const DEDICATED_TRANSITIONS = Object.freeze({
  payment: Object.freeze({ credited: 'approvePayment', refunded: 'refundPayment' }),
})

export const STATUS_LABELS = Object.freeze({
  payment: Object.freeze({
    pending: 'Pending',
    awaiting_admin_approval: 'Awaiting approval',
    crediting: 'Crediting',
    credited: 'Credited',
    failed: 'Failed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  }),
  order: Object.freeze({
    pending_payment: 'Pending payment',
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }),
  property: Object.freeze({ pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }),
  inquiry: Object.freeze({ pending: 'Pending', contacted: 'Contacted', resolved: 'Resolved', closed: 'Closed' }),
  refund: Object.freeze({ requested: 'Requested', approved: 'Approved', rejected: 'Rejected' }),
  feedback: Object.freeze({ pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }),
  withdrawal: Object.freeze({ requested: 'Requested', approved: 'Approved', rejected: 'Rejected', paid: 'Paid' }),
})

const humanize = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())

export const getStatusLabel = (domain, status) => STATUS_LABELS[domain]?.[status] || humanize(status) || 'Unknown'

export const getDomainStatuses = (domain) => Object.keys(ADMIN_STATUS_TRANSITIONS[domain] || {})

export const getAllowedTransitions = (domain, from) => ADMIN_STATUS_TRANSITIONS[domain]?.[from] || []

export const canTransition = (domain, from, to) => {
  if (!domain || !to || from === to) return false
  return getAllowedTransitions(domain, from).includes(to)
}

export const isTerminal = (domain, status) => {
  const map = ADMIN_STATUS_TRANSITIONS[domain]
  if (!map || !(status in map)) return false
  return map[status].length === 0
}

export const isDedicatedTransition = (domain, to) => Boolean(DEDICATED_TRANSITIONS[domain]?.[to])

/**
 * Options for a status <select>: every status of the domain, the current one
 * always present (and marked), others disabled unless reachable. Dedicated
 * targets are disabled for the generic path unless `includeDedicated` is set.
 */
export const getStatusOptions = (domain, current, { includeDedicated = false } = {}) => {
  const statuses = getDomainStatuses(domain)
  if (current && !statuses.includes(current)) statuses.unshift(current)
  return statuses.map((value) => {
    const isCurrent = value === current
    const reachable = canTransition(domain, current, value)
    const dedicated = isDedicatedTransition(domain, value)
    return {
      value,
      label: getStatusLabel(domain, value),
      current: isCurrent,
      disabled: !isCurrent && (!reachable || (dedicated && !includeDedicated)),
      dedicated,
    }
  })
}
