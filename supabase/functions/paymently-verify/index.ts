import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createAdminClient, getAuthenticatedContext } from "../_shared/paymently.ts";
import { checkEpsTransactionStatus } from "../_shared/eps.ts";
import {
  getPaymentTransactionById,
  getPaymentTransactionForInvoice,
  syncGatewayPayment,
} from "../_shared/payment-transactions.ts";

const sanitizePayment = (payment: Record<string, unknown>) => ({
  id: payment.id || null,
  transaction_id: payment.transaction_id || null,
  invoice_id: payment.invoice_id || null,
  reference: payment.reference || null,
  provider: payment.provider || null,
  payment_method: payment.payment_method || null,
  status: payment.status || "pending",
  amount: payment.amount || 0,
  credits_to_add: payment.credits_to_add || 0,
  description: payment.description || null,
  created_at: payment.created_at || null,
  updated_at: payment.updated_at || null,
  credited_at: payment.credited_at || null,
});

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json().catch(() => ({}));
    const invoiceId = body?.invoiceId || body?.invoice_id || null;
    const paymentId = body?.paymentId || body?.payment_id || null;
    const reference = body?.reference || body?.slug || null;
    const requestedProvider = String(body?.provider || "").toLowerCase();
    const isEpsReturn = requestedProvider === "eps" || Boolean(reference && !invoiceId);

    if (isEpsReturn) {
      const adminClient = createAdminClient();
      const lookupReference = reference || invoiceId;

      if (!paymentId && !lookupReference) {
        return Response.json({ error: "EPS payment reference is required" }, { status: 400 });
      }

      const payment = paymentId
        ? await getPaymentTransactionById(adminClient, paymentId)
        : await getPaymentTransactionForInvoice(adminClient, lookupReference);

      if (!payment) {
        return Response.json(
          { error: "Payment transaction not found for this payment" },
          { status: 404 },
        );
      }

      const merchantTransactionId = payment.reference || lookupReference;

      if (!merchantTransactionId) {
        return Response.json({ error: "EPS payment reference is required" }, { status: 400 });
      }

      const statusResult = await checkEpsTransactionStatus(merchantTransactionId);
      const verificationData = {
        ...statusResult,
        provider: "eps",
        payment_method: "eps",
      };

      const syncedPayment = await syncGatewayPayment(adminClient, verificationData, "eps");

      return Response.json({
        data: {
          payment: sanitizePayment(syncedPayment),
          verification: verificationData,
        },
      });
    }

    const { profile, adminClient } = await getAuthenticatedContext(request);

    if (!invoiceId) {
      return Response.json({ error: "invoice_id is required" }, { status: 400 });
    }

    const payment = await getPaymentTransactionForInvoice(adminClient, invoiceId);

    if (!payment) {
      return Response.json(
        { error: "Payment transaction not found for this invoice" },
        { status: 404 },
      );
    }

    if (payment.user_id !== profile.id && profile.is_admin !== true) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const merchantTransactionId = payment.reference || invoiceId;
    const statusResult = await checkEpsTransactionStatus(merchantTransactionId);
    const verificationData = {
      ...statusResult,
      provider: "eps",
      payment_method: "eps",
    };

    const syncedPayment = await syncGatewayPayment(adminClient, verificationData, "eps");

    return Response.json({
      data: {
        payment: sanitizePayment(syncedPayment),
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
