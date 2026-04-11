import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '../../../../../src/server/supabaseServer.js'
import { syncGatewayPayment } from '../../../../../src/server/paymentTransactions.js'
import { validateWebhookRequest, verifyInvoice } from '../../../../../src/server/uddoktaPay.js'

export async function POST(request) {
  try {
    if (!validateWebhookRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 })
    }

    const payload = await request.json().catch(() => ({}))
    const invoiceId = payload?.invoice_id || payload?.invoiceId

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })
    }

    const verification = await verifyInvoice(invoiceId)
    const adminClient = createSupabaseAdminClient()
    const payment = await syncGatewayPayment(adminClient, verification)

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Unable to process payment webhook' },
      { status: 500 }
    )
  }
}
