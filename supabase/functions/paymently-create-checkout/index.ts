import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createPaymentlyCharge,
  getAuthenticatedContext,
  getCheckoutUrls,
} from "../_shared/paymently.ts";
import {
  assertUserCanPurchaseCredits,
  buildTransactionId,
  createPendingPaymentTransaction,
  getCreditPackageOrThrow,
  getDisplayName,
  updatePaymentTransactionById,
} from "../_shared/payment-transactions.ts";

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

    const paymentTransaction = await createPendingPaymentTransaction(adminClient, {
      userId: profile.id,
      packageId: selectedPackage.id,
      transactionId,
      amount: finalAmount,
      creditsToAdd,
      description: `${selectedPackage.package_name} credit purchase`,
    });

    try {
      const checkoutUrls = getCheckoutUrls();
      const gatewayResponse = await createPaymentlyCharge({
        full_name: getDisplayName(profile, user),
        email: profile.email || user.email,
        amount: finalAmount.toFixed(2),
        metadata: {
          user_id: profile.id,
          payment_transaction_id: paymentTransaction.id,
          transaction_id: paymentTransaction.transaction_id,
          package_id: String(selectedPackage.id),
          credits_to_add: String(creditsToAdd),
        },
        redirect_url: checkoutUrls.redirect_url,
        return_type: "GET",
        cancel_url: checkoutUrls.cancel_url,
        webhook_url: checkoutUrls.webhook_url,
      });

      const paymentUrl =
        gatewayResponse?.payment_url ||
        gatewayResponse?.data?.payment_url ||
        gatewayResponse?.paymentUrl ||
        null;

      if (!paymentUrl) {
        throw new Error("Paymently did not return a checkout URL");
      }

      return Response.json({
        data: {
          paymentUrl,
          transactionId: paymentTransaction.transaction_id,
          paymentId: paymentTransaction.id,
        },
      });
    } catch (error) {
      await updatePaymentTransactionById(adminClient, paymentTransaction.id, {
        status: "failed",
      }).catch(() => null);

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start payment checkout";
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
