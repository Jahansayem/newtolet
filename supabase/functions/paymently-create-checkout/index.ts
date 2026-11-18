import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  getAuthenticatedContext,
  getEpsCheckoutUrls,
  getPaymentErrorMessage,
} from "../_shared/paymently.ts";
import { buildMerchantTransactionId, initializeEpsPayment } from "../_shared/eps.ts";
import {
  assertUserCanPurchaseCredits,
  buildTransactionId,
  createPendingPaymentTransaction,
  getCreditPackageOrThrow,
  getDisplayName,
  getOrderHomePayableAmount,
  getPayableOrderOrThrow,
  updatePaymentTransactionById,
} from "../_shared/payment-transactions.ts";

const PROVIDER = "eps";
const ORDER_DESCRIPTION = "Order Home service charge";

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { user, profile, adminClient } = await getAuthenticatedContext(request);
    const body = await request.json().catch(() => ({}));
    const packageId = body?.packageId;
    const orderId = body?.orderId || body?.order_id;

    if (!packageId && !orderId) {
      return Response.json({ error: "Package is required" }, { status: 400 });
    }

    const transactionId = buildTransactionId();
    const customerPhone = body?.phoneNumber || body?.phone_number || profile.phone || "01700000000";

    // Inactive and blacklisted accounts cannot start any checkout.
    await assertUserCanPurchaseCredits(adminClient, profile);

    // What is being bought: an Order Home service charge, or a credit package.
    let purchase: {
      packageId: string | null;
      orderId: string | null;
      amount: number;
      creditsToAdd: number;
      description: string;
      productCategory: string;
      returnKind: string;
    };

    if (orderId && !packageId) {
      const payableAmount = await getOrderHomePayableAmount(adminClient);
      const order = await getPayableOrderOrThrow(adminClient, orderId, profile.id, payableAmount);

      purchase = {
        packageId: null,
        orderId: order.id,
        amount: payableAmount,
        creditsToAdd: 0,
        description: ORDER_DESCRIPTION,
        productCategory: "Service",
        returnKind: "order",
      };
    } else {
      const selectedPackage = await getCreditPackageOrThrow(adminClient, packageId);
      const price = Number(selectedPackage.price_bdt ?? 0);
      const discount = Number(selectedPackage.discount_percentage ?? 0);

      purchase = {
        packageId: selectedPackage.id,
        orderId: null,
        amount: Number((price - (price * discount) / 100).toFixed(2)),
        creditsToAdd: Number(selectedPackage.credits_amount ?? 0),
        description: `${selectedPackage.package_name} credit purchase`,
        productCategory: "Credits",
        returnKind: "",
      };
    }

    const finalAmount = purchase.amount;

    const paymentTransaction = await createPendingPaymentTransaction(adminClient, {
      userId: profile.id,
      packageId: purchase.packageId,
      orderId: purchase.orderId,
      transactionId,
      amount: finalAmount,
      creditsToAdd: purchase.creditsToAdd,
      description: purchase.description,
      provider: PROVIDER,
      paymentMethod: PROVIDER,
      customerPhone,
    });

    const merchantTransactionId = buildMerchantTransactionId();

    try {
      const checkoutUrls = getEpsCheckoutUrls(merchantTransactionId, purchase.returnKind);

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
        productName: purchase.description,
        productCategory: purchase.productCategory,
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
      : message === "Credit package not found" || message === "Order not found"
      ? 404
      : message === "This order is already paid or closed" || message.startsWith("Order price has changed")
      ? 409
      : message.includes("inactive") || message.includes("restricted")
      ? 403
      : 500;

    return Response.json({ error: message }, { status });
  }
});
