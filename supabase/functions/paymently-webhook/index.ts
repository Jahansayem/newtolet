import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createAdminClient,
  validateWebhookRequest,
  verifyPaymentlyPayment,
} from "../_shared/paymently.ts";
import { syncGatewayPayment } from "../_shared/payment-transactions.ts";

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    if (!validateWebhookRequest(request)) {
      return Response.json({ error: "Unauthorized webhook request" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const invoiceId = payload?.invoice_id || payload?.invoiceId;

    if (!invoiceId) {
      return Response.json({ error: "invoice_id is required" }, { status: 400 });
    }

    const verificationData = await verifyPaymentlyPayment(invoiceId);
    const adminClient = createAdminClient();
    const payment = await syncGatewayPayment(adminClient, verificationData);

    return Response.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process payment webhook";
    return Response.json({ error: message }, { status: 500 });
  }
});
