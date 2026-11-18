import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createAdminClient, getPaymentErrorMessage, getSiteUrl } from "../_shared/paymently.ts";
import {
  buildMerchantTransactionId,
  checkEpsTransactionStatus,
  initializeEpsPayment,
} from "../_shared/eps.ts";
import {
  buildTransactionId,
  createPendingPaymentTransaction,
  syncGatewayPayment,
  updatePaymentTransactionById,
} from "../_shared/payment-transactions.ts";
import {
  buildPayReturnUrls,
  cleanCustomerName,
  FALLBACK_CUSTOMER_EMAIL,
  getPayBlocker,
  isEpsReference,
  MAX_ATTEMPTS_PER_HOUR,
  normalizeBdPhone,
  normalizeLinkCode,
  SETTLED_PAYMENT_STATUSES,
  toPublicLink,
  toPublicPayment,
} from "../_shared/paymentLinks.js";

// Payment links are paid by customers who are not signed in, so every action
// here is public. The link code is the only credential: it is random, 10
// characters, and the responses carry nothing private (see toPublicLink).
// Creating and cancelling links is done by admins through database RPCs.

const PROVIDER = "eps";
const LINK_COLUMNS =
  "id, code, amount_bdt, purpose, customer_name, customer_phone, customer_email, status, paid_at, paid_payment_id";
const PAYMENT_COLUMNS = "id, status, amount, reference, gateway_payload, credited_at, created_at";
// How many recent attempts a "check payment" call asks EPS about.
const MAX_ATTEMPTS_TO_CHECK = 3;

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const getLinkOrThrow = async (adminClient: any, rawCode: unknown) => {
  const code = normalizeLinkCode(rawCode);
  if (!code) throw new HttpError(404, "Payment link not found");

  const { data, error } = await adminClient
    .from("payment_links")
    .select(LINK_COLUMNS)
    .eq("code", code)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new HttpError(404, "Payment link not found");
  return data;
};

const getPaidPayment = async (adminClient: any, link: any) => {
  if (!link.paid_payment_id) return null;

  const { data, error } = await adminClient
    .from("payment_transactions")
    .select(PAYMENT_COLUMNS)
    .eq("id", link.paid_payment_id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F.:]{3,45}$/.test(ip) ? ip : undefined;
};

const handleGet = async (adminClient: any, body: any) => {
  const link = await getLinkOrThrow(adminClient, body?.code);
  const payment = await getPaidPayment(adminClient, link);
  return { link: toPublicLink(link), payment: toPublicPayment(payment) };
};

const handlePay = async (adminClient: any, body: any, request: Request) => {
  const link = await getLinkOrThrow(adminClient, body?.code);

  const { count: settled, error: settledError } = await adminClient
    .from("payment_transactions")
    .select("id", { count: "exact", head: true })
    .eq("payment_link_id", link.id)
    .in("status", SETTLED_PAYMENT_STATUSES);
  if (settledError) throw settledError;

  const blocker = getPayBlocker(link, settled || 0);
  if (blocker) throw new HttpError(blocker.status, blocker.message);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent, error: recentError } = await adminClient
    .from("payment_transactions")
    .select("id", { count: "exact", head: true })
    .eq("payment_link_id", link.id)
    .gte("created_at", hourAgo);
  if (recentError) throw recentError;
  if ((recent || 0) >= MAX_ATTEMPTS_PER_HOUR) {
    throw new HttpError(429, "Too many payment attempts. Please try again later.");
  }

  const customerName = link.customer_name || cleanCustomerName(body?.name);
  if (!customerName) throw new HttpError(400, "Please enter your name");

  const customerPhone = link.customer_phone || normalizeBdPhone(body?.phone);
  if (!customerPhone) throw new HttpError(400, "Please enter a valid mobile number");

  // Keep what the customer typed so the admin can see who paid.
  if (!link.customer_name || !link.customer_phone) {
    const { error: updateError } = await adminClient
      .from("payment_links")
      .update({ customer_name: customerName, customer_phone: customerPhone })
      .eq("id", link.id)
      .eq("status", "ACTIVE");
    if (updateError) throw updateError;
  }

  const paymentTransaction = await createPendingPaymentTransaction(adminClient, {
    userId: null,
    paymentLinkId: link.id,
    transactionId: buildTransactionId(),
    amount: Number(link.amount_bdt),
    creditsToAdd: 0,
    // No link code here: paymently-verify can show a payment's description.
    description: link.purpose,
    provider: PROVIDER,
    paymentMethod: PROVIDER,
    customerPhone,
  });

  const merchantTransactionId = buildMerchantTransactionId();

  try {
    const urls = buildPayReturnUrls(getSiteUrl(), link.code, merchantTransactionId);

    console.info("[payment-links] starting EPS checkout", {
      paymentId: paymentTransaction.id,
      linkId: link.id,
      merchantTransactionId,
      amount: link.amount_bdt,
    });

    const gatewayResponse = await initializeEpsPayment({
      merchantTransactionId,
      customerOrderId: paymentTransaction.transaction_id,
      totalAmount: Number(link.amount_bdt),
      successUrl: urls.successUrl,
      failUrl: urls.failUrl,
      cancelUrl: urls.cancelUrl,
      customerName,
      // EPS marks customerEmail as mandatory; most links have no email.
      customerEmail: link.customer_email || FALLBACK_CUSTOMER_EMAIL,
      customerPhone,
      productName: link.purpose,
      productCategory: "Service",
      ipAddress: getClientIp(request),
    });

    if (!gatewayResponse.redirectUrl) {
      throw new Error("EPS did not return a checkout URL");
    }

    await updatePaymentTransactionById(adminClient, paymentTransaction.id, {
      reference: merchantTransactionId,
      gateway_payload: gatewayResponse,
      provider: PROVIDER,
      payment_method: PROVIDER,
    });

    return { paymentUrl: gatewayResponse.redirectUrl, reference: merchantTransactionId };
  } catch (error) {
    const message = getPaymentErrorMessage(error, "Unable to start the payment");
    console.error("[payment-links] checkout creation failed", {
      paymentId: paymentTransaction.id,
      message,
    });

    await updatePaymentTransactionById(adminClient, paymentTransaction.id, {
      status: "failed",
      gateway_payload: { error: message, provider: PROVIDER, failed_at: new Date().toISOString() },
    }).catch(() => null);

    throw new HttpError(502, "The payment gateway could not start the payment. Please try again.");
  }
};

