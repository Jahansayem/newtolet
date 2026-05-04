import { supabase } from './supabaseClient'
import { getAccessToken } from './apiClient'
import { getCreditPackages as getAdminCreditPackages } from './adminService'
import {
  buildUserPanelCacheKey,
  invalidateUserPanelCache,
  revalidateUserPanelResource,
} from './cacheService'
import { invokeSupabaseFunction } from './functionClient'
import { getUserPanelCachePolicy } from './userPanelCacheConfig'

const PAYMENT_GATEWAYS = {
  BKASH: {
    id: 'bkash',
    name: 'bKash',
    icon: '📱',
  },
  NAGAD: {
    id: 'nagad',
    name: 'Nagad',
    icon: '💳',
  },
  ROCKET: {
    id: 'rocket',
    name: 'Rocket',
    icon: '🚀',
  },
}

const STATUS_LABELS = {
  paid: 'credited',
  success: 'credited',
  created: 'pending',
}

const mapPaymentTransactionRecord = (record) => ({
  ...record,
  amount: Number(record?.amount ?? record?.amount_bdt ?? 0),
  credits_to_add: Number(record?.credits_to_add ?? 0),
  invoice_id: record?.invoice_id || record?.reference || null,
  transaction_id: record?.transaction_id || record?.invoice_id || record?.id,
  status: STATUS_LABELS[record?.status] || record?.status || 'pending',
  payment_method: record?.payment_method ? String(record.payment_method).toLowerCase() : null,
  description:
    record?.description ||
    `${Number(record?.credits_to_add ?? 0)} credits purchase`,
})

export const getCreditPackages = async () => {
  const packages = await getAdminCreditPackages()
  return packages.filter((entry) => entry.is_active !== false)
}

export const getCreditPackage = async (packageId) => {
  const packages = await getCreditPackages()
  return packages.find((entry) => entry.id === packageId)
}

export const getPaymentGateways = () => Object.values(PAYMENT_GATEWAYS)

export const createPaymentTransaction = async (packageId) => {
  try {
    const token = await getAccessToken()

    if (!token) {
      throw new Error('Authentication required')
    }

    const response = await invokeSupabaseFunction({
      functionName: 'paymently-create-checkout',
      token,
      body: {
        packageId,
      },
    })

    return {
      data: {
        id: response?.data?.paymentId || null,
        transaction_id: response?.data?.transactionId || null,
        payment_url: response?.data?.paymentUrl || null,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error creating payment transaction:', error)
    return { data: null, error }
  }
}

export const verifyPayment = async (invoiceId) => {
  try {
    const token = await getAccessToken()

    if (!token) {
      throw new Error('Authentication required')
    }

    const response = await invokeSupabaseFunction({
      functionName: 'paymently-verify',
      token,
      body: { invoiceId },
    })

    const payment = mapPaymentTransactionRecord(response?.data?.payment || {})

    if (payment?.user_id) {
      ;[
        'dashboard',
        'wallet-panel',
        'invoices',
        'credit-balance',
        'credit-history',
        'payment-history:20',
        'payment-history:100',
      ].forEach((resourceKey) =>
        invalidateUserPanelCache(buildUserPanelCacheKey(payment.user_id, resourceKey))
      )
    }

    return {
      data: {
        payment,
        verification: response?.data?.verification || null,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error verifying payment:', error)
    return { data: null, error }
  }
}

export const getPaymentHistory = async (userId, limit = 20) => {
  try {
    const cacheKey = buildUserPanelCacheKey(userId || 'guest', `payment-history:${limit}`)
    const entry = await revalidateUserPanelResource({
      cacheKey,
      policy: getUserPanelCachePolicy(`payment-history:${limit}`),
      fetcher: async () => {
        const { data, error } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) {
          throw error
        }

        return (data || []).map(mapPaymentTransactionRecord)
      },
    })

    return { data: entry?.data || [], error: null }
  } catch (error) {
    console.error('Error fetching payment history:', error)
    return { data: [], error }
  }
}

export const getPaymentGatewayUrl = async (packageId) => {
  const result = await createPaymentTransaction(packageId)
  return result?.data?.payment_url || null
}

export const completePayment = async () => ({
  data: null,
  error: new Error('completePayment is no longer used. Verify the invoice instead.'),
})

export const simulatePaymentGateway = async () => ({
  success: false,
  error: 'simulatePaymentGateway is disabled in production payment mode.',
})

export const sendSmsNotification = async () => ({ success: true, error: null })

export const sendPushNotification = async () => ({ success: true, error: null })

export const calculatePrice = async (packageId) => {
  const package_ = await getCreditPackage(packageId)

  if (!package_) {
    return null
  }

  const originalPrice = Number(package_.price || 0)
  const discountAmount = (originalPrice * Number(package_.discount || 0)) / 100
  const finalPrice = originalPrice - discountAmount

  return {
    originalPrice,
    discount: Number(package_.discount || 0),
    discountAmount,
    finalPrice,
    credits: Number(package_.credits || 0),
    pricePerCredit:
      Number(package_.credits || 0) > 0
        ? (finalPrice / Number(package_.credits)).toFixed(2)
        : '0.00',
  }
}
