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

export const getSupabasePublicUrl = () =>
  trimTrailingSlash(
    getEnv("SUPABASE_PUBLIC_URL", ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]),
  );

export const getSupabaseAnonKey = () =>
  getEnv("SUPABASE_ANON_KEY", ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

export const getSupabaseServiceRoleKey = () =>
  getEnv("SUPABASE_SERVICE_ROLE_KEY");

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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Ignore serialization errors and use the fallback.
  }
  return fallback;
};

export const getPaymentErrorMessage = (error: unknown, fallback: string) =>
  getErrorMessage(error, fallback);

export const getFunctionUrl = (name: string) =>
  `${getSupabasePublicUrl()}/functions/v1/${name}`;

export const getEpsCheckoutUrls = (merchantTransactionId: string) => ({
  successUrl: `${getSiteUrl()}/payment-confirm?provider=eps&reference=${
    encodeURIComponent(merchantTransactionId)
  }`,
  failUrl: `${getSiteUrl()}/payment-confirm?provider=eps&state=failed&reference=${
    encodeURIComponent(merchantTransactionId)
  }`,
  cancelUrl: `${getSiteUrl()}/payment-confirm?provider=eps&state=cancelled&reference=${
    encodeURIComponent(merchantTransactionId)
  }`,
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
