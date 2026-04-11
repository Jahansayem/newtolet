import { createClient } from "jsr:@supabase/supabase-js@2";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getEnv = (
  name: string,
  fallbackNames: string[] = [],
  fallbackValue?: string,
) => {
  const value = [name, ...fallbackNames]
    .map((key) => Deno.env.get(key)?.trim())
    .find((entry) => typeof entry === "string" && entry.length > 0);

  if (value) return value;
  if (typeof fallbackValue !== "undefined") return fallbackValue;
  throw new Error(`Missing required environment variable: ${name}`);
};

export const getSupabaseUrl = () =>
  trimTrailingSlash(
    getEnv("SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL"]),
  );

export const getSupabaseAnonKey = () =>
  getEnv("SUPABASE_ANON_KEY", ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

export const getSupabaseServiceRoleKey = () =>
  getEnv("SUPABASE_SERVICE_ROLE_KEY");

export const getPaymentlyBaseUrl = () =>
  trimTrailingSlash(
    getEnv("UDDOKTAPAY_BASE_URL", [], "https://newtoletbd.paymently.io/api"),
  );

export const getPaymentlyApiKey = () => getEnv("UDDOKTAPAY_API_KEY");

export const getSiteUrl = () =>
  trimTrailingSlash(
    getEnv(
      "NEXT_PUBLIC_SITE_URL",
      ["SITE_URL"],
      "http://localhost:3000",
    ),
  );

export const createAdminClient = () =>
  createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

export const createUserClient = (token: string) =>
  createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

const createPaymentlyHeaders = () => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  "RT-UDDOKTAPAY-API-KEY": getPaymentlyApiKey(),
});

const parsePaymentlyResponse = async (response: Response) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        `Paymently request failed with status ${response.status}`,
    );
  }

  return payload;
};

export const createPaymentlyCharge = async (payload: Record<string, unknown>) => {
  const response = await fetch(`${getPaymentlyBaseUrl()}/checkout-v2`, {
    method: "POST",
    headers: createPaymentlyHeaders(),
    body: JSON.stringify(payload),
  });

  return parsePaymentlyResponse(response);
};

export const verifyPaymentlyPayment = async (invoiceId: string) => {
  const response = await fetch(`${getPaymentlyBaseUrl()}/verify-payment`, {
    method: "POST",
    headers: createPaymentlyHeaders(),
    body: JSON.stringify({ invoice_id: invoiceId }),
  });

  return parsePaymentlyResponse(response);
};

export const getFunctionUrl = (name: string) =>
  `${getSupabaseUrl()}/functions/v1/${name}`;

export const getCheckoutUrls = () => ({
  redirect_url: `${getSiteUrl()}/payment-confirm`,
  cancel_url: `${getSiteUrl()}/payment-confirm?state=cancelled`,
  webhook_url: getFunctionUrl("paymently-webhook"),
});

export const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new Error("Missing authorization token");
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    throw new Error("Missing authorization token");
  }

  return token;
};

export const getAuthenticatedContext = async (request: Request) => {
  const token = getBearerToken(request);
  const userClient = createUserClient(token);
  const adminClient = createAdminClient();

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    throw new Error("Invalid or expired session");
  }

  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .select("id, name, email, phone, is_admin, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw new Error("User profile not found");
  }

  return { token, user, profile, adminClient };
};

export const validateWebhookRequest = (request: Request) =>
  request.headers.get("RT-UDDOKTAPAY-API-KEY") === getPaymentlyApiKey();
