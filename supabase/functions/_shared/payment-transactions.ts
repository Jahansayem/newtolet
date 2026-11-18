const AUTO_APPROVAL_THRESHOLD_BDT = 3000;
const CREDITING_STATUS = "crediting";
const PAYMENT_TRANSACTION_RELATIONS = `
  *,
  buyer:users!payment_transactions_user_id_fkey(name, email),
  package:credit_packages!payment_transactions_package_id_fkey(package_name)
`;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMethod = (value: unknown) =>
  value ? String(value).trim().toLowerCase() : null;

const mapGatewayStatusToPaymentStatus = (status: string) => {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED":
      return "awaiting_admin_approval";
    case "PENDING":
      return "pending";
    case "CANCELLED":
      return "cancelled";
    case "ERROR":
      return "failed";
    default:
      return "pending";
  }
};

const mapTiwloStatusToPaymentStatus = (status: string) => {
  switch ((status || "").toLowerCase()) {
    case "paid":
    case "succeeded":
    case "success":
      return "awaiting_admin_approval";
    case "expired":
      return "cancelled";
    case "payment_failed":
    case "failed":
      return "failed";
    case "unpaid":
    default:
      return "pending";
  }
};

const mapEpsStatusToPaymentStatus = (status: string) => {
  switch ((status || "").toLowerCase()) {
    case "success":
      return "awaiting_admin_approval";
    // The sandbox reports an unpaid/abandoned transaction as "Cancel".
    case "cancel":
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "fail":
    case "failed":
    case "error":
      return "failed";
    default:
      return "pending";
  }
};

const getProviderPayload = (verificationData: any) =>
  verificationData?.data || verificationData || {};

const getProviderName = (payload: any, fallback = "uddoktapay") =>
  String(payload?.provider || fallback || "uddoktapay").toLowerCase();

const getProviderInvoiceId = (payload: any, provider: string) => {
  if (provider === "eps") {
    return payload?.merchantTransactionId || null;
  }

  return provider === "tiwlopay"
    ? payload?.invoiceId || payload?.invoice_id || null
    : payload?.invoice_id || payload?.invoiceId || null;
};

const getProviderReference = (payload: any, provider: string) => {
  if (provider === "eps") {
    return payload?.merchantTransactionId || null;
  }

  return provider === "tiwlopay"
    ? payload?.slug || payload?.id || getProviderInvoiceId(payload, provider)
    : getProviderInvoiceId(payload, provider);
};

const getProviderStatus = (payload: any) => String(payload?.status || "");

const isProviderPaid = (provider: string, status: string) => {
  if (provider === "eps") return status.toLowerCase() === "success";
  return provider === "tiwlopay"
    ? ["paid", "succeeded", "success"].includes(status.toLowerCase())
    : status.toUpperCase() === "COMPLETED";
};

const mapProviderStatusToPaymentStatus = (provider: string, status: string) => {
  if (provider === "eps") return mapEpsStatusToPaymentStatus(status);
  return provider === "tiwlopay"
    ? mapTiwloStatusToPaymentStatus(status)
    : mapGatewayStatusToPaymentStatus(status);
};

