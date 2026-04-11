const getEnv = (name, fallbackNames = [], fallbackValue = null) => {
  const value = [name, ...fallbackNames]
    .map((key) => process.env[key])
    .find((entry) => typeof entry === 'string' && entry.trim().length > 0)

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  if (fallbackValue !== null) {
    return fallbackValue
  }

  throw new Error(`Missing required environment variable: ${name}`)
}

const trimTrailingSlash = (value) => value.replace(/\/+$/, '')

const getUddoktaPayConfig = () => ({
  baseUrl: trimTrailingSlash(
    getEnv('UDDOKTAPAY_BASE_URL', [], 'https://newtoletbd.paymently.io/api')
  ),
  apiKey: getEnv('UDDOKTAPAY_API_KEY'),
})

export const getSiteUrl = () =>
  trimTrailingSlash(
    getEnv('NEXT_PUBLIC_SITE_URL', [], getEnv('NEXT_PUBLIC_API_URL', [], 'http://localhost:3000'))
  )

const createHeaders = () => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'RT-UDDOKTAPAY-API-KEY': getUddoktaPayConfig().apiKey,
})

const parseGatewayResponse = async (response) => {
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `UddoktaPay request failed with status ${response.status}`

    throw new Error(message)
  }

  return payload
}

export const getPaymentCallbackUrls = () => {
  const siteUrl = getSiteUrl()

  return {
    redirectUrl: `${siteUrl}/payment-confirm`,
    cancelUrl: `${siteUrl}/payment-confirm?state=cancelled`,
    webhookUrl: `${siteUrl}/api/payments/credits/webhook`,
  }
}

export const createCharge = async (payload) => {
  const { baseUrl } = getUddoktaPayConfig()

  const response = await fetch(`${baseUrl}/checkout-v2`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  return parseGatewayResponse(response)
}

export const verifyInvoice = async (invoiceId) => {
  const { baseUrl } = getUddoktaPayConfig()

  const response = await fetch(`${baseUrl}/verify-payment`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ invoice_id: invoiceId }),
    cache: 'no-store',
  })

  return parseGatewayResponse(response)
}

export const mapGatewayStatusToPaymentStatus = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'COMPLETED':
      return 'awaiting_admin_approval'
    case 'PENDING':
      return 'pending'
    case 'CANCELLED':
      return 'cancelled'
    case 'ERROR':
      return 'failed'
    default:
      return 'pending'
  }
}

export const validateWebhookRequest = (request) => {
  try {
    const headerValue = request.headers.get('RT-UDDOKTAPAY-API-KEY')
    return headerValue === getUddoktaPayConfig().apiKey
  } catch {
    return false
  }
}
