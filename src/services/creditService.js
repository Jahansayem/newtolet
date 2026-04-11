import { supabase } from './supabaseClient'
import { getCreditCosts } from './adminService'
import {
  buildUserPanelCacheKey,
  invalidateUserPanelCache,
  revalidateUserPanelResource,
} from './cacheService'
import { getUserPanelCachePolicy } from './userPanelCacheConfig'

// Get credit costs from admin settings (with fallbacks)
const getPropertyListingCostValue = async () => {
  const costs = await getCreditCosts()
  return costs.property_listing || 20
}

const getContactViewCostValue = async () => {
  const costs = await getCreditCosts()
  return costs.contact_view || 10
}

const getPhotoViewCostValue = async () => {
  const costs = await getCreditCosts()
  return costs.photo_view || 10
}

/**
 * Get user's current credit balance
 * @param {string} userId - The user ID
 * @returns {Promise<number>} - Current credit balance
 */
export const getUserCredits = async (userId) => {
  try {
    const entry = await revalidateUserPanelResource({
      cacheKey: buildUserPanelCacheKey(userId || 'guest', 'credit-balance'),
      policy: getUserPanelCachePolicy('credit-balance'),
      fetcher: async () => {
        const { data, error } = await supabase
          .from('users')
          .select('credits')
          .eq('id', userId)
          .single()

        if (error) {
          throw error
        }

        return data?.credits || 0
      },
    })

    return Number(entry?.data || 0)
  } catch (error) {
    console.error('Error fetching user credits:', error)
    throw new Error(`Failed to fetch credits: ${error.message}`)
  }
}

/**
 * Check if user has enough credits for an action
 * @param {string} userId - The user ID
 * @param {number} requiredCredits - Credits needed
 * @returns {Promise<boolean>}
 */
export const hasEnoughCredits = async (userId, requiredCredits) => {
  const currentCredits = await getUserCredits(userId)
  return currentCredits >= requiredCredits
}

/**
 * Deduct credits from user account
 * @param {string} userId - The user ID
 * @param {number} credits - Number of credits to deduct
 * @param {string} transactionType - Type of transaction (e.g., 'property_listing', 'contact_view')
 * @param {string} propertyId - Optional property ID for context
 * @returns {Promise<boolean>}
 */
export const deductCredits = async (
  userId,
  credits,
  transactionType,
  propertyId = null
) => {
  try {
    // Start a transaction-like operation
    // 1. Get current credits
    const currentCredits = await getUserCredits(userId)

    if (currentCredits < credits) {
      throw new Error('Insufficient credits')
    }

    // 2. Deduct credits
    const newBalance = currentCredits - credits

    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newBalance })
      .eq('id', userId)

    if (updateError) {
      throw updateError
    }

    // 3. Log transaction
    const { error: logError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        credits_deducted: credits,
        transaction_type: transactionType,
        property_id: propertyId,
      })

    if (logError) {
      // Transaction logged but deduction succeeded
      console.error('Failed to log transaction:', logError)
    }

    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'credit-balance'))
    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'credit-history'))
    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'dashboard'))
    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'wallet-panel'))

    return true
  } catch (error) {
    console.error('Error deducting credits:', error)
    throw new Error(`Failed to deduct credits: ${error.message}`)
  }
}

/**
 * Add credits to user account
 * @param {string} userId - The user ID
 * @param {number} credits - Number of credits to add
 * @param {string} transactionType - Type of transaction (e.g., 'credit_purchase')
 * @returns {Promise<boolean>}
 */
export const addCredits = async (userId, credits, transactionType = 'credit_purchase') => {
  try {
    // Get current credits
    const currentCredits = await getUserCredits(userId)
    const newBalance = currentCredits + credits

    // Update user credits
    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newBalance })
      .eq('id', userId)

    if (updateError) {
      throw updateError
    }

    // Log transaction
    const { error: logError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        credits_deducted: -credits, // Negative means added
        transaction_type: transactionType,
      })

    if (logError) {
      console.error('Failed to log transaction:', logError)
    }

    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'credit-balance'))
    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'credit-history'))
    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'dashboard'))
    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'wallet-panel'))

    return true
  } catch (error) {
    console.error('Error adding credits:', error)
    throw new Error(`Failed to add credits: ${error.message}`)
  }
}

