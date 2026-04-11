const AUTO_APPROVAL_THRESHOLD_BDT = 3000;
const CREDITING_STATUS = "crediting";

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

export const createPendingPaymentTransaction = async (
  adminClient: any,
  payload: {
    userId: string;
    packageId: string;
    transactionId: string;
    amount: number;
    creditsToAdd: number;
    description: string;
  },
) => {
  const { data, error } = await adminClient
    .from("payment_transactions")
    .insert({
      user_id: payload.userId,
      package_id: payload.packageId,
      transaction_id: payload.transactionId,
      amount: payload.amount,
      status: "pending",
      credits_to_add: payload.creditsToAdd,
      description: payload.description,
      provider: "uddoktapay",
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
    .select("*, users(name, email), credit_packages(package_name)")
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
    .select("*, users(name, email), credit_packages(package_name)")
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
    .select("*, users(name, email), credit_packages(package_name)")
    .or(`invoice_id.eq.${invoiceId},reference.eq.${invoiceId}`)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const getPaymentTransactionFromVerification = async (
  adminClient: any,
  verificationData: any,
) => {
  const payload = verificationData?.data || verificationData || {};
  const metadata = payload?.metadata || {};
  const paymentId = metadata.payment_transaction_id || metadata.payment_id || null;
  const invoiceId = payload?.invoice_id || null;

  if (paymentId) {
    const payment = await getPaymentTransactionById(adminClient, paymentId);
    if (payment) return payment;
  }

  if (invoiceId) {
    return getPaymentTransactionForInvoice(adminClient, invoiceId);
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
) => {
  const payload = verificationData?.data || verificationData || {};
  const gatewayStatus = String(payload?.status || "").toUpperCase();
  const invoiceId = payload?.invoice_id || null;
  const payment = await getPaymentTransactionFromVerification(
    adminClient,
    verificationData,
  );

  if (!payment) {
    throw new Error("Payment transaction not found for this invoice");
  }

  const verifiedAmount = toNumber(payload?.amount, payment.amount ?? 0);
  const sharedUpdate = {
    amount: verifiedAmount,
    invoice_id: invoiceId || payment.invoice_id || null,
    reference: invoiceId || payment.reference || null,
    payment_method: normalizeMethod(payload?.payment_method) || payment.payment_method,
    sender_number: payload?.sender_number || null,
    gateway_payload: verificationData,
    provider: "uddoktapay",
  };

  if (payment.status === "credited") {
    return updatePaymentTransactionById(adminClient, payment.id, sharedUpdate);
  }

  if (payment.status === CREDITING_STATUS) {
    return getPaymentTransactionById(adminClient, payment.id);
  }

  if (gatewayStatus === "COMPLETED") {
    const syncedPayment = await updatePaymentTransactionById(adminClient, payment.id, {
      ...sharedUpdate,
      status: "awaiting_admin_approval",
    });

    if (verifiedAmount > AUTO_APPROVAL_THRESHOLD_BDT) {
      return syncedPayment;
    }

    return creditApprovedPayment(adminClient, syncedPayment.id, null);
  }

  return updatePaymentTransactionById(adminClient, payment.id, {
    ...sharedUpdate,
    status: mapGatewayStatusToPaymentStatus(gatewayStatus),
  });
};
