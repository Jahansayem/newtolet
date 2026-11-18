// Public pay page -> payment-links Edge Function. The customer is not signed
// in, so every call goes out with the anon key (the default in functionClient).

import { invokeSupabaseFunction } from './functionClient'

const call = async (body) => {
  try {
    const response = await invokeSupabaseFunction({ functionName: 'payment-links', body })
    return { data: response?.data ?? null, error: null }
  } catch (error) {
    return { data: null, error: { message: error?.message || 'Request failed' } }
  }
}

/** { link, payment } for a link code; error when the code is unknown. */
export const getPaymentLink = (code) => call({ action: 'get', code })

/** Starts an EPS transaction. Returns { paymentUrl, reference }. */
export const startPaymentLinkCheckout = (code, { name = null, phone = null } = {}) =>
  call({ action: 'pay', code, name, phone })

/**
 * Asks EPS what happened and records it. With a reference: that one attempt
 * (the customer just came back). Without: the link's latest attempts.
 */
export const verifyPaymentLink = (code, reference = null) =>
  call({ action: 'verify', code, ...(reference ? { reference } : {}) })
