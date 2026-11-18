// Payment links (admin): server-paginated list over the payment_links_admin
// view + RPC-backed mutations. A link is paid by a customer through EPS on the
// public pay page; nothing here ever marks a link paid.

import { supabase } from '../supabaseClient'
import { runAdminListQuery } from './adminQuery'
import { callAdminRpc } from './adminRpc'
import { invalidateAdminSnapshots } from './adminCache'
import { fail, ok } from './adminResult'
import { listCustomerOrders } from './customerOrders'
import { verifyPaymentLink } from '../paymentLinkService'

export const PAYMENT_LINKS_DOMAIN = 'payment-links'
export const PAYMENT_LINKS_VIEW = 'payment_links_admin'

export const PAYMENT_LINK_LIST_COLUMNS = `
  id, code, amount_bdt, purpose, customer_name, customer_phone, customer_email, note, status,
  customer_order_id, customer_order_no, paid_at, paid_reference, paid_eps_transaction_id, paid_method,
  attempts, last_attempt_at, last_attempt_status, created_by_label, cancelled_at, cancel_reason, created_at
`

const SEARCH_COLUMNS = ['code', 'customer_name', 'customer_phone', 'purpose', 'customer_order_no']

const after = (result) => {
  if (!result.error) invalidateAdminSnapshots(PAYMENT_LINKS_DOMAIN)
  return result
}

/** listPaymentLinks({ page, pageSize, sort, search, filters: { status } }) */
export const listPaymentLinks = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: PAYMENT_LINKS_VIEW,
    columns: PAYMENT_LINK_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'amount_bdt', 'status', 'paid_at'],
    filters: { status: filters.status },
    filterSpec: { status: { op: 'eq' } },
    search,
    searchColumns: SEARCH_COLUMNS,
    signal,
  })

/** { active, paid, cancelled, active_bdt, collected_bdt } */
export const getPaymentLinkCounts = ({ signal } = {}) => callAdminRpc('admin_payment_link_counts', {}, { signal })

export const createPaymentLink = async ({ amountBdt, purpose, customerName = null, customerPhone = null, customerEmail = null, note = null, customerOrderId = null }) =>
  after(
    await callAdminRpc('admin_create_payment_link', {
      p_amount_bdt: amountBdt,
      p_purpose: purpose,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_customer_email: customerEmail,
      p_note: note,
      p_customer_order_id: customerOrderId,
    })
  )

export const cancelPaymentLink = async (linkId, reason) =>
  after(await callAdminRpc('admin_cancel_payment_link', { p_link_id: linkId, p_reason: reason }))

/**
 * Asks EPS about the link's latest attempts and records the answer. EPS sends
 * no webhook, so this is how a payment is picked up when the customer closed
 * the browser before returning to the pay page.
 * Resolves to { link, payment, checked }.
 */
export const checkPaymentLink = async (code) => {
  const result = await verifyPaymentLink(code)
  if (result.error) return fail(result.error)
  // The attached Customer Order may have just been marked paid as well.
  invalidateAdminSnapshots(PAYMENT_LINKS_DOMAIN)
  invalidateAdminSnapshots('customer-orders')
  return ok(result.data)
}

/** Every payment attempt on a link, newest first. */
export const listPaymentLinkAttempts = async (linkId, { signal } = {}) => {
  try {
    let query = supabase
      .from('payment_transactions')
      .select('id, status, amount, reference, review_note, gateway_payload, created_at, credited_at')
      .eq('payment_link_id', linkId)
      .order('created_at', { ascending: false })
      .limit(25)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) return fail(error)
    return ok(data || [])
  } catch (error) {
    return fail(error)
  }
}

/** Open Customer Orders matching an order number, phone or name, for the "attach to order" picker. */
export const searchOrdersForPaymentLink = async (term, { signal } = {}) => {
  const result = await listCustomerOrders({ page: 1, pageSize: 6, search: term }, { signal })
  if (result.error) return result
  return ok(
    (result.data || []).map((order) => ({
      id: order.id,
      order_no: order.order_no,
      status: order.status,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      amount_due: order.amount_due,
    }))
  )
}
