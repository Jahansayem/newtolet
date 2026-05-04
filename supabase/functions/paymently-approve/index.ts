import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { getAuthenticatedContext } from "../_shared/paymently.ts";
import { getPaymentTransactionById, updatePaymentTransactionById } from "../_shared/payment-transactions.ts";

const isMissingFunctionError = (error: { code?: string; message?: string } | null | undefined) =>
  error?.code === "PGRST202" ||
  error?.message?.toLowerCase?.().includes("function") ||
  error?.message?.toLowerCase?.().includes("does not exist");

const insertCreditTransaction = async (adminClient: any, payload: Record<string, unknown>) => {
  let result = await adminClient
    .from("credit_transactions")
    .insert(payload);

  if (
    result.error &&
    (result.error.code === "PGRST204" || result.error.message?.toLowerCase?.().includes("column"))
  ) {
    result = await adminClient.from("credit_transactions").insert({
      user_id: payload.user_id,
      credits_deducted: payload.credits_deducted,
      transaction_type: payload.transaction_type,
      payment_transaction_id: payload.payment_transaction_id,
    });
  }

  if (result.error) {
    throw result.error;
  }
};

const manuallyApprovePayment = async (adminClient: any, payment: any, adminId: string) => {
  if (payment.status === "credited") {
    return payment;
  }

  if (payment.status !== "awaiting_admin_approval") {
    throw new Error("Only verified payments can be approved");
  }

  const { data: currentUser, error: userError } = await adminClient
    .from("users")
    .select("credits")
    .eq("id", payment.user_id)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  const newBalance = Number(currentUser?.credits ?? 0) + Number(payment.credits_to_add ?? 0);

  const { error: updateUserError } = await adminClient
    .from("users")
    .update({
      credits: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.user_id);

  if (updateUserError) {
    throw updateUserError;
  }

  await insertCreditTransaction(adminClient, {
    user_id: payment.user_id,
    credits_deducted: -Number(payment.credits_to_add ?? 0),
    transaction_type: "credit_purchase",
    payment_transaction_id: payment.transaction_id,
    credits_amount: Number(payment.credits_to_add ?? 0),
    balance_after: newBalance,
    reference_type: "payment_transaction",
    reference_id: payment.id,
    provider: "uddoktapay",
    metadata: {
      invoice_id: payment.invoice_id || payment.reference || null,
      approved_by: adminId,
    },
  });

  return updatePaymentTransactionById(adminClient, payment.id, {
    status: "credited",
    approved_at: new Date().toISOString(),
    approved_by: adminId,
    credited_at: new Date().toISOString(),
    credited_by: adminId,
  });
};

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { profile, adminClient } = await getAuthenticatedContext(request);

    if (profile.is_admin !== true) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const paymentId = body?.paymentId || body?.payment_id;

    if (!paymentId) {
      return Response.json({ error: "Payment id is required" }, { status: 400 });
    }

    const payment = await getPaymentTransactionById(adminClient, paymentId);

    if (!payment) {
      return Response.json({ error: "Payment transaction not found" }, { status: 404 });
    }

    if (payment.status === "credited") {
      return Response.json({ data: payment });
    }

    let approvedPayment = null;

    const rpcResult = await adminClient.rpc("approve_credit_payment_transaction", {
      p_payment_transaction_id: paymentId,
      p_admin_id: profile.id,
    });

    if (rpcResult.error) {
      if (!isMissingFunctionError(rpcResult.error)) {
        throw rpcResult.error;
      }

      approvedPayment = await manuallyApprovePayment(adminClient, payment, profile.id);
    } else {
      approvedPayment = await getPaymentTransactionById(adminClient, paymentId);
    }

    return Response.json({ data: approvedPayment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve payment transaction";
    const status = message === "Admin access required"
      ? 403
      : message === "Missing authorization token" || message === "Invalid or expired session"
      ? 401
      : 500;

    return Response.json({ error: message }, { status });
  }
});
