// Payment transactions: paginated list with canonical status filtering,
// approve / reject / refund through RPCs, CSV export.

import { getAccessToken } from '../apiClient'
import { invokeSupabaseFunction } from '../functionClient'
import { mapPaymentTransactionRecord, rawValuesFor } from '../../lib/paymentStatus'
import { csvFilename, downloadCsv, toCsv } from '../../lib/exportCsv'
import { fetchAdminRow, fetchAllPages, runAdminListQuery } from './adminQuery'
import { callAdminRpc } from './adminRpc'
import { fail, ok } from './adminResult'
import { invalidateAdminSnapshots } from './adminCache'
import { ADMIN_ERROR_CODES } from '../../lib/adminErrorCodes'

export const PAYMENT_LIST_COLUMNS = `
  id, user_id, package_id, transaction_id, amount, status, payment_method, description, credits_to_add,
  provider, invoice_id, reference, customer_phone, approved_at, approved_by, credited_at, rejected_at, rejected_by,
  review_note, refunded_at, created_at, updated_at,
  buyer:users!payment_transactions_user_id_fkey(name, email),
  package:credit_packages!payment_transactions_package_id_fkey(package_name)
`

const normalize = (row) => mapPaymentTransactionRecord({ ...row, users: row.buyer })

export const listPayments = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'payment_transactions',
    columns: PAYMENT_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'amount', 'status'],
    filters: { status: filters.status, created_at: filters.dateRange },
    filterSpec: { status: { op: 'in', values: rawValuesFor }, created_at: { op: 'range' } },
    search,
    searchColumns: ['transaction_id', 'invoice_id', 'reference', 'customer_phone', 'payment_method'],
    map: normalize,
    signal,
  })

export const getPayment = (paymentId, { signal } = {}) =>
  fetchAdminRow({ table: 'payment_transactions', columns: `*, buyer:users!payment_transactions_user_id_fkey(name, email, phone), package:credit_packages!payment_transactions_package_id_fkey(package_name)`, id: paymentId, map: normalize, signal })

const after = (result) => {
  if (!result.error) invalidateAdminSnapshots('payments')
  return result
}

/** Approve through the RPC; fall back to the Edge Function while the RPC is missing. */
export const approvePayment = async (paymentId) => {
  const rpc = await callAdminRpc('admin_approve_payment', { p_payment_id: paymentId }, { map: normalize })
  if (!rpc.error || rpc.error.code !== ADMIN_ERROR_CODES.MISSING_RPC) return after(rpc)
  try {
    const token = await getAccessToken()
    if (!token) return fail({ code: 'PGRST301', message: 'Authentication required' })
    const response = await invokeSupabaseFunction({ functionName: 'paymently-approve', token, body: { paymentId } })
    return after(ok(mapPaymentTransactionRecord(response?.data || {})))
  } catch (error) {
    return fail(error)
  }
}

/** reject | cancel with a required reason. Approvals go through approvePayment. */
export const reviewPayment = async (paymentId, decision, reason) =>
  after(await callAdminRpc('admin_review_payment', { p_payment_id: paymentId, p_decision: decision, p_reason: reason }, { map: normalize }))

export const refundPayment = async (paymentId, reason) =>
  after(await callAdminRpc('admin_refund_payment', { p_payment_id: paymentId, p_reason: reason }, { map: normalize }))

export const PAYMENT_CSV_COLUMNS = [
  { key: 'created_at', label: 'Date' },
  { key: 'transaction_id', label: 'Transaction' },
  { key: 'invoice_id', label: 'Invoice' },
  { key: (row) => row.buyer?.name || '', label: 'User' },
  { key: (row) => row.buyer?.email || '', label: 'Email' },
  { key: 'amount', label: 'Amount (BDT)' },
  { key: 'credits_to_add', label: 'Credits' },
  { key: 'payment_method', label: 'Method' },
  { key: 'status', label: 'Status' },
  { key: 'raw_status', label: 'Gateway status' },
  { key: 'review_note', label: 'Review note' },
]

export const exportPaymentsCsv = async (params = {}) => {
  const result = await fetchAllPages(listPayments, params)
  if (result.error && (!result.data || result.data.length === 0)) return result
  const csv = toCsv(result.data, PAYMENT_CSV_COLUMNS)
  downloadCsv(csvFilename(`payments-${params.filters?.status || 'all'}`), csv)
  return { ...ok({ rows: result.data.length, truncated: Boolean(result.truncated) }), error: result.error || null }
}

// ---- compatibility wrappers ----
export const approvePaymentTransaction = approvePayment
/** @deprecated use listPayments */
export const getAllPaymentTransactions = async () => {
  const result = await listPayments({ pageSize: 100 })
  return { data: result.data || [], error: result.error }
}
/** @deprecated use listPayments({ filters: { status } }) */
export const getPaymentTransactionsByStatus = async (status) => {
  const result = await listPayments({ pageSize: 100, filters: { status } })
  return { data: result.data || [], error: result.error }
}
