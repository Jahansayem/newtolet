import { mapGatewayStatusToPaymentStatus } from './uddoktaPay.js'

const AUTO_APPROVAL_THRESHOLD_BDT = 3000
const CREDITING_STATUS = 'crediting'
const PAYMENT_TRANSACTION_RELATIONS =
  '*, buyer:users!payment_transactions_user_id_fkey(name, email), package:credit_packages!payment_transactions_package_id_fkey(package_name)'

const OPTIONAL_PAYMENT_COLUMNS = [
  'provider',
  'invoice_id',
  'customer_phone',
  'sender_number',
  'gateway_payload',
  'approved_at',
  'approved_by',
  'credited_at',
  'credited_by',
  'reference',
]

const isMissingColumnError = (error) =>
  error?.code === 'PGRST204' ||
  error?.message?.includes('Could not find the') ||
  error?.message?.toLowerCase?.().includes('column')

const omitKeys = (value, keys) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))

const normalizeMethod = (value) => (value ? String(value).trim().toLowerCase() : null)

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeRecord = (record) => ({
  ...record,
  amount: toNumber(record?.amount, 0),
  credits_to_add: toNumber(record?.credits_to_add, 0),
  invoice_id: record?.invoice_id || record?.reference || null,
  payment_method: normalizeMethod(record?.payment_method),
  gateway_payload: record?.gateway_payload || null,
})

const insertWithFallback = async (adminClient, payload) => {
  let result = await adminClient
    .from('payment_transactions')
    .insert(payload)
    .select('*')
    .maybeSingle()

  if (result.error && isMissingColumnError(result.error)) {
    result = await adminClient
      .from('payment_transactions')
      .insert(omitKeys(payload, OPTIONAL_PAYMENT_COLUMNS))
      .select('*')
      .maybeSingle()
  }

  if (result.error) {
    throw result.error
  }

  return normalizeRecord(result.data)
}

const updateByQueryWithFallback = async (queryBuilderFactory, values) => {
  let result = await queryBuilderFactory(values)

  if (result.error && isMissingColumnError(result.error)) {
    result = await queryBuilderFactory(omitKeys(values, OPTIONAL_PAYMENT_COLUMNS))
  }

  if (result.error) {
    throw result.error
  }

  return normalizeRecord(result.data)
}

export const createPendingPaymentTransaction = async ({
  adminClient,
  userId,
  packageId,
  transactionId,
  amount,
  paymentMethod,
  creditsToAdd,
  phoneNumber,
  description,
}) => {
  return insertWithFallback(adminClient, {
    user_id: userId,
    package_id: packageId,
    transaction_id: transactionId,
    amount,
    status: 'pending',
    payment_method: normalizeMethod(paymentMethod),
    description,
    credits_to_add: creditsToAdd,
    provider: 'uddoktapay',
    customer_phone: phoneNumber || null,
  })
}

