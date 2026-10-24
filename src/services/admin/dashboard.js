// Dashboard metrics and queue counts: head counts only, never full-table
// fetches, with per-metric error reporting.

import { supabase } from '../supabaseClient'
import { fail, logAdminError, normalizeSupabaseError, ok } from './adminResult'
import { ADMIN_QUEUE_COUNTS_KEY, readAdminSnapshot, writeAdminSnapshot } from './adminCache'

const PAYMENT_AWAITING_RAW = ['awaiting_admin_approval']
const isoDaysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString()

/** { value: number|null, error: AdminError|null } */
export const headCount = async (table, apply = (q) => q, { signal } = {}) => {
  try {
    let query = supabase.from(table).select('id', { count: 'exact', head: true })
    query = apply(query) || query
    if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal)
    const { count, error } = await query
    if (error) return { value: null, error: normalizeSupabaseError(error) }
    return { value: count ?? 0, error: null }
  } catch (error) {
    return { value: null, error: normalizeSupabaseError(error) }
  }
}

const METRIC_SPECS = {
  users: {
    total: () => headCount('users'),
    active: () => headCount('users', (q) => q.eq('is_active', true)),
    admins: () => headCount('users', (q) => q.eq('is_admin', true)),
    new7d: () => headCount('users', (q) => q.gte('created_at', isoDaysAgo(7))),
    new30d: () => headCount('users', (q) => q.gte('created_at', isoDaysAgo(30))),
  },
  properties: {
    total: () => headCount('properties'),
    approved: () => headCount('properties', (q) => q.eq('status', 'approved')),
    pending: () => headCount('properties', (q) => q.eq('status', 'pending')),
    rejected: () => headCount('properties', (q) => q.eq('status', 'rejected')),
    new7d: () => headCount('properties', (q) => q.gte('created_at', isoDaysAgo(7))),
    new30d: () => headCount('properties', (q) => q.gte('created_at', isoDaysAgo(30))),
  },
  orders: {
    total: () => headCount('orders'),
    pendingPayment: () => headCount('orders', (q) => q.eq('status', 'pending_payment')),
    confirmed: () => headCount('orders', (q) => q.eq('status', 'confirmed')),
    new7d: () => headCount('orders', (q) => q.gte('created_at', isoDaysAgo(7))),
  },
  payments: {
    awaiting: () => headCount('payment_transactions', (q) => q.in('status', PAYMENT_AWAITING_RAW)),
    credited7d: () => headCount('payment_transactions', (q) => q.in('status', ['credited', 'paid', 'success']).gte('created_at', isoDaysAgo(7))),
  },
  inquiries: {
    pending: () => headCount('property_inquiries', (q) => q.eq('status', 'pending')),
  },
  feedback: {
    total: () => headCount('feedback'),
    pending: () => headCount('feedback', (q) => q.eq('status', 'pending')),
  },
  refunds: {
    requested: () => headCount('contact_unlock_refund_requests', (q) => q.eq('status', 'requested')),
  },
}

/**
 * Returns { data: { metrics, flat..., generatedAt }, error, partial }.
 * `metrics.<group>.<name>` = { value, error }. Flat legacy keys
 * (totalUsers, activeUsers, totalProperties, pendingProperties, totalOrders,
 * totalFeedback) are kept for components that still read them.
 */
export const getDashboardStats = async () => {
  const jobs = []
  for (const [group, specs] of Object.entries(METRIC_SPECS)) {
    for (const [name, run] of Object.entries(specs)) jobs.push({ group, name, run })
  }
  const settled = await Promise.allSettled(jobs.map((job) => job.run()))
  const metrics = {}
  let failed = 0
  let firstError = null
  settled.forEach((result, index) => {
    const { group, name } = jobs[index]
    metrics[group] = metrics[group] || {}
    const value = result.status === 'fulfilled' ? result.value : { value: null, error: normalizeSupabaseError(result.reason) }
    if (value.error) {
      failed += 1
      firstError = firstError || value.error
    }
    metrics[group][name] = value
  })
  const v = (group, name) => metrics[group]?.[name]?.value ?? 0
  const data = {
    metrics,
    generatedAt: new Date().toISOString(),
    totalUsers: v('users', 'total'),
    activeUsers: v('users', 'active'),
    adminUsers: v('users', 'admins'),
    totalProperties: v('properties', 'total'),
    pendingProperties: v('properties', 'pending'),
    totalOrders: v('orders', 'total'),
    totalFeedback: v('feedback', 'total'),
  }
  const allFailed = failed === jobs.length
  if (failed > 0) logAdminError('dashboard', firstError)
  return { ...ok(data), error: allFailed ? firstError : null, partial: failed > 0 && !allFailed, failedCount: failed }
}

let queueCountsMemory = { value: null, at: 0 }
let queueCountsInflight = null
const QUEUE_TTL_MS = 30000

/** Pending queue counts for sidebar badges and dashboard tiles (30 s memory TTL). */
export const getAdminQueueCounts = async ({ force = false } = {}) => {
  const now = Date.now()
  if (!force && queueCountsMemory.value && now - queueCountsMemory.at < QUEUE_TTL_MS) {
    return ok(queueCountsMemory.value)
  }
  if (queueCountsInflight) return queueCountsInflight
  queueCountsInflight = (async () => {
    const [properties, payments, refunds, inquiries, feedback] = await Promise.all([
      METRIC_SPECS.properties.pending(),
      METRIC_SPECS.payments.awaiting(),
      METRIC_SPECS.refunds.requested(),
      METRIC_SPECS.inquiries.pending(),
      METRIC_SPECS.feedback.pending(),
    ])
    const parts = { properties, payments, refunds, inquiries, feedback }
    const errors = Object.values(parts).map((p) => p.error).filter(Boolean)
    const counts = {
      pendingProperties: properties.value ?? 0,
      awaitingPayments: payments.value ?? 0,
      requestedRefunds: refunds.value ?? 0,
      pendingInquiries: inquiries.value ?? 0,
      pendingFeedback: feedback.value ?? 0,
      generatedAt: new Date().toISOString(),
    }
    counts.total = counts.pendingProperties + counts.awaitingPayments + counts.requestedRefunds + counts.pendingInquiries + counts.pendingFeedback
    queueCountsInflight = null
    if (errors.length === Object.keys(parts).length) {
      return fail(errors[0])
    }
    queueCountsMemory = { value: counts, at: Date.now() }
    writeAdminSnapshot(ADMIN_QUEUE_COUNTS_KEY, counts)
    return { ...ok(counts), partial: errors.length > 0 }
  })()
  return queueCountsInflight
}

export const readQueueCountsSnapshot = () => readAdminSnapshot(ADMIN_QUEUE_COUNTS_KEY)
export const resetQueueCountsMemory = () => {
  queueCountsMemory = { value: null, at: 0 }
}
