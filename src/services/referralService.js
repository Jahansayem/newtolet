import { supabase } from './supabaseClient'
import {
  buildUserPanelCacheKey,
  invalidateUserPanelCache,
  revalidateUserPanelResource,
} from './cacheService'
import { getUserPanelCachePolicy } from './userPanelCacheConfig'

export const DEFAULT_REFERRAL_SETTINGS = Object.freeze({
  referral_enabled: true,
  referral_commission_type: 'percentage',
  referral_commission_value: 20,
  referral_bonus_percent: 20,
  referral_bonus_frequency: 'every_purchase',
  min_withdrawal_amount: 100,
})

const USERNAME_MIN_LENGTH = 4
const USERNAME_MAX_LENGTH = 24

const getUserCacheKey = (userId, resourceKey) =>
  buildUserPanelCacheKey(userId || 'guest', resourceKey)

const isMissingResourceError = (error) =>
  error?.code === 'PGRST205' ||
  error?.code === 'PGRST202' ||
  error?.code === '42883' ||
  error?.message?.includes('Could not find the table') ||
  error?.message?.includes('Could not find the function') ||
  error?.message?.includes('does not exist')

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const slugifyReferralUsername = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, USERNAME_MAX_LENGTH)

export const validateReferralUsername = (value = '') => {
  const normalized = slugifyReferralUsername(value)

  if (!normalized) {
    return {
      valid: false,
      normalized,
      error: 'Referral username is required.',
    }
  }

  if (normalized.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `Referral username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    }
  }

  if (normalized.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `Referral username must be at most ${USERNAME_MAX_LENGTH} characters.`,
    }
  }

  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Use only lowercase letters, numbers, and underscores.',
    }
  }

  return {
    valid: true,
    normalized,
    error: null,
  }
}

const normalizeSettingsRecord = (record = {}) => ({
  ...DEFAULT_REFERRAL_SETTINGS,
  referral_enabled: record.referral_enabled ?? DEFAULT_REFERRAL_SETTINGS.referral_enabled,
  referral_commission_type:
    record.referral_commission_type || DEFAULT_REFERRAL_SETTINGS.referral_commission_type,
  referral_commission_value: toNumber(
    record.referral_commission_value,
    DEFAULT_REFERRAL_SETTINGS.referral_commission_value
  ),
  referral_bonus_percent: toNumber(
    record.referral_bonus_percent,
    DEFAULT_REFERRAL_SETTINGS.referral_bonus_percent
  ),
  referral_bonus_frequency:
    record.referral_bonus_frequency || DEFAULT_REFERRAL_SETTINGS.referral_bonus_frequency,
  min_withdrawal_amount: toNumber(
    record.min_withdrawal_amount,
    DEFAULT_REFERRAL_SETTINGS.min_withdrawal_amount
  ),
})

const normalizeCandidateRecord = (record) => {
  if (!record) {
    return null
  }

  return {
    id: record.id,
    name: record.name || 'Unknown User',
    email: record.email || '',
    phone: record.phone || '',
    referral_username: record.referral_username || '',
    referral_code: record.referral_code || '',
  }
}

const normalizeWalletRecord = (record) => ({
  id: record.id,
  user_id: record.user_id,
  banking_type: record.banking_type || '',
  bank_name: record.bank_name || '',
  account_number: record.account_number || '',
  account_name: record.account_name || '',
  is_default: Boolean(record.is_default),
  is_active: record.is_active !== false,
  created_at: record.created_at || null,
  updated_at: record.updated_at || null,
})

const normalizeEarningRecord = (record) => ({
  id: record.id,
  referrer_user_id: record.referrer_user_id,
  referred_user_id: record.referred_user_id,
  credit_topup_id: record.credit_topup_id || null,
  purchase_amount_bdt: toNumber(record.purchase_amount_bdt),
  commission_amount: toNumber(record.commission_amount),
  commission_mode: record.commission_mode || 'percentage',
  commission_value: toNumber(record.commission_value),
  bonus_percent: toNumber(record.bonus_percent),
  bonus_credits_awarded: toNumber(record.bonus_credits_awarded),
  status: record.status || 'available',
  created_at: record.created_at || null,
  referred_user: record.referred_user || null,
})

const normalizeWithdrawalRecord = (record) => ({
  id: record.id,
  user_id: record.user_id,
  wallet_id: record.wallet_id,
  amount: toNumber(record.amount),
  status: record.status || 'requested',
  admin_note: record.admin_note || '',
  requested_at: record.requested_at || record.created_at || null,
  completed_at: record.completed_at || null,
  created_at: record.created_at || null,
  updated_at: record.updated_at || null,
  wallet: record.wallet || null,
  user: record.user || null,
})

const getSiteSettingsRow = async () => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || {}
}

export const getReferralSettings = async () => {
  try {
    const entry = await revalidateUserPanelResource({
      cacheKey: getUserCacheKey('global', 'referral-settings'),
      policy: getUserPanelCachePolicy('referral-settings'),
      fetcher: async () => {
        const settings = await getSiteSettingsRow()
        return normalizeSettingsRecord(settings)
      },
    })

    return entry?.data || { ...DEFAULT_REFERRAL_SETTINGS }
  } catch (error) {
    console.error('Error getting referral settings:', error)
    return { ...DEFAULT_REFERRAL_SETTINGS }
  }
}

export const getPublicReferralCandidate = async (referralInput) => {
  const rawInput = String(referralInput || '').trim()

  if (!rawInput) {
    return { data: null, error: null }
  }

  try {
    const { data, error } = await supabase.rpc('get_referral_candidate', {
      p_referral_input: rawInput,
    })

    if (error) {
      throw error
    }

    const candidate = Array.isArray(data) ? data[0] : data
    return { data: normalizeCandidateRecord(candidate), error: null }
  } catch (error) {
    if (!isMissingResourceError(error)) {
      console.error('Error resolving referral candidate:', error)
    }

    try {
      const normalizedUsername = slugifyReferralUsername(rawInput)
      const upperCode = rawInput.toUpperCase()

      let result = null

      if (normalizedUsername) {
        const { data } = await supabase
          .from('users')
          .select('id, name, email, phone, referral_username, referral_code')
          .eq('referral_username', normalizedUsername)
          .limit(1)
          .maybeSingle()

        result = data || null
      }

      if (!result && upperCode.startsWith('REF')) {
        const { data } = await supabase
          .from('users')
          .select('id, name, email, phone, referral_username, referral_code')
          .eq('referral_code', upperCode)
          .limit(1)
          .maybeSingle()

        result = data || null
      }

      return { data: normalizeCandidateRecord(result), error: null }
    } catch (fallbackError) {
      console.error('Fallback referral candidate lookup failed:', fallbackError)
      return { data: null, error: fallbackError }
    }
  }
}

export const claimReferralUsername = async (username) => {
  const validation = validateReferralUsername(username)

  if (!validation.valid) {
    return { data: null, error: new Error(validation.error) }
  }

  try {
    const { data, error } = await supabase.rpc('claim_referral_username', {
      p_username: validation.normalized,
    })

    if (error) {
      throw error
    }

    const updated = Array.isArray(data) ? data[0] : data
    if (updated?.id) {
      invalidateUserPanelCache(getUserCacheKey(updated.id, 'referral-summary'))
      invalidateUserPanelCache(getUserCacheKey(updated.id, 'referral-summary-full'))
      invalidateUserPanelCache(getUserCacheKey(updated.id, 'dashboard'))
    }

    return { data: updated, error: null }
  } catch (error) {
    if (!isMissingResourceError(error)) {
      console.error('Error claiming referral username:', error)
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        throw authError
      }

      if (!user?.id) {
        throw new Error('You must be logged in to create a referral username.')
      }

      const { data, error: updateError } = await supabase
        .from('users')
        .update({
          referral_username: validation.normalized,
          referral_code: `REF${user.id.slice(0, 8).toUpperCase()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .is('referral_username', null)
        .select('id, referral_username, referral_code')
        .maybeSingle()

      if (updateError) {
        throw updateError
      }

      if (!data) {
        throw new Error('Referral username already exists or has already been created.')
      }

      if (data?.id) {
        invalidateUserPanelCache(getUserCacheKey(data.id, 'referral-summary'))
        invalidateUserPanelCache(getUserCacheKey(data.id, 'referral-summary-full'))
        invalidateUserPanelCache(getUserCacheKey(data.id, 'dashboard'))
      }

      return { data, error: null }
    } catch (fallbackError) {
      console.error('Fallback referral username claim failed:', fallbackError)
      return { data: null, error: fallbackError }
    }
  }
}