// Asks EPS what happened to a payment attempt and records it. EPS has no
// webhook, so this is the only way a payment is ever marked paid: the pay page
// calls it when the customer returns, and the admin "Check payment" button
// calls it (without a reference) for customers who closed the browser early.
const handleVerify = async (adminClient: any, body: any) => {
  const link = await getLinkOrThrow(adminClient, body?.code);
  const reference = body?.reference ? String(body.reference).trim() : "";

  let attempts: any[] = [];

  if (reference) {
    if (!isEpsReference(reference)) throw new HttpError(400, "Payment reference is not valid");

    const { data, error } = await adminClient
      .from("payment_transactions")
      .select(PAYMENT_COLUMNS)
      .eq("payment_link_id", link.id)
      .eq("reference", reference)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "Payment not found for this link");
    attempts = [data];
  } else {
    const { data, error } = await adminClient
      .from("payment_transactions")
      .select(PAYMENT_COLUMNS)
      .eq("payment_link_id", link.id)
      .not("reference", "is", null)
      .neq("status", "credited")
      .order("created_at", { ascending: false })
      .limit(MAX_ATTEMPTS_TO_CHECK);
    if (error) throw error;
    attempts = data || [];
  }

  let lastPayment: any = null;

  for (const attempt of attempts) {
    try {
      const statusResult = await checkEpsTransactionStatus(attempt.reference);
      const synced = await syncGatewayPayment(
        adminClient,
        { ...statusResult, provider: PROVIDER, payment_method: PROVIDER },
        PROVIDER,
      );
      if (!lastPayment || synced?.status === "credited") lastPayment = synced;
    } catch (error) {
      // With a reference the caller is waiting on this exact payment.
      if (reference) throw error;
      console.error("[payment-links] status check failed", {
        paymentId: attempt.id,
        message: getPaymentErrorMessage(error, "status check failed"),
      });
    }
  }

  const freshLink = await getLinkOrThrow(adminClient, link.code);
  const paidPayment = await getPaidPayment(adminClient, freshLink);

  return {
    link: toPublicLink(freshLink),
    payment: toPublicPayment(paidPayment || lastPayment),
    checked: attempts.length,
  };
};

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "get").toLowerCase();
    const adminClient = createAdminClient();

    if (action === "get") return Response.json({ data: await handleGet(adminClient, body) });
    if (action === "pay") return Response.json({ data: await handlePay(adminClient, body, request) });
    if (action === "verify") return Response.json({ data: await handleVerify(adminClient, body) });

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    const message = getPaymentErrorMessage(error, "Payment link request failed");
    console.error("[payment-links] request failed", { message });
    // Internal details (database, gateway) stay in the logs.
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
});
