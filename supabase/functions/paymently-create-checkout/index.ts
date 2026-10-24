import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  getAuthenticatedContext,
  getEpsCheckoutUrls,
  getPaymentErrorMessage,
} from "../_shared/paymently.ts";
import { initializeEpsPayment } from "../_shared/eps.ts";
import {
  assertUserCanPurchaseCredits,
  buildTransactionId,
  createPendingPaymentTransaction,
  getCreditPackageOrThrow,
  getDisplayName,
  updatePaymentTransactionById,
} from "../_shared/payment-transactions.ts";

const PROVIDER = "eps";

// EPS requires a digit-only merchant transaction id (minimum 10 digits).
// 13-digit millisecond timestamp + 5 random digits = 18 digits, unique enough per merchant.
const buildMerchantTransactionId = () => {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000;
  return `${Date.now()}${String(random).padStart(5, "0")}`;
};

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { user, profile, adminClient } = await getAuthenticatedContext(request);
    const body = await request.json().catch(() => ({}));
    const packageId = body?.packageId;

    if (!packageId) {
      return Response.json({ error: "Package is required" }, { status: 400 });
    }

    await assertUserCanPurchaseCredits(adminClient, profile);

    const selectedPackage = await getCreditPackageOrThrow(adminClient, packageId);
    const price = Number(selectedPackage.price_bdt ?? 0);
    const discount = Number(selectedPackage.discount_percentage ?? 0);
    const finalAmount = Number((price - (price * discount) / 100).toFixed(2));
    const creditsToAdd = Number(selectedPackage.credits_amount ?? 0);
    const transactionId = buildTransactionId();
    const customerPhone = body?.phoneNumber || body?.phone_number || profile.phone || "01700000000";

    const paymentTransaction = await createPendingPaymentTransaction(adminClient, {
      userId: profile.id,
      packageId: selectedPackage.id,
      transactionId,
      amount: finalAmount,
      creditsToAdd,
      description: `${selectedPackage.package_name} credit purchase`,
      provider: PROVIDER,
      paymentMethod: PROVIDER,
      customerPhone,
    });

    const merchantTransactionId = buildMerchantTransactionId();

    try {
      const checkoutUrls = getEpsCheckoutUrls(merchantTransactionId);

      console.info("[paymently-create-checkout] starting EPS checkout", {
        paymentId: paymentTransaction.id,
        merchantTransactionId,
        amount: finalAmount,
      });

      const gatewayResponse = await initializeEpsPayment({
        merchantTransactionId,
        customerOrderId: paymentTransaction.transaction_id,
        totalAmount: finalAmount,
        successUrl: checkoutUrls.successUrl,
        failUrl: checkoutUrls.failUrl,
        cancelUrl: checkoutUrls.cancelUrl,
        customerName: getDisplayName(profile, user),
        // EPS marks customerEmail as mandatory; phone-only accounts have no email.
        customerEmail: profile.email || user.email || "support@newtolet.com",
        customerPhone,
        productName: `${selectedPackage.package_name} credit purchase`,
      });

      const paymentUrl = gatewayResponse.redirectUrl;

      if (!paymentUrl) {
        throw new Error("EPS did not return a checkout URL");
      }

      await updatePaymentTransactionById(adminClient, paymentTransaction.id, {
        reference: merchantTransactionId,
        gateway_payload: gatewayResponse,
        provider: PROVIDER,
        payment_method: PROVIDER,
      });

      return Response.json({
        data: {
          paymentUrl,
          transactionId: paymentTransaction.transaction_id,
          paymentId: paymentTransaction.id,
          provider: PROVIDER,
          paymentMethod: PROVIDER,
          reference: merchantTransactionId,
        },
      });
    } catch (error) {
      const message = getPaymentErrorMessage(error, "Unable to start payment checkout");
      console.error("[paymently-create-checkout] checkout creation failed", {
        paymentId: paymentTransaction.id,
        provider: PROVIDER,
        message,
      });

      await updatePaymentTransactionById(adminClient, paymentTransaction.id, {
        status: "failed",
        gateway_payload: {
          error: message,
          provider: PROVIDER,
          failed_at: new Date().toISOString(),
        },
      }).catch(() => null);

      throw new Error(message);
    }
  } catch (error) {
    const message = getPaymentErrorMessage(error, "Unable to start payment checkout");
    console.error("[paymently-create-checkout] request failed", { message });

    const status = message === "Missing authorization token" || message === "Invalid or expired session"
      ? 401
      : message === "Package is required"
      ? 400
      : message === "Credit package not found"
      ? 404
      : message.includes("inactive") || message.includes("restricted")
      ? 403
      : 500;

    return Response.json({ error: message }, { status });
  }
});
