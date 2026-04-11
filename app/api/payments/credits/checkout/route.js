import { NextResponse } from 'next/server'
import {
  createSupabaseAdminClient,
  getAuthenticatedUser,
} from '../../../../../src/server/supabaseServer.js'
import { createCharge, getPaymentCallbackUrls } from '../../../../../src/server/uddoktaPay.js'
import { createPendingPaymentTransaction } from '../../../../../src/server/paymentTransactions.js'

const buildTransactionId = () =>
  `PAY-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

const getDisplayName = (profile, authUser) => {
  if (profile?.name) return profile.name
  if (typeof authUser?.user_metadata?.name === 'string') return authUser.user_metadata.name
  if (profile?.email) return profile.email.split('@')[0]
  if (authUser?.email) return authUser.email.split('@')[0]
  return 'NewTolet User'
}

const getCreditPackageOrThrow = async (adminClient, packageId) => {
  const { data, error } = await adminClient
    .from('credit_packages')
    .select('*')
    .eq('id', packageId)
    .eq('active', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Credit package not found')
  }

  return data
}

const assertUserCanPurchaseCredits = async (adminClient, profile) => {
  if (profile?.is_active === false) {
    throw new Error('Your account is inactive. Please contact support.')
  }

  const { data, error } = await adminClient
    .from('user_blacklist')
    .select('id')
    .eq('user_id', profile.id)
    .order('blacklisted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error?.code === 'PGRST205' || error?.message?.includes('Could not find the table')) {
    return
  }

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  if (data) {
    throw new Error('Your account is restricted from purchasing credits.')
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const packageId = body?.packageId

    if (!packageId) {
      return NextResponse.json({ error: 'Package is required' }, { status: 400 })
    }

    const { authUser, profile } = await getAuthenticatedUser(request)
    const adminClient = createSupabaseAdminClient()

    await assertUserCanPurchaseCredits(adminClient, profile)

    const selectedPackage = await getCreditPackageOrThrow(adminClient, packageId)
    const price = Number(selectedPackage.price_bdt ?? 0)
    const discount = Number(selectedPackage.discount_percentage ?? 0)
    const finalAmount = Number((price - (price * discount) / 100).toFixed(2))
    const creditsToAdd = Number(selectedPackage.credits_amount ?? 0)
    const transactionId = buildTransactionId()

    const paymentTransaction = await createPendingPaymentTransaction({
      adminClient,
      userId: profile.id,
      packageId: selectedPackage.id,
      transactionId,
      amount: finalAmount,
      creditsToAdd,
      description: `${selectedPackage.package_name} credit purchase`,
    })

    try {
      const callbackUrls = getPaymentCallbackUrls()
      const gatewayResponse = await createCharge({
        full_name: getDisplayName(profile, authUser),
        email: profile.email || authUser.email,
        amount: finalAmount.toFixed(2),
        metadata: {
          user_id: profile.id,
          payment_transaction_id: paymentTransaction.id,
          transaction_id: paymentTransaction.transaction_id,
          package_id: String(selectedPackage.id),
          credits_to_add: String(creditsToAdd),
        },
        redirect_url: callbackUrls.redirectUrl,
        return_type: 'GET',
        cancel_url: callbackUrls.cancelUrl,
        webhook_url: callbackUrls.webhookUrl,
      })

      const paymentUrl =
        gatewayResponse?.payment_url ||
        gatewayResponse?.data?.payment_url ||
        gatewayResponse?.paymentUrl ||
        null

      if (!paymentUrl) {
        throw new Error('Paymently did not return a checkout URL')
      }

      return NextResponse.json({
        data: {
          paymentUrl,
          transactionId: paymentTransaction.transaction_id,
          paymentId: paymentTransaction.id,
        },
      })
    } catch (gatewayError) {
      await adminClient
        .from('payment_transactions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentTransaction.id)

      throw gatewayError
    }
  } catch (error) {
    const status =
      error.message === 'Missing authorization token' || error.message === 'Invalid or expired session'
        ? 401
        : error.message === 'Package is required'
          ? 400
          : error.message === 'Credit package not found'
            ? 404
            : error.message.includes('inactive') || error.message.includes('restricted')
              ? 403
        : 500

    return NextResponse.json(
      { error: error.message || 'Unable to start payment checkout' },
      { status }
    )
  }
}
