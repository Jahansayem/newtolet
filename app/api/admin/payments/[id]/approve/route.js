import { NextResponse } from 'next/server'
import {
  getPaymentTransactionById,
  updatePaymentTransactionById,
} from '../../../../../../src/server/paymentTransactions.js'
import { getAuthenticatedUser } from '../../../../../../src/server/supabaseServer.js'

const isMissingFunctionError = (error) =>
  error?.code === 'PGRST202' ||
  error?.message?.toLowerCase?.().includes('function') ||
  error?.message?.toLowerCase?.().includes('does not exist')

const insertCreditTransaction = async (adminClient, payload) => {
  let result = await adminClient
    .from('credit_transactions')
    .insert(payload)

  if (
    result.error &&
    (result.error.code === 'PGRST204' || result.error.message?.toLowerCase?.().includes('column'))
  ) {
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

const manuallyApprovePayment = async (adminClient, payment, adminId) => {
  if (payment.status === 'credited') {
    return payment
  }

  if (payment.status !== 'awaiting_admin_approval') {
    throw new Error('Only verified payments can be approved')
  }

  const { data: currentUser, error: userError } = await adminClient
    .from('users')
    .select('credits')
    .eq('id', payment.user_id)
    .maybeSingle()

  if (userError) {
    throw userError
  }

  const newBalance = Number(currentUser?.credits ?? 0) + Number(payment.credits_to_add ?? 0)

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
    credits_deducted: -Number(payment.credits_to_add ?? 0),
    transaction_type: 'credit_purchase',
    payment_transaction_id: payment.transaction_id,
    credits_amount: Number(payment.credits_to_add ?? 0),
    balance_after: newBalance,
    reference_type: 'payment_transaction',
    reference_id: payment.id,
    provider: 'uddoktapay',
    metadata: {
      invoice_id: payment.invoice_id || payment.reference || null,
      approved_by: adminId,
    },
  })

  return updatePaymentTransactionById(adminClient, payment.id, {
    status: 'credited',
    approved_at: new Date().toISOString(),
    approved_by: adminId,
    credited_at: new Date().toISOString(),
    credited_by: adminId,
  })
}

export async function POST(request, context) {
  try {
    const { profile, adminClient } = await getAuthenticatedUser(request, { requireAdmin: true })
    const params = await context?.params
    const paymentId = params?.id

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment id is required' }, { status: 400 })
    }

    const payment = await getPaymentTransactionById(adminClient, paymentId)

    if (!payment) {
      return NextResponse.json({ error: 'Payment transaction not found' }, { status: 404 })
    }

    if (payment.status === 'credited') {
      return NextResponse.json({ data: payment })
    }

    let approvedPayment = null

    const rpcResult = await adminClient.rpc('approve_credit_payment_transaction', {
      p_payment_transaction_id: paymentId,
      p_admin_id: profile.id,
    })

    if (rpcResult.error) {
      if (!isMissingFunctionError(rpcResult.error)) {
        throw rpcResult.error
      }

      approvedPayment = await manuallyApprovePayment(adminClient, payment, profile.id)
    } else {
      approvedPayment = await getPaymentTransactionById(adminClient, paymentId)
    }

    return NextResponse.json({ data: approvedPayment })
  } catch (error) {
    const status =
      error.message === 'Admin access required'
        ? 403
        : error.message === 'Missing authorization token' || error.message === 'Invalid or expired session'
          ? 401
          : 500

    return NextResponse.json(
      { error: error.message || 'Unable to approve payment transaction' },
      { status }
    )
  }
}