export const getReferralProfile = async (userId) => {
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, phone, credits, referral_username, referral_code, referred_by, created_at')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data || null
  } catch (error) {
    console.error('Error fetching referral profile:', error)
    return null
  }
}

export const getReferralEarnings = async (userId) => {
  if (!userId) {
    return []
  }

  try {
    const entry = await revalidateUserPanelResource({
      cacheKey: getUserCacheKey(userId, 'referral-earnings'),
      policy: getUserPanelCachePolicy('referral-earnings'),
      fetcher: async () => {
        const { data, error } = await supabase
          .from('referral_earnings')
          .select(`
            *,
            referred_user:users!referral_earnings_referred_user_id_fkey(id, name, email, phone)
          `)
          .eq('referrer_user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          if (isMissingResourceError(error)) {
            return []
          }
          throw error
        }

        return (data || []).map(normalizeEarningRecord)
      },
    })

    return entry?.data || []
  } catch (error) {
    console.error('Error fetching referral earnings:', error)
    return []
  }
}

export const getMyReferrals = async (userId) => {
  if (!userId) {
    return []
  }

  try {
    const entry = await revalidateUserPanelResource({
      cacheKey: getUserCacheKey(userId, 'referral-summary'),
      policy: getUserPanelCachePolicy('referral-summary'),
      fetcher: async () => {
        const [referralsResult, earnings] = await Promise.all([
          supabase
            .from('users')
            .select('id, name, email, phone, created_at, verified')
            .eq('referred_by', userId)
            .order('created_at', { ascending: false }),
          getReferralEarnings(userId),
        ])

        if (referralsResult.error) {
          if (isMissingResourceError(referralsResult.error)) {
            return []
          }
          throw referralsResult.error
        }

        const earningsByUser = earnings.reduce((acc, earning) => {
          const key = earning.referred_user_id

          if (!key) {
            return acc
          }

          if (!acc[key]) {
            acc[key] = {
              totalCommission: 0,
              purchases: 0,
              latestPurchaseAt: null,
            }
          }

          acc[key].totalCommission += earning.commission_amount
          acc[key].purchases += 1
          acc[key].latestPurchaseAt =
            !acc[key].latestPurchaseAt || new Date(earning.created_at) > new Date(acc[key].latestPurchaseAt)
              ? earning.created_at
              : acc[key].latestPurchaseAt

          return acc
        }, {})

        return (referralsResult.data || []).map((referral) => {
          const summary = earningsByUser[referral.id]

          return {
            ...referral,
            totalCommission: toNumber(summary?.totalCommission),
            purchases: toNumber(summary?.purchases),
            status: summary?.purchases ? 'Converted' : 'Signed Up',
            latestPurchaseAt: summary?.latestPurchaseAt || null,
          }
        })
      },
    })

    return entry?.data || []
  } catch (error) {
    console.error('Error fetching referrals:', error)
    return []
  }
}