export const getPaymentTransactionById = async (adminClient, paymentId) => {
  const { data, error } = await adminClient
    .from('payment_transactions')
    .select(PAYMENT_TRANSACTION_RELATIONS)
    .eq('id', paymentId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? normalizeRecord(data) : null
}

export const updatePaymentTransactionById = async (adminClient, paymentId, values) => {
  return updateByQueryWithFallback(
    (nextValues) =>
      adminClient
        .from('payment_transactions')
        .update({
          ...nextValues,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select('*')
        .maybeSingle(),
    values
  )
}

const getPaymentTransactionByInvoiceId = async (adminClient, invoiceId) => {
  const { data, error } = await adminClient
    .from('payment_transactions')
    .select('*')
    .or(`invoice_id.eq.${invoiceId},reference.eq.${invoiceId}`)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? normalizeRecord(data) : null
}

const getPaymentTransactionWithRelationsByInvoiceId = async (adminClient, invoiceId) => {
  const { data, error } = await adminClient
    .from('payment_transactions')
    .select(PAYMENT_TRANSACTION_RELATIONS)
    .or(`invoice_id.eq.${invoiceId},reference.eq.${invoiceId}`)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? normalizeRecord(data) : null
}

const isMissingFunctionError = (error) =>
  error?.code === 'PGRST202' ||
  error?.message?.toLowerCase?.().includes('function') ||
  error?.message?.toLowerCase?.().includes('does not exist')

const insertCreditTransaction = async (adminClient, payload) => {
  let result = await adminClient.from('credit_transactions').insert(payload)

  if (result.error && isMissingColumnError(result.error)) {
    result = await adminClient.from('credit_transactions').insert({
      user_id: payload.user_id,
      credits_deducted: payload.credits_deducted,
      transaction_type: payload.transaction_type,
      payment_transaction_id: payload.payment_transaction_id,
    })
  }

  if (result.error) {
    throw result.error
  }
}

const lockPaymentForManualCredit = async (adminClient, paymentId) => {
  const now = new Date().toISOString()

  let result = await adminClient
    .from('payment_transactions')
    .update({
      status: CREDITING_STATUS,
      updated_at: now,
    })
    .eq('id', paymentId)
    .eq('status', 'awaiting_admin_approval')
    .select('*')
    .maybeSingle()

  if (result.error && isMissingColumnError(result.error)) {
    result = await adminClient
      .from('payment_transactions')
      .update({
        status: CREDITING_STATUS,
      })
      .eq('id', paymentId)
      .eq('status', 'awaiting_admin_approval')
      .select('*')
      .maybeSingle()
  }

  if (result.error) {
    throw result.error
  }

  return result.data ? normalizeRecord(result.data) : null
}

const manuallyCreditApprovedPayment = async (adminClient, payment, actorId = null) => {
  if (payment.status === 'credited') {
    return getPaymentTransactionById(adminClient, payment.id)
  }

  const lockedPayment = await lockPaymentForManualCredit(adminClient, payment.id)

  if (!lockedPayment) {
    return getPaymentTransactionById(adminClient, payment.id)
  }

  const { data: currentUser, error: userError } = await adminClient
    .from('users')
    .select('credits')
    .eq('id', payment.user_id)
    .maybeSingle()

  if (userError) {
    throw userError
  }

  const newBalance =
    toNumber(currentUser?.credits, 0) + toNumber(lockedPayment.credits_to_add, 0)

  const { error: updateUserError } = await adminClient
    .from('users')
    .update({
      credits: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.user_id)

  if (updateUserError) {
    throw updateUserError
  }

  await insertCreditTransaction(adminClient, {
    user_id: payment.user_id,
    credits_deducted: -toNumber(lockedPayment.credits_to_add, 0),
    transaction_type: 'credit_purchase',
    payment_transaction_id: lockedPayment.transaction_id,
    credits_amount: toNumber(lockedPayment.credits_to_add, 0),
    balance_after: newBalance,
    reference_type: 'payment_transaction',
    reference_id: lockedPayment.id,
    provider: 'uddoktapay',
    metadata: {
      invoice_id: lockedPayment.invoice_id || lockedPayment.reference || null,
      approved_by: actorId,
    },
  })

  return updatePaymentTransactionById(adminClient, lockedPayment.id, {
    status: 'credited',
    approved_at: new Date().toISOString(),
    approved_by: actorId,
    credited_at: new Date().toISOString(),
    credited_by: actorId,
  })
}

const creditApprovedPayment = async (adminClient, paymentId, actorId = null) => {
  const rpcResult = await adminClient.rpc('approve_credit_payment_transaction', {
    p_payment_transaction_id: paymentId,
    p_admin_id: actorId,
  })

  if (rpcResult.error) {
    if (!isMissingFunctionError(rpcResult.error)) {
      throw rpcResult.error
    }

    const payment = await getPaymentTransactionById(adminClient, paymentId)
    if (!payment) {
      throw new Error('Payment transaction not found')
    }

    return manuallyCreditApprovedPayment(adminClient, payment, actorId)
  }

  return getPaymentTransactionById(adminClient, paymentId)
}

const getGatewayPayload = (verificationData) => verificationData?.data || verificationData || {}

const shouldRequireManualApproval = (amount) => toNumber(amount, 0) > AUTO_APPROVAL_THRESHOLD_BDT

export const syncGatewayPayment = async (adminClient, verificationData) => {
  const payload = verificationData?.data || verificationData || {}
  const metadata = payload?.metadata || {}
  const paymentId = metadata.payment_transaction_id || metadata.payment_id || null
  const invoiceId = payload?.invoice_id || null

  let payment = null

  if (paymentId) {
    payment = await getPaymentTransactionById(adminClient, paymentId)
  }

  if (!payment && invoiceId) {
    payment = await getPaymentTransactionByInvoiceId(adminClient, invoiceId)
  }

  if (!payment) {
    throw new Error('Payment transaction not found for this invoice')
  }

  const gatewayStatus = String(payload?.status || '').toUpperCase()
  const verifiedAmount = toNumber(payload?.amount, payment.amount ?? 0)
  const nextStatus = mapGatewayStatusToPaymentStatus(gatewayStatus)
  const sharedUpdate = {
    payment_method: normalizeMethod(payload?.payment_method) || payment.payment_method,
    amount: verifiedAmount,
    invoice_id: invoiceId || payment.invoice_id || null,
    reference: invoiceId || payment.reference || null,
    sender_number: payload?.sender_number || null,
    gateway_payload: verificationData,
    provider: 'uddoktapay',
  }

  if (payment.status === 'credited') {
    return updatePaymentTransactionById(adminClient, payment.id, sharedUpdate)
  }

  if (gatewayStatus === 'COMPLETED') {
    const requiresManualApproval = shouldRequireManualApproval(verifiedAmount)

    const syncedPayment = await updatePaymentTransactionById(adminClient, payment.id, {
      ...sharedUpdate,
      status: 'awaiting_admin_approval',
    })

    if (requiresManualApproval) {
      return syncedPayment
    }

    return creditApprovedPayment(adminClient, syncedPayment.id, null)
  }

  return updatePaymentTransactionById(adminClient, payment.id, {
    ...sharedUpdate,
    status: nextStatus,
  })
}

export const getHybridApprovalThreshold = () => AUTO_APPROVAL_THRESHOLD_BDT

export const getPaymentTransactionForInvoice = async (adminClient, invoiceId) => {
  return getPaymentTransactionWithRelationsByInvoiceId(adminClient, invoiceId)
}

export const getGatewayVerificationStatus = (verificationData) =>
  String(getGatewayPayload(verificationData)?.status || '').toUpperCase()
