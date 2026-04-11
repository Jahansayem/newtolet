import { NextResponse } from 'next/server'
import {
  createSupabaseAdminClient,
  getAuthenticatedUser,
} from '../../../../../src/server/supabaseServer.js'
import {
  getPaymentTransactionById,
  getPaymentTransactionForInvoice,
  syncGatewayPayment,
} from '../../../../../src/server/paymentTransactions.js'
import { verifyInvoice } from '../../../../../src/server/uddoktaPay.js'

export async function POST(request) {
  try {
    const body = await request.json()
    const invoiceId = body?.invoiceId || body?.invoice_id

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })
    }

    const { profile } = await getAuthenticatedUser(request)
    const adminClient = createSupabaseAdminClient()
    const verification = await verifyInvoice(invoiceId)
    const payload = verification?.data || verification || {}
    const metadata = payload?.metadata || {}
    const paymentId = metadata.payment_transaction_id || metadata.payment_id || null

    const payment = paymentId
      ? await getPaymentTransactionById(adminClient, paymentId)
      : await getPaymentTransactionForInvoice(adminClient, invoiceId)

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment transaction not found for this invoice' },
        { status: 404 }
      )
    }

    if (payment.user_id !== profile.id && profile.is_admin !== true) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const syncedPayment = await syncGatewayPayment(adminClient, verification)

    return NextResponse.json({
      data: {
        payment: syncedPayment,
        verification,
      },
    })
  } catch (error) {
    const status =
      error.message === 'Missing authorization token' || error.message === 'Invalid or expired session'
        ? 401
        : error.message === 'invoice_id is required'
          ? 400
        : 500

    return NextResponse.json(
      { error: error.message || 'Unable to verify payment' },
      { status }
    )
  }
}
