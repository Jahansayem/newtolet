const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const EPS_TIMEOUT_MS = 15_000;
const EPS_TOKEN_SAFETY_MARGIN_MS = 30_000;

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

export const getEpsBaseUrl = () =>
  trimTrailingSlash(
    getEnv("EPS_BASE_URL", [], "https://sandboxpgapi.eps.com.bd"),
  );

export const getEpsMerchantId = () => getEnv("EPS_MERCHANT_ID");
export const getEpsStoreId = () => getEnv("EPS_STORE_ID");
export const getEpsUserName = () => getEnv("EPS_USERNAME");
export const getEpsPassword = () => getEnv("EPS_PASSWORD");
export const getEpsHashKey = () => getEnv("EPS_HASH_KEY");

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`EPS request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

// EPS hash mechanism: HMAC-SHA512(hashKey, value) -> Base64.
const buildEpsHash = async (value: string) => {
  const hashKey = getEpsHashKey();
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(hashKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(value),
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

const parseEpsResponse = async (response: Response) => {
  const rawBody = await response.text().catch(() => "");
  let payload: Record<string, unknown> | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(
      (payload?.errorMessage as string) ||
        (payload?.ErrorMessage as string) ||
        (payload?.message as string) ||
        rawBody ||
        `EPS request failed with status ${response.status}`,
    );
  }

  const errorMessage = (payload?.errorMessage || payload?.ErrorMessage) as
    | string
    | null
    | undefined;

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return payload;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

const requestEpsToken = async () => {
  const userName = getEpsUserName();
  const xHash = await buildEpsHash(userName);

  const response = await fetchWithTimeout(
    `${getEpsBaseUrl()}/v1/Auth/GetToken`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-hash": xHash,
      },
      body: JSON.stringify({
        userName,
        password: getEpsPassword(),
      }),
    },
    EPS_TIMEOUT_MS,
  );

  const payload = await parseEpsResponse(response);
  const token = payload?.token as string | undefined;

  if (!token) {
    throw new Error("EPS did not return an auth token");
  }

  const expireDate = payload?.expireDate
    ? new Date(payload.expireDate as string).getTime()
    : Date.now() + 5 * 60_000;

  cachedToken = {
    token,
    expiresAt: expireDate - EPS_TOKEN_SAFETY_MARGIN_MS,
  };

  return token;
};

export const getEpsToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  return requestEpsToken();
};

export const initializeEpsPayment = async (payload: {
  merchantTransactionId: string;
  customerOrderId: string;
  totalAmount: number;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  productName: string;
  ipAddress?: string;
}) => {
  const token = await getEpsToken();
  const xHash = await buildEpsHash(payload.merchantTransactionId);

  const response = await fetchWithTimeout(
    `${getEpsBaseUrl()}/v1/EPSEngine/InitializeEPS`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-hash": xHash,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storeId: getEpsStoreId(),
        CustomerOrderId: payload.customerOrderId,
        merchantTransactionId: payload.merchantTransactionId,
        transactionTypeId: 1,
        financialEntityId: 0,
        transitionStatusId: 0,
        totalAmount: payload.totalAmount,
        ipAddress: payload.ipAddress || "127.0.0.1",
        version: "1",
        successUrl: payload.successUrl,
        failUrl: payload.failUrl,
        cancelUrl: payload.cancelUrl,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        CustomerAddress: "N/A",
        CustomerCity: "Dhaka",
        CustomerState: "Dhaka",
        CustomerPostcode: "1000",
        CustomerCountry: "BD",
        CustomerPhone: payload.customerPhone,
        ShippingMethod: "NO",
        NoOfItem: "1",
        ProductName: payload.productName,
        ProductProfile: "general",
        ProductCategory: "Credits",
      }),
    },
    EPS_TIMEOUT_MS,
  );

  const result = await parseEpsResponse(response);

  return {
    transactionId: (result?.TransactionId as string) || null,
    redirectUrl: (result?.RedirectURL as string) || null,
  };
};

export const checkEpsTransactionStatus = async (
  merchantTransactionId: string,
) => {
  const token = await getEpsToken();
  const xHash = await buildEpsHash(merchantTransactionId);

  const response = await fetchWithTimeout(
    `${getEpsBaseUrl()}/v1/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=${
      encodeURIComponent(merchantTransactionId)
    }`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-hash": xHash,
        Authorization: `Bearer ${token}`,
      },
    },
    EPS_TIMEOUT_MS,
  );

  const result = await parseEpsResponse(response);

  return {
    merchantTransactionId:
      (result?.MerchantTransactionId as string) || merchantTransactionId,
    epsTransactionId: (result?.EpsTransactionId as string) || null,
    status: (result?.Status as string) || "",
    totalAmount: (result?.TotalAmount as string) || "0",
    transactionDate: (result?.TransactionDate as string) || null,
    transactionType: (result?.TransactionType as string) || null,
    financialEntity: (result?.FinancialEntity as string) || null,
    errorCode: (result?.ErrorCode as string) || null,
    errorMessage: (result?.ErrorMessage as string) || null,
  };
};
