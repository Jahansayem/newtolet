import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  getAuthenticatedContext,
  verifyPaymentlyPayment,
} from "../_shared/paymently.ts";
import {
  getPaymentTransactionById,
  getPaymentTransactionForInvoice,
  syncGatewayPayment,
} from "../_shared/payment-transactions.ts";

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { profile, adminClient } = await getAuthenticatedContext(request);
    const body = await request.json().catch(() => ({}));
    const invoiceId = body?.invoiceId || body?.invoice_id;

    if (!invoiceId) {
      return Response.json({ error: "invoice_id is required" }, { status: 400 });
    }

    const verificationData = await verifyPaymentlyPayment(invoiceId);
    const payload = verificationData?.data || verificationData || {};
    const metadata = payload?.metadata || {};
    const paymentId = metadata.payment_transaction_id || metadata.payment_id || null;

    const payment = paymentId
      ? await getPaymentTransactionById(adminClient, paymentId)
      : await getPaymentTransactionForInvoice(adminClient, invoiceId);

    if (!payment) {
      return Response.json(
        { error: "Payment transaction not found for this invoice" },
        { status: 404 },
      );
    }

    if (payment.user_id !== profile.id && profile.is_admin !== true) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const syncedPayment = await syncGatewayPayment(adminClient, verificationData);

    return Response.json({
      data: {
        payment: syncedPayment,
        verification: verificationData,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify payment";
    const status = message === "Missing authorization token" || message === "Invalid or expired session"
      ? 401
      : 500;

    return Response.json({ error: message }, { status });
  }
});
