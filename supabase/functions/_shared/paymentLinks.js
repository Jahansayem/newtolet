// Pure helpers for the payment-links Edge Function. Plain JavaScript with no
// Deno APIs so the Node test runner can import this file directly.

const CODE_PATTERN = /^[A-Z2-9]{10}$/;
const REFERENCE_PATTERN = /^\d{10,30}$/;
const BD_PHONE_PATTERN = /^01[3-9]\d{8}$/;

export const PAY_PAGE_PATH = "/pay/";
export const MAX_ATTEMPTS_PER_HOUR = 10;
export const FALLBACK_CUSTOMER_EMAIL = "support@newtolet.com";

// Payment rows in these states mean money has (or may have) arrived.
export const SETTLED_PAYMENT_STATUSES = ["credited", "awaiting_admin_approval", "crediting"];

export const normalizeLinkCode = (value) => {
  const code = String(value ?? "").trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
};

// EPS merchant transaction ids are digit strings. Checking the shape before a
// lookup also keeps an unauthenticated value out of any filter expression.
export const isEpsReference = (value) => REFERENCE_PATTERN.test(String(value ?? ""));

export const normalizeBdPhone = (value) => {
  const digits = String(value ?? "").replace(/[\s\-()]/g, "").replace(/^\+?88/, "");
  return BD_PHONE_PATTERN.test(digits) ? digits : null;
};

export const cleanCustomerName = (value) => {
  const name = String(value ?? "").replace(/\s+/g, " ").trim();
  return name.length >= 2 && name.length <= 80 ? name : null;
};

const firstName = (value) => {
  const name = String(value ?? "").trim();
  return name ? name.split(/\s+/)[0] : null;
};

// What the customer's browser may see. No phone, email, internal note, ids or
// admin names: anyone who has the link can call this.
export const toPublicLink = (link) => ({
  code: link.code,
  amount_bdt: Number(link.amount_bdt),
  purpose: link.purpose,
  customer_first_name: firstName(link.customer_name),
  needs_name: !link.customer_name,
  needs_phone: !link.customer_phone,
  status: link.status,
  paid_at: link.paid_at || null,
});

export const toPublicPayment = (payment) =>
  payment
    ? {
        status: payment.status || "pending",
        amount: Number(payment.amount || 0),
        reference: payment.reference || null,
        eps_transaction_id: payment.gateway_payload?.epsTransactionId || null,
        method: payment.gateway_payload?.financialEntity || null,
        paid_at: payment.credited_at || null,
      }
    : null;

export const buildPayReturnUrls = (siteUrl, code, reference) => {
  const base = `${String(siteUrl).replace(/\/+$/, "")}${PAY_PAGE_PATH}?c=${encodeURIComponent(code)}`;
  const ref = `&reference=${encodeURIComponent(reference)}`;

  return {
    successUrl: `${base}${ref}`,
    failUrl: `${base}&state=failed${ref}`,
    cancelUrl: `${base}&state=cancelled${ref}`,
  };
};

// Why a link cannot be paid right now, or null when it can.
export const getPayBlocker = (link, settledPayments = 0) => {
  if (!link) return { status: 404, message: "Payment link not found" };
  if (link.status === "PAID") return { status: 409, message: "This payment link is already paid" };
  if (link.status === "CANCELLED") return { status: 409, message: "This payment link is no longer active" };
  if (settledPayments > 0) {
    return { status: 409, message: "A payment for this link is already being verified" };
  }
  return null;
};