export const buildTransactionId = () =>
  `PAY-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

export const getDisplayName = (
  profile: { name?: string | null; email?: string | null },
  authUser: { user_metadata?: Record<string, unknown>; email?: string | null },
) => {
  if (profile?.name) return profile.name;
  if (typeof authUser?.user_metadata?.name === "string") {
    return authUser.user_metadata.name;
  }
  if (profile?.email) return profile.email.split("@")[0];
  if (authUser?.email) return authUser.email.split("@")[0];
  return "NewTolet User";
};

export const getCreditPackageOrThrow = async (
  adminClient: any,
  packageId: string,
) => {
  const { data, error } = await adminClient
    .from("credit_packages")
    .select("*")
    .eq("id", packageId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Credit package not found");
  return data;
};

export const assertUserCanPurchaseCredits = async (
  adminClient: any,
  profile: { id: string; is_active?: boolean | null },
) => {
  if (profile.is_active === false) {
    throw new Error("Your account is inactive. Please contact support.");
  }

  const { data: blacklistEntry, error } = await adminClient
    .from("user_blacklist")
    .select("id")
    .eq("user_id", profile.id)
    .order("blacklisted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error?.code === "PGRST205" || error?.message?.includes("Could not find the table")) {
    return;
  }

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (blacklistEntry) {
    throw new Error("Your account is restricted from purchasing credits.");
  }
};

// The Order Home price lives in the database (order_home_pricing()), so the
// amount charged can never come from the browser.
export const getOrderHomePayableAmount = async (adminClient: any) => {
  const { data, error } = await adminClient.rpc("order_home_pricing");
  if (error) throw error;

  const payable = toNumber(data?.payable_bdt, 0);
  if (payable <= 0) throw new Error("Order price is not configured");
  return payable;
};

// An order can be paid for only by its owner, only while it is unpaid, and
// only at the current server price.
export const getPayableOrderOrThrow = async (
  adminClient: any,
  orderId: string,
  userId: string,
  payableAmount: number,
) => {
  const { data: order, error } = await adminClient
    .from("orders")
    .select("id, user_id, status, cost, archived_at")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order || order.user_id !== userId || order.archived_at) {
    throw new Error("Order not found");
  }
  if (order.status !== "pending_payment") {
    throw new Error("This order is already paid or closed");
  }
  if (Math.abs(toNumber(order.cost, 0) - payableAmount) >= 0.01) {
    throw new Error("Order price has changed. Please contact support.");
  }

  // A verified payment that is still held for review also blocks a second charge.
  const { data: paidRows, error: paidError } = await adminClient
    .from("payment_transactions")
    .select("id")
    .eq("order_id", orderId)
    .in("status", ["credited", "awaiting_admin_approval", CREDITING_STATUS])
    .limit(1);

  if (paidError) throw paidError;
  if (paidRows?.length) {
    throw new Error("This order is already paid or closed");
  }

  return order;
};

const markOrderPaid = async (adminClient: any, paymentId: string) => {
  const { error } = await adminClient.rpc("mark_order_paid_from_gateway", {
    p_payment_transaction_id: paymentId,
  });

  if (error) throw error;
  return getPaymentTransactionById(adminClient, paymentId);
};

export const createPendingPaymentTransaction = async (
  adminClient: any,
  payload: {
    userId: string;
    packageId?: string | null;
    orderId?: string | null;
    transactionId: string;
    amount: number;
    creditsToAdd: number;
    description: string;
    provider?: string;
    paymentMethod?: string;
    customerPhone?: string | null;
  },
) => {
  const { data, error } = await adminClient
    .from("payment_transactions")
    .insert({
      user_id: payload.userId,
      package_id: payload.packageId || null,
      order_id: payload.orderId || null,
      transaction_id: payload.transactionId,
      amount: payload.amount,
      status: "pending",
      credits_to_add: payload.creditsToAdd,
      description: payload.description,
      provider: payload.provider || "uddoktapay",
      payment_method: normalizeMethod(payload.paymentMethod),
      customer_phone: payload.customerPhone || null,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const updatePaymentTransactionById = async (
  adminClient: any,
  paymentId: string,
  values: Record<string, unknown>,
) => {
  const { data, error } = await adminClient
    .from("payment_transactions")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .select(PAYMENT_TRANSACTION_RELATIONS)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getPaymentTransactionById = async (
  adminClient: any,
  paymentId: string,
) => {
  const { data, error } = await adminClient
    .from("payment_transactions")
    .select(PAYMENT_TRANSACTION_RELATIONS)
    .eq("id", paymentId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getPaymentTransactionForInvoice = async (
  adminClient: any,
  invoiceId: string,
) => {
  const { data, error } = await adminClient
    .from("payment_transactions")
    .select(PAYMENT_TRANSACTION_RELATIONS)
    .or(`invoice_id.eq.${invoiceId},reference.eq.${invoiceId}`)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const getPaymentTransactionFromVerification = async (
  adminClient: any,
  verificationData: any,
  provider = "uddoktapay",
) => {
  const payload = getProviderPayload(verificationData);
  const metadata = payload?.metadata || {};
  const paymentId = metadata.payment_transaction_id || metadata.payment_id || null;
  const invoiceId = getProviderInvoiceId(payload, provider);
  const reference = getProviderReference(payload, provider);

  if (paymentId) {
    const payment = await getPaymentTransactionById(adminClient, paymentId);
    if (payment) return payment;
  }

  if (invoiceId) {
    return getPaymentTransactionForInvoice(adminClient, invoiceId);
  }

  if (reference) {
    return getPaymentTransactionForInvoice(adminClient, reference);
  }

  return null;
};

const creditApprovedPayment = async (
  adminClient: any,
  paymentId: string,
  actorId: string | null,
) => {
  const { error } = await adminClient.rpc("approve_credit_payment_transaction", {
    p_payment_transaction_id: paymentId,
    p_admin_id: actorId,
  });

  if (error) throw error;
  return getPaymentTransactionById(adminClient, paymentId);
};

export const syncGatewayPayment = async (
  adminClient: any,
  verificationData: any,
  fallbackProvider = "uddoktapay",
) => {
  const payload = getProviderPayload(verificationData);
  const provider = getProviderName(payload, fallbackProvider);
  const gatewayStatus = getProviderStatus(payload);
  const invoiceId = getProviderInvoiceId(payload, provider);
  const reference = getProviderReference(payload, provider);
  const payment = await getPaymentTransactionFromVerification(
    adminClient,
    verificationData,
    provider,
  );

  if (!payment) {
    throw new Error("Payment transaction not found for this invoice");
  }

  // Gateways report 0 for pending/failed transactions; never overwrite the
  // stored amount with that, and only auto-credit when the paid amount matches.
  const storedAmount = toNumber(payment.amount, 0);
  const gatewayAmount = toNumber(
    provider === "eps" ? payload?.totalAmount : payload?.amount,
    0,
  );
  const verifiedAmount = gatewayAmount > 0 ? gatewayAmount : storedAmount;
  const amountMatches = Math.abs(verifiedAmount - storedAmount) < 0.01;
  const nextStatus = mapProviderStatusToPaymentStatus(provider, gatewayStatus);
  const sharedUpdate = {
    amount: verifiedAmount,
    invoice_id: invoiceId || payment.invoice_id || null,
    reference: reference || invoiceId || payment.reference || null,
    payment_method: normalizeMethod(payload?.payment_method) || payment.payment_method,
    sender_number: payload?.sender_number || null,
    gateway_payload: verificationData,
    provider,
  };

  if (payment.status === "credited") {
    return updatePaymentTransactionById(adminClient, payment.id, sharedUpdate);
  }

  if (payment.status === CREDITING_STATUS) {
    return getPaymentTransactionById(adminClient, payment.id);
  }

  if (isProviderPaid(provider, gatewayStatus)) {
    const syncedPayment = await updatePaymentTransactionById(adminClient, payment.id, {
      ...sharedUpdate,
      status: "awaiting_admin_approval",
    });

    // Order payment: no credits. A matching amount marks the order paid; any
    // other amount stays in awaiting_admin_approval for a human to decide.
    if (syncedPayment.order_id) {
      if (!amountMatches) {
        return syncedPayment;
      }

      try {
        return await markOrderPaid(adminClient, syncedPayment.id);
      } catch (error) {
        console.error("[payment-transactions] marking the order paid failed", {
          paymentId: syncedPayment.id,
          orderId: syncedPayment.order_id,
          message: error instanceof Error ? error.message : String(error),
        });
        return syncedPayment;
      }
    }

    if (verifiedAmount > AUTO_APPROVAL_THRESHOLD_BDT || !amountMatches) {
      return syncedPayment;
    }

    try {
      return await creditApprovedPayment(adminClient, syncedPayment.id, null);
    } catch (error) {
      // Leave the payment in awaiting_admin_approval so an admin can credit it
      // manually instead of failing the whole verification.
      console.error("[payment-transactions] auto-credit failed", {
        paymentId: syncedPayment.id,
        message: error instanceof Error ? error.message : String(error),
      });
      return syncedPayment;
    }
  }

  return updatePaymentTransactionById(adminClient, payment.id, {
    ...sharedUpdate,
    status: nextStatus,
  });
};
