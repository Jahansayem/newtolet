// One status -> { label, variant } map shared by StatusPill, sidebar badges
// and dashboard queue tiles. Variants map to .ui-badge-* classes.
// Pure module, safe for node --test.

export const ADMIN_STATUS_META = Object.freeze({
  pending: { label: 'Pending', variant: 'warning' },
  pending_payment: { label: 'Pending payment', variant: 'warning' },
  awaiting_admin_approval: { label: 'Awaiting approval', variant: 'warning' },
  awaiting: { label: 'Awaiting review', variant: 'warning' },
  requested: { label: 'Requested', variant: 'warning' },
  crediting: { label: 'Crediting', variant: 'brand' },
  approved: { label: 'Approved', variant: 'success' },
  active: { label: 'Active', variant: 'success' },
  completed: { label: 'Completed', variant: 'success' },
  paid: { label: 'Paid', variant: 'success' },
  credited: { label: 'Credited', variant: 'success' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  reconciled: { label: 'Reconciled', variant: 'success' },
  resolved: { label: 'Resolved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  blocked: { label: 'Blocked', variant: 'danger' },
  failed: { label: 'Failed', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  blacklisted: { label: 'Blacklisted', variant: 'danger' },
  refunded: { label: 'Refunded', variant: 'neutral' },
  duplicate_pending: { label: 'Duplicate', variant: 'danger' },
  contacted: { label: 'Contacted', variant: 'brand' },
  in_progress: { label: 'In progress', variant: 'brand' },
  processing: { label: 'Processing', variant: 'brand' },
  assigned: { label: 'Assigned', variant: 'brand' },
  draft: { label: 'Draft', variant: 'neutral' },
  inactive: { label: 'Inactive', variant: 'neutral' },
  archived: { label: 'Archived', variant: 'neutral' },
  closed: { label: 'Closed', variant: 'neutral' },
})

const humanize = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())

export const getStatusMeta = (status, fallbackLabel = null) => {
  if (!status) return { label: fallbackLabel || 'Unknown', variant: 'neutral' }
  return ADMIN_STATUS_META[status] || { label: fallbackLabel || humanize(status), variant: 'neutral' }
}