export const getUserWallets = async (userId) => {
  if (!userId) {
    return []
  }

  try {
    const entry = await revalidateUserPanelResource({
      cacheKey: getUserCacheKey(userId, 'wallets'),
      policy: getUserPanelCachePolicy('wallets'),
      fetcher: async () => {
        const { data, error } = await supabase
          .from('user_wallets')
          .select('*')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false })

        if (error) {
          if (isMissingResourceError(error)) {
            return []
          }
          throw error
        }

        return (data || []).map(normalizeWalletRecord)
      },
    })

    return entry?.data || []
  } catch (error) {
    console.error('Error fetching wallets:', error)
    return []
  }
}

const clearDefaultWallets = async (userId, excludeWalletId = null) => {
  let query = supabase
    .from('user_wallets')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (excludeWalletId) {
    query = query.neq('id', excludeWalletId)
  }

  await query
}

export const saveWallet = async (userId, walletData) => {
  if (!userId) {
    return { data: null, error: new Error('User is required.') }
  }

  const payload = {
    user_id: userId,
    banking_type: String(walletData.banking_type || '').trim(),
    bank_name: String(walletData.bank_name || '').trim(),
    account_number: String(walletData.account_number || '').trim(),
    account_name: String(walletData.account_name || '').trim(),
    is_default: Boolean(walletData.is_default),
    is_active: walletData.is_active !== false,
    updated_at: new Date().toISOString(),
  }

  if (!payload.banking_type || !payload.bank_name || !payload.account_number || !payload.account_name) {
    return { data: null, error: new Error('All wallet fields are required.') }
  }

  try {
    if (payload.is_default) {
      await clearDefaultWallets(userId, walletData.id)
    }

    const query = walletData.id
      ? supabase
          .from('user_wallets')
          .update(payload)
          .eq('id', walletData.id)
          .eq('user_id', userId)
      : supabase.from('user_wallets').insert(payload)

    const { data, error } = await query.select('*').maybeSingle()

    if (error) {
      throw error
    }

    invalidateUserPanelCache(getUserCacheKey(userId, 'wallets'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'wallet-panel'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals-panel'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'dashboard'))
    return { data: normalizeWalletRecord(data), error: null }
  } catch (error) {
    console.error('Error saving wallet:', error)
    return { data: null, error }
  }
}

export const deleteWallet = async (userId, walletId) => {
  if (!userId || !walletId) {
    return { error: new Error('Wallet is required.') }
  }

  try {
    const { error } = await supabase
      .from('user_wallets')
      .delete()
      .eq('id', walletId)
      .eq('user_id', userId)

    if (error) {
      throw error
    }

    invalidateUserPanelCache(getUserCacheKey(userId, 'wallets'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'wallet-panel'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals-panel'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'dashboard'))
    return { error: null }
  } catch (error) {
    console.error('Error deleting wallet:', error)
    return { error }
  }
}

export const setDefaultWallet = async (userId, walletId) => {
  if (!userId || !walletId) {
    return { error: new Error('Wallet is required.') }
  }

  try {
    await clearDefaultWallets(userId, walletId)

    const { data, error } = await supabase
      .from('user_wallets')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', walletId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle()

    if (error) {
      throw error
    }

    invalidateUserPanelCache(getUserCacheKey(userId, 'wallets'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'wallet-panel'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals-panel'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'dashboard'))
    return { data: normalizeWalletRecord(data), error: null }
  } catch (error) {
    console.error('Error setting default wallet:', error)
    return { data: null, error }
  }
}

export const getWithdrawalRequests = async (userId) => {
  if (!userId) {
    return []
  }

  try {
    const entry = await revalidateUserPanelResource({
      cacheKey: getUserCacheKey(userId, 'withdrawals'),
      policy: getUserPanelCachePolicy('withdrawals'),
      fetcher: async () => {
        const { data, error } = await supabase
          .from('withdrawal_requests')
          .select(`
            *,
            wallet:user_wallets(id, banking_type, bank_name, account_number, account_name, is_default)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          if (isMissingResourceError(error)) {
            return []
          }
          throw error
        }

        return (data || []).map(normalizeWithdrawalRecord)
      },
    })

    return entry?.data || []
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error)
    return []
  }
}

export const getWithdrawableBalance = async (userId) => {
  if (!userId) {
    return 0
  }

  try {
    const entry = await revalidateUserPanelResource({
      cacheKey: getUserCacheKey(userId, 'withdrawals-panel-balance'),
      policy: getUserPanelCachePolicy('withdrawals-panel'),
      fetcher: async () => {
        const [earnings, withdrawals] = await Promise.all([
          getReferralEarnings(userId),
          getWithdrawalRequests(userId),
        ])

        const totalAvailableEarnings = earnings
          .filter((earning) => earning.status !== 'reversed')
          .reduce((sum, earning) => sum + earning.commission_amount, 0)

        const reservedAmount = withdrawals
          .filter((request) => ['requested', 'approved', 'paid'].includes(request.status))
          .reduce((sum, request) => sum + request.amount, 0)

        return Math.max(0, totalAvailableEarnings - reservedAmount)
      },
    })

    return Number(entry?.data || 0)
  } catch (error) {
    console.error('Error calculating withdrawable balance:', error)
    return 0
  }
}

export const createWithdrawalRequest = async (userId, walletId, amount) => {
  if (!userId || !walletId) {
    return { data: null, error: new Error('Wallet is required.') }
  }

  const normalizedAmount = toNumber(amount)
  const settings = await getReferralSettings()
  const availableBalance = await getWithdrawableBalance(userId)

  if (normalizedAmount < settings.min_withdrawal_amount) {
    return {
      data: null,
      error: new Error(`Minimum withdrawal amount is ${settings.min_withdrawal_amount} BDT.`),
    }
  }

  if (normalizedAmount > availableBalance) {
    return {
      data: null,
      error: new Error('Requested amount exceeds your withdrawable balance.'),
    }
  }

  try {
    const { data, error } = await supabase.rpc('create_withdrawal_request', {
      p_wallet_id: walletId,
      p_amount: normalizedAmount,
    })

    if (error) {
      throw error
    }

    const created = Array.isArray(data) ? data[0] : data
    invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals-panel'))
    invalidateUserPanelCache(getUserCacheKey(userId, 'dashboard'))
    return { data: normalizeWithdrawalRecord(created), error: null }
  } catch (error) {
    if (!isMissingResourceError(error)) {
      console.error('Error creating withdrawal request:', error)
    }

    try {
      const { data, error: insertError } = await supabase
        .from('withdrawal_requests')
        .insert({
          user_id: userId,
          wallet_id: walletId,
          amount: normalizedAmount,
          status: 'requested',
        })
        .select(`
          *,
          wallet:user_wallets(id, banking_type, bank_name, account_number, account_name, is_default)
        `)
        .maybeSingle()

      if (insertError) {
        throw insertError
      }

      invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals'))
      invalidateUserPanelCache(getUserCacheKey(userId, 'withdrawals-panel'))
      invalidateUserPanelCache(getUserCacheKey(userId, 'dashboard'))
      return { data: normalizeWithdrawalRecord(data), error: null }
    } catch (fallbackError) {
      console.error('Fallback withdrawal request creation failed:', fallbackError)
      return { data: null, error: fallbackError }
    }
  }
}

export const getReferralSummary = async (userId) => {
  const entry = await revalidateUserPanelResource({
    cacheKey: getUserCacheKey(userId, 'referral-summary-full'),
    policy: getUserPanelCachePolicy('referral-summary'),
    fetcher: async () => {
      const [profile, referrals, earnings, withdrawals, wallets, settings] = await Promise.all([
        getReferralProfile(userId),
        getMyReferrals(userId),
        getReferralEarnings(userId),
        getWithdrawalRequests(userId),
        getUserWallets(userId),
        getReferralSettings(),
      ])

      const totalEarned = earnings
        .filter((earning) => earning.status !== 'reversed')
        .reduce((sum, earning) => sum + earning.commission_amount, 0)
      const totalWithdrawn = withdrawals
        .filter((request) => request.status === 'paid')
        .reduce((sum, request) => sum + request.amount, 0)
      const pendingWithdrawalAmount = withdrawals
        .filter((request) => ['requested', 'approved'].includes(request.status))
        .reduce((sum, request) => sum + request.amount, 0)

      return {
        profile,
        referrals,
        earnings,
        withdrawals,
        wallets,
        settings,
        totals: {
          totalReferrals: referrals.length,
          totalEarned,
          totalWithdrawn,
          pendingWithdrawalAmount,
          withdrawableBalance: Math.max(0, totalEarned - totalWithdrawn - pendingWithdrawalAmount),
        },
      }
    },
  })

  return entry?.data || null
}

export const buildReferralLink = (username) => {
  const normalized = slugifyReferralUsername(username)

  if (!normalized) {
    return ''
  }

  if (typeof window === 'undefined') {
    return `/registration?ref=${normalized}`
  }

  const url = new URL('/registration', window.location.origin)
  url.searchParams.set('ref', normalized)
  return url.toString()
}

export const getAdminWithdrawalRequests = async () => {
  try {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select(`
        *,
        user:users(id, name, email, phone),
        wallet:user_wallets(id, banking_type, bank_name, account_number, account_name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingResourceError(error)) {
        return []
      }
      throw error
    }

    return (data || []).map(normalizeWithdrawalRecord)
  } catch (error) {
    console.error('Error fetching admin withdrawal requests:', error)
    return []
  }
}

export const updateWithdrawalRequestStatus = async (requestId, status, adminNote = '') => {
  if (!requestId || !status) {
    return { data: null, error: new Error('Withdrawal request is required.') }
  }

  try {
    const { data, error } = await supabase.rpc('review_withdrawal_request', {
      p_request_id: requestId,
      p_status: status,
      p_admin_note: adminNote || null,
    })

    if (error) {
      throw error
    }

    const updated = Array.isArray(data) ? data[0] : data
    return { data: normalizeWithdrawalRecord(updated), error: null }
  } catch (error) {
    if (!isMissingResourceError(error)) {
      console.error('Error updating withdrawal status:', error)
    }

    try {
      const updates = {
        status,
        admin_note: adminNote || '',
        updated_at: new Date().toISOString(),
      }

      if (status === 'paid') {
        updates.completed_at = new Date().toISOString()
      }

      const { data, error: updateError } = await supabase
        .from('withdrawal_requests')
        .update(updates)
        .eq('id', requestId)
        .select(`
          *,
          user:users(id, name, email, phone),
          wallet:user_wallets(id, banking_type, bank_name, account_number, account_name)
        `)
        .maybeSingle()

      if (updateError) {
        throw updateError
      }

      return { data: normalizeWithdrawalRecord(data), error: null }
    } catch (fallbackError) {
      console.error('Fallback withdrawal status update failed:', fallbackError)
      return { data: null, error: fallbackError }
    }
  }
}

export const saveReferralSettings = async (settings) => {
  const normalized = {
    ...DEFAULT_REFERRAL_SETTINGS,
    ...settings,
    referral_commission_value: toNumber(
      settings.referral_commission_value,
      DEFAULT_REFERRAL_SETTINGS.referral_commission_value
    ),
    referral_bonus_percent: toNumber(
      settings.referral_bonus_percent,
      DEFAULT_REFERRAL_SETTINGS.referral_bonus_percent
    ),
    min_withdrawal_amount: toNumber(
      settings.min_withdrawal_amount,
      DEFAULT_REFERRAL_SETTINGS.min_withdrawal_amount
    ),
  }

  try {
    const existing = await getSiteSettingsRow()
    const payload = existing?.id ? { id: existing.id, ...normalized } : normalized

    const { data, error } = await supabase
      .from('site_settings')
      .upsert(payload)
      .select('*')
      .maybeSingle()

    if (error) {
      throw error
    }

    invalidateUserPanelCache(getUserCacheKey('global', 'referral-settings'))
    return { data: normalizeSettingsRecord(data), error: null }
  } catch (error) {
    console.error('Error saving referral settings:', error)
    return { data: null, error }
  }
}

export const getReferralAdminOverview = async () => {
  const [earnings, withdrawals, settings] = await Promise.all([
    (async () => {
      try {
        const { data, error } = await supabase.from('referral_earnings').select('*')
        if (error) {
          if (isMissingResourceError(error)) {
            return []
          }
          throw error
        }
        return (data || []).map(normalizeEarningRecord)
      } catch (error) {
        console.error('Error fetching referral admin earnings:', error)
        return []
      }
    })(),
    getAdminWithdrawalRequests(),
    getReferralSettings(),
  ])

  return {
    settings,
    totalCommissions: earnings
      .filter((earning) => earning.status !== 'reversed')
      .reduce((sum, earning) => sum + earning.commission_amount, 0),
    availableCommissions: earnings
      .filter((earning) => earning.status === 'available')
      .reduce((sum, earning) => sum + earning.commission_amount, 0),
    totalReferralPurchases: earnings.length,
    requestedWithdrawals: withdrawals
      .filter((request) => request.status === 'requested')
      .reduce((sum, request) => sum + request.amount, 0),
    approvedWithdrawals: withdrawals
      .filter((request) => request.status === 'approved')
      .reduce((sum, request) => sum + request.amount, 0),
    paidWithdrawals: withdrawals
      .filter((request) => request.status === 'paid')
      .reduce((sum, request) => sum + request.amount, 0),
  }
}
