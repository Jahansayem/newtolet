// Payment status normalisation shared by the admin data layer and
// paymentService. Legacy gateway values (paid, success, created) are mapped to
// the canonical set. Pure module, safe for node --test.

export const PAYMENT_STATUS_RAW_VALUES = Object.freeze({
  pending: ['pending', 'created'],
  awaiting_admin_approval: ['awaiting_admin_approval'],
  crediting: ['crediting'],
  credited: ['credited', 'paid', 'success'],
  failed: ['failed', 'error'],
  cancelled: ['cancelled'],
  refunded: ['refunded'],
})

const RAW_TO_CANONICAL = Object.freeze(
  Object.entries(PAYMENT_STATUS_RAW_VALUES).reduce((acc, [canonical, raws]) => {
    for (const raw of raws) acc[raw] = canonical
    return acc
  }, {})
)

export const PAYMENT_STATUSES = Object.freeze(Object.keys(PAYMENT_STATUS_RAW_VALUES))

/** Raw column values to query for a canonical status (unknown -> itself). */
export const rawValuesFor = (status) => PAYMENT_STATUS_RAW_VALUES[status] || (status ? [status] : [])

export const mapPaymentStatus = (raw) => RAW_TO_CANONICAL[raw] || raw || 'pending'

/** Normalises a payment_transactions row for the UI; keeps the raw status. */
export const mapPaymentTransactionRecord = (record = {}) => {
  const invoiceId = record?.invoice_id || record?.reference || null
  return {
    ...record,
    raw_status: record?.status ?? null,
    status: mapPaymentStatus(record?.status),
    amount: Number(record?.amount ?? record?.amount_bdt ?? 0),
    credits_to_add: Number(record?.credits_to_add ?? 0),
    invoice_id: invoiceId,
    transaction_id: record?.transaction_id || invoiceId || record?.id,
    payment_method: record?.payment_method ? String(record.payment_method).toLowerCase() : null,
    description: record?.description || `${Number(record?.credits_to_add ?? 0)} credits purchase`,
  }
}