/**
 * Get cost for property listing upload
 * @returns {number}
 */
export const getPropertyListingCost = () => {
  return getPropertyListingCostValue()
}

/**
 * Get cost for viewing contact number
 * @returns {number}
 */
export const getContactViewCost = () => {
  return getContactViewCostValue()
}

/**
 * Get cost for viewing photo gallery
 * @returns {number}
 */
export const getPhotoViewCost = () => {
  return getPhotoViewCostValue()
}

/**
 * Check whether a user has already unlocked contact access for a property
 * @param {string} userId - The user ID
 * @param {string} propertyId - The property ID
 * @returns {Promise<boolean>}
 */
export const hasUnlockedContactView = async (userId, propertyId) => {
  if (!userId || !propertyId) {
    return false
  }

  try {
    const { data, error } = await supabase
      .from('contact_views')
      .select('id')
      .eq('user_id', userId)
      .eq('property_id', propertyId)
      .limit(1)

    if (error) {
      throw error
    }

    return Array.isArray(data) && data.length > 0
  } catch (error) {
    console.error('Error checking contact unlock status:', error)
    return false
  }
}

/**
 * Unlock property contact and short address for a user
 * @param {string} userId - The user ID
 * @param {string} propertyId - The property ID
 * @returns {Promise<{ success: boolean, alreadyUnlocked: boolean, creditsSpent: number, remainingCredits: number }>}
 */
export const unlockContactAccess = async (userId, propertyId) => {
  if (!userId || !propertyId) {
    throw new Error('User ID and property ID are required')
  }

  const alreadyUnlocked = await hasUnlockedContactView(userId, propertyId)

  if (alreadyUnlocked) {
    return {
      success: true,
      alreadyUnlocked: true,
      creditsSpent: 0,
      remainingCredits: await getUserCredits(userId),
    }
  }

  const creditsSpent = await getContactViewCostValue()

  await deductCredits(userId, creditsSpent, 'contact_view', propertyId)

  const tracked = await trackContactView(userId, propertyId)

  if (!tracked) {
    throw new Error('Failed to record contact unlock')
  }

  return {
    success: true,
    alreadyUnlocked: false,
    creditsSpent,
    remainingCredits: await getUserCredits(userId),
  }
}

/**
 * Track contact view (log credit spending)
 * @param {string} userId - The user ID
 * @param {string} propertyId - The property ID
 * @returns {Promise<boolean>}
 */
export const trackContactView = async (userId, propertyId) => {
  try {
    const creditsSpent = await getContactViewCostValue()

    const { error } = await supabase.from('contact_views').insert({
      user_id: userId,
      property_id: propertyId,
      credits_spent: creditsSpent,
    })

    if (error) {
      throw error
    }

    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'unlocked-properties'))
    invalidateUserPanelCache(buildUserPanelCacheKey(userId, 'dashboard'))

    return true
  } catch (error) {
    console.error('Error tracking contact view:', error)
    return false
  }
}

/**
 * Track photo view (log credit spending)
 * @param {string} userId - The user ID
 * @param {string} propertyId - The property ID
 * @returns {Promise<boolean>}
 */
export const trackPhotoView = async (userId, propertyId) => {
  try {
    const creditsSpent = await getPhotoViewCostValue()

    const { error } = await supabase.from('photo_views').insert({
      user_id: userId,
      property_id: propertyId,
      credits_spent: creditsSpent,
    })

    if (error) {
      throw error
    }

    return true
  } catch (error) {
    console.error('Error tracking photo view:', error)
    return false
  }
}

/**
 * Get transaction history for a user
 * @param {string} userId - The user ID
 * @param {number} limit - Maximum number of transactions to fetch
 * @returns {Promise<Array>}
 */
export const getTransactionHistory = async (userId, limit = 50) => {
  try {
    const entry = await revalidateUserPanelResource({
      cacheKey: buildUserPanelCacheKey(userId || 'guest', 'credit-history'),
      policy: getUserPanelCachePolicy('credit-history'),
      fetcher: async () => {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) {
          throw error
        }

        return data || []
      },
    })

    return entry?.data || []
  } catch (error) {
    console.error('Error fetching transaction history:', error)
    return []
  }
}
