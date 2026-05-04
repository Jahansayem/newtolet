import { supabase } from './supabaseClient'
import { getCurrentUser, updateUserProfile } from './authService'
import {
  buildUserPanelCacheKey,
  invalidateUserPanelCache,
  revalidateUserPanelResource,
} from './cacheService'
import { getUserOrders } from './orderService'
import { getPaymentHistory } from './paymentService'
import {
  getMyReferrals,
  getReferralSettings,
  getReferralEarnings,
  getReferralSummary,
  getUserWallets,
  getWithdrawalRequests,
  getWithdrawableBalance,
} from './referralService'
import { getTransactionHistory, getUserCredits } from './creditService'
import { getUserPanelCachePolicy } from './userPanelCacheConfig'

const SAVED_PROPERTIES_STORAGE_KEY = 'savedProperties'
const SAVED_PROPERTIES_EVENT = 'saved-properties-updated'

const FAVORITES_TABLE = 'property_favorites'
const VIEW_HISTORY_TABLE = 'property_view_history'
const JOB_PARTICIPATIONS_TABLE = 'job_participations'
const PUBLIC_PROPERTIES_VIEW = 'public_property_catalog'

const getUserScopedCacheKey = (userId, resourceKey) =>
  buildUserPanelCacheKey(userId || 'guest', resourceKey)

const getGlobalCacheKey = (resourceKey) =>
  buildUserPanelCacheKey('global', resourceKey)

const getPropertyAnalyticsCacheKey = (propertyId) =>
  getUserScopedCacheKey('global', `property-analytics:${propertyId}`)

const CONTACT_UNLOCK_REFUND_WINDOW_MS = 72 * 60 * 60 * 1000

const fetchWithUserPanelCache = async ({
  userId,
  resourceKey,
  fetcher,
  cacheKey = getUserScopedCacheKey(userId, resourceKey),
}) =>
  revalidateUserPanelResource({
    cacheKey,
    policy: getUserPanelCachePolicy(resourceKey),
    fetcher,
  }).then((entry) => entry.data)

const invalidateUserResource = (userId, resourceKey) => {
  invalidateUserPanelCache(getUserScopedCacheKey(userId, resourceKey))
}

const isMissingResourceError = (error) =>
  error?.code === 'PGRST205' ||
  error?.code === 'PGRST202' ||
  error?.code === '42P01' ||
  error?.message?.includes('Could not find the table') ||
  error?.message?.includes('does not exist')

const isEmptyPlainObjectError = (error) =>
  error &&
  Object.keys(error).length === 0 &&
  error.constructor === Object

const isSavedPropertyFallbackError = (error) => {
  if (!error) {
    return true
  }

  const message = String(error?.message || '').toLowerCase()
  const details = String(error?.details || '').toLowerCase()
  const hint = String(error?.hint || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()

  return (
    isMissingResourceError(error) ||
    isEmptyPlainObjectError(error) ||
    code === '42501' ||
    code === '401' ||
    code === '403' ||
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('violates row-level security') ||
    message.includes('jwt') ||
    message.includes('not authenticated') ||
    message.includes('forbidden') ||
    details.includes('row-level security') ||
    hint.includes('row-level security')
  )
}

const isMissingPublicCatalogError = (error) =>
  error?.code === 'PGRST205' ||
  error?.code === '42P01' ||
  error?.message?.includes(`Could not find the table '${PUBLIC_PROPERTIES_VIEW}'`) ||
  error?.message?.includes('does not exist')

const isSuppressiblePropertyViewError = (error) => {
  if (!error) {
    return true
  }

  const message = String(error?.message || '').toLowerCase()
  const details = String(error?.details || '').toLowerCase()
  const hint = String(error?.hint || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()

  return (
    isMissingResourceError(error) ||
    code === '42501' ||
    code === '401' ||
    code === '403' ||
    code === '23505' ||
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('violates row-level security') ||
    message.includes('duplicate key') ||
    message.includes('jwt') ||
    message.includes('not authenticated') ||
    message.includes('forbidden') ||
    details.includes('row-level security') ||
    details.includes('duplicate key') ||
    hint.includes('row-level security') ||
    isEmptyPlainObjectError(error)
  )
}

const normalizePropertyRow = (property, imageMap = new Map()) => ({
  id: property.id,
  property_id_number: property.property_id_number,
  category: property.category,
  property_type: property.property_type || 'Apartment',
  pricing: {
    rent_amount_bdt: property.rent_amount_bdt,
    rent_period: property.rent_period,
    is_rent_negotiable: Boolean(property.is_rent_negotiable),
  },
  location: {
    state_district: property.state_district,
    area: property.area,
    sub_area: property.sub_area || null,
    short_description: property.short_description || '',
  },
  specifications: {
    total_rooms: property.total_rooms || 0,
    total_bathrooms: property.total_bathrooms || 0,
    total_balcony: property.balcony || 0,
    total_kitchen: property.total_kitchen || 0,
    floor_level: property.floor_level || '',
    room_size: property.room_size_sqft || null,
    dining_rooms: property.dining_rooms || 0,
    living_rooms: property.living_rooms || 0,
  },
  images: imageMap.get(property.id) || [],
  primary_image: imageMap.get(property.id)?.[0] || null,
  created_at: property.created_at || null,
  status: property.status || 'pending',
  is_active: property.is_active !== false,
  is_pinned: Boolean(property.is_pinned),
})

const buildImageMap = (rows = []) => {
  const imageMap = new Map()

  rows.forEach((row) => {
    if (!row?.property_id || !row?.image_url) {
      return
    }

    const existing = imageMap.get(row.property_id) || []
    existing.push(row.image_url)
    imageMap.set(row.property_id, existing)
  })

  return imageMap
}

const readLocalSavedPropertyIds = () => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_PROPERTIES_STORAGE_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch (error) {
    console.error('Error reading saved properties from local storage:', error)
    return []
  }
}

const writeLocalSavedPropertyIds = (propertyIds) => {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(SAVED_PROPERTIES_STORAGE_KEY, JSON.stringify(propertyIds))
  window.dispatchEvent(new Event(SAVED_PROPERTIES_EVENT))
}

const fetchPropertiesWithImages = async (propertyIds = []) => {
  if (!propertyIds.length) {
    return []
  }

  let properties = []
  const { data: publicProperties, error: propertyError } = await supabase
    .from(PUBLIC_PROPERTIES_VIEW)
    .select('*')
    .in('id', propertyIds)

  if (!propertyError) {
    properties = publicProperties || []
  } else if (isMissingPublicCatalogError(propertyError)) {
    const { data: legacyProperties, error: legacyPropertyError } = await supabase
      .from('properties')
      .select('*')
      .in('id', propertyIds)
      .eq('status', 'approved')
      .neq('is_active', false)

    if (legacyPropertyError) {
      throw legacyPropertyError
    }

    properties = legacyProperties || []
  } else {
    throw propertyError
  }

  const { data: images, error: imageError } = await supabase
    .from('property_images')
    .select('property_id, image_url, display_order')
    .in('property_id', propertyIds)
    .order('display_order')

  if (imageError && !isMissingResourceError(imageError)) {
    throw imageError
  }

  const imageMap = buildImageMap(images || [])
  const propertyMap = new Map(
    (properties || []).map((property) => [property.id, normalizePropertyRow(property, imageMap)])
  )

  return propertyIds.map((propertyId) => propertyMap.get(propertyId)).filter(Boolean)
}

export const getSavedPropertyIds = async (userId) => {
  if (!userId) {
    return readLocalSavedPropertyIds()
  }

  try {
    return await fetchWithUserPanelCache({
      userId,
      resourceKey: 'saved-property-ids',
      fetcher: async () => {
        const { data, error } = await supabase
          .from(FAVORITES_TABLE)
          .select('property_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          if (isMissingResourceError(error)) {
            return readLocalSavedPropertyIds()
          }

          throw error
        }

        return (data || []).map((row) => row.property_id).filter(Boolean)
      },
    })
  } catch (error) {
    if (!isSavedPropertyFallbackError(error)) {
      console.warn('Falling back to local saved property ids:', error)
    }

    return readLocalSavedPropertyIds()
  }
}

export const toggleSavedProperty = async (userId, propertyId) => {
  if (!propertyId) {
    throw new Error('Property is required.')
  }

  if (!userId) {
    const currentSaved = readLocalSavedPropertyIds()
    const nextSaved = currentSaved.includes(propertyId)
      ? currentSaved.filter((id) => id !== propertyId)
      : [...currentSaved, propertyId]

    writeLocalSavedPropertyIds(nextSaved)
    return { saved: nextSaved.includes(propertyId), propertyIds: nextSaved }
  }

  try {
    const { data: existing, error: readError } = await supabase
      .from(FAVORITES_TABLE)
      .select('id')
      .eq('user_id', userId)
      .eq('property_id', propertyId)
      .maybeSingle()

    if (readError) {
      if (isMissingResourceError(readError)) {
        return toggleSavedProperty(null, propertyId)
      }

      throw readError
    }

    if (existing?.id) {
      const { error: deleteError } = await supabase
        .from(FAVORITES_TABLE)
        .delete()
        .eq('id', existing.id)

      if (deleteError) {
        throw deleteError
      }

      return {
        saved: false,
        propertyIds: await getSavedPropertyIds(userId),
      }
    }

    const { error: insertError } = await supabase.from(FAVORITES_TABLE).insert({
      user_id: userId,
      property_id: propertyId,
    })

    if (insertError) {
      throw insertError
    }

    return {
      saved: true,
      propertyIds: await getSavedPropertyIds(userId),
    }
  } catch (error) {
    console.error('Error toggling saved property:', error)
    throw error
  } finally {
    invalidateUserResource(userId, 'saved-property-ids')
    invalidateUserResource(userId, 'saved-properties')
  }
}

export const getSavedProperties = async (userId) =>
  fetchWithUserPanelCache({
    userId,
    resourceKey: 'saved-properties',
    fetcher: async () => {
      const propertyIds = await getSavedPropertyIds(userId)
      return fetchPropertiesWithImages(propertyIds)
    },
  })

export const recordPropertyView = async (userId, propertyId) => {
  if (!userId || !propertyId) {
    return
  }

  try {
    const { error: rpcError } = await supabase.rpc('record_property_view', {
      p_property_id: propertyId,
    })

    if (!rpcError) {
      return
    }

    if (!isMissingResourceError(rpcError)) {
      throw rpcError
    }

    const { data: existing, error: readError } = await supabase
      .from(VIEW_HISTORY_TABLE)
      .select('id, view_count')
      .eq('user_id', userId)
      .eq('property_id', propertyId)
      .maybeSingle()

    if (readError) {
      if (isMissingResourceError(readError)) {
        return
      }

      throw readError
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from(VIEW_HISTORY_TABLE)
        .update({
          view_count: Number(existing.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        throw updateError
      }

      return
    }

    const { error: insertError } = await supabase.from(VIEW_HISTORY_TABLE).insert({
      user_id: userId,
      property_id: propertyId,
      view_count: 1,
    })

    if (insertError && !isSuppressiblePropertyViewError(insertError)) {
      throw insertError
    }
  } catch (error) {
    if (!isSuppressiblePropertyViewError(error)) {
      console.error('Error recording property view:', error)
    }
  } finally {
    invalidateUserResource(userId, 'recently-viewed')
  }
}

export const getRecentlyViewedProperties = async (userId) => {
  if (!userId) {
    return []
  }

  try {
    return await fetchWithUserPanelCache({
      userId,
      resourceKey: 'recently-viewed',
      fetcher: async () => {
        const { data, error } = await supabase
          .from(VIEW_HISTORY_TABLE)
          .select('property_id, view_count, first_viewed_at, last_viewed_at')
          .eq('user_id', userId)
          .order('last_viewed_at', { ascending: false })

        if (error) {
          if (isMissingResourceError(error)) {
            return []
          }

          throw error
        }

        const propertyIds = (data || []).map((entry) => entry.property_id).filter(Boolean)
        const properties = await fetchPropertiesWithImages(propertyIds)
        const metadataByPropertyId = new Map((data || []).map((entry) => [entry.property_id, entry]))

        return properties.map((property) => ({
          ...property,
          view_count: metadataByPropertyId.get(property.id)?.view_count || 0,
          first_viewed_at: metadataByPropertyId.get(property.id)?.first_viewed_at || null,
          last_viewed_at: metadataByPropertyId.get(property.id)?.last_viewed_at || null,
        }))
      },
    })
  } catch (error) {
    console.error('Error fetching recently viewed properties:', error)
    return []
  }
}

export const getUnlockedProperties = async (userId) => {
  if (!userId) {
    return []
  }

  try {
    return await fetchWithUserPanelCache({
      userId,
      resourceKey: 'unlocked-properties',
      fetcher: async () => {
        const { data: unlockRows, error } = await supabase
          .from('contact_views')
          .select('id, property_id, viewed_at, credits_spent')
          .eq('user_id', userId)
          .order('viewed_at', { ascending: false })

        if (error) {
          throw error
        }

        const propertyIds = (unlockRows || []).map((entry) => entry.property_id).filter(Boolean)
        const contactViewIds = (unlockRows || []).map((entry) => entry.id).filter(Boolean)
        const properties = await fetchPropertiesWithImages(propertyIds)
        const metadataByPropertyId = new Map(
          (unlockRows || []).map((entry) => [entry.property_id, entry])
        )
        let refundRows = []

        if (contactViewIds.length) {
          const { data: refunds, error: refundError } = await supabase
            .from('contact_unlock_refund_requests')
            .select(`
              contact_view_id,
              reason_code,
              status,
              requested_at,
              reviewed_at,
              credited_at,
              credits_restored
            `)
            .in('contact_view_id', contactViewIds)

          if (refundError && !isMissingResourceError(refundError)) {
            throw refundError
          }

          refundRows = refunds || []
        }

        const refundByContactViewId = new Map(
          refundRows.map((entry) => [entry.contact_view_id, entry])
        )

        return properties.map((property) => ({
          ...property,
          contact_view_id: metadataByPropertyId.get(property.id)?.id || null,
          unlocked_at: metadataByPropertyId.get(property.id)?.viewed_at || null,
          credits_spent: Number(metadataByPropertyId.get(property.id)?.credits_spent || 0),
          refund_status:
            refundByContactViewId.get(metadataByPropertyId.get(property.id)?.id)?.status || null,
          refund_reason_code:
            refundByContactViewId.get(metadataByPropertyId.get(property.id)?.id)?.reason_code ||
            null,
          refund_requested_at:
            refundByContactViewId.get(metadataByPropertyId.get(property.id)?.id)?.requested_at ||
            null,
          refund_reviewed_at:
            refundByContactViewId.get(metadataByPropertyId.get(property.id)?.id)?.reviewed_at ||
            null,
          refund_credited_at:
            refundByContactViewId.get(metadataByPropertyId.get(property.id)?.id)?.credited_at ||
            null,
          credits_restored: Number(
            refundByContactViewId.get(metadataByPropertyId.get(property.id)?.id)
              ?.credits_restored || 0
          ),
          can_claim_refund:
            !refundByContactViewId.get(metadataByPropertyId.get(property.id)?.id) &&
            Boolean(metadataByPropertyId.get(property.id)?.id) &&
            Boolean(metadataByPropertyId.get(property.id)?.viewed_at) &&
            Date.now() -
              new Date(metadataByPropertyId.get(property.id)?.viewed_at).getTime() <=
              CONTACT_UNLOCK_REFUND_WINDOW_MS,
        }))
      },
    })
  } catch (error) {
    console.error('Error fetching unlocked properties:', error)
    return []
  }
}

export const getDashboardSummary = async (userId) => {
  if (!userId) {
    return null
  }

  try {
    return await fetchWithUserPanelCache({
      userId,
      resourceKey: 'dashboard',
      fetcher: async () => {
        const [
          user,
          credits,
          propertyResult,
          ordersResult,
          referrals,
          earnings,
          wallets,
          withdrawals,
          withdrawableBalance,
          jobParticipations,
        ] = await Promise.all([
          getCurrentUser(),
          getUserCredits(userId),
          supabase.from('properties').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          getUserOrders(userId),
          getMyReferrals(userId),
          getReferralEarnings(userId),
          getUserWallets(userId),
          getWithdrawalRequests(userId),
          getWithdrawableBalance(userId),
          getJobHistory(userId),
        ])

        const totalEarn = (earnings || [])
          .filter((entry) => entry.status !== 'reversed')
          .reduce((sum, entry) => sum + Number(entry.commission_amount || 0), 0)
        const totalWithdrawal = (withdrawals || [])
          .filter((entry) => entry.status === 'paid')
          .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

        return {
          user: {
            name: user?.name || 'Account User',
            phone: user?.phone || '',
            email: user?.email || '',
          },
          credits: Number(credits || 0),
          propertyCount: Number(propertyResult.count || 0),
          orderCount: Number(ordersResult?.data?.length || 0),
          referralCount: Number(referrals?.length || 0),
          jobParticipationCount: Number(jobParticipations?.length || 0),
          totalEarn,
          withdrawableBalance: Number(withdrawableBalance || 0),
          walletCount: Number(wallets?.length || 0),
          totalWithdrawal,
        }
      },
    })
  } catch (error) {
    console.error('Error building dashboard summary:', error)
    return null
  }
}

export const getInvoices = async (userId) =>
  fetchWithUserPanelCache({
    userId,
    resourceKey: 'invoices',
    fetcher: async () => {
      const { data } = await getPaymentHistory(userId, 100)
      return data || []
    },
  })

export const getProfileSettings = async (userId) => {
  if (!userId) {
    return null
  }

  try {
    return await fetchWithUserPanelCache({
      userId,
      resourceKey: 'profile',
      fetcher: async () => {
        const user = await getCurrentUser()

        if (!user || user.id !== userId) {
          return null
        }

        return {
          name: user.name || '',
          email: user.email || '',
        }
      },
    })
  } catch (error) {
    console.error('Error loading profile settings:', error)
    return null
  }
}

export const updatePanelProfile = async (userId, values) => {
  if (!userId) {
    return { success: false, error: 'User is required.' }
  }

  const payload = {
    name: String(values?.name || '').trim(),
    email: String(values?.email || '').trim(),
    newPassword: String(values?.newPassword || ''),
  }

  try {
    if (!payload.name || !payload.email) {
      throw new Error('Name and email are required.')
    }

    const { data: authUpdateData, error: authUpdateError } = await supabase.auth.updateUser({
      email: payload.email,
      ...(payload.newPassword ? { password: payload.newPassword } : {}),
      data: {
        name: payload.name,
      },
    })

    if (authUpdateError) {
      throw authUpdateError
    }

    const profileResult = await updateUserProfile(userId, {
      name: payload.name,
      email: payload.email,
    })

    if (!profileResult.success) {
      throw new Error(profileResult.error || 'Failed to update profile.')
    }

    invalidateUserResource(userId, 'profile')
    invalidateUserResource(userId, 'dashboard')
    invalidateUserResource(userId, 'referral-summary')

    return {
      success: true,
      user: profileResult.user,
      requiresEmailVerification:
        authUpdateData?.user?.new_email && authUpdateData.user.new_email !== payload.email,
    }
  } catch (error) {
    console.error('Error updating panel profile:', error)
    return {
      success: false,
      error: error.message || 'Failed to update profile.',
    }
  }
}

export const getJobFeed = async () => {
  try {
    return await fetchWithUserPanelCache({
      userId: 'global',
      resourceKey: 'job-feed',
      cacheKey: getGlobalCacheKey('job-feed'),
      fetcher: async () => {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('is_job_feed_posted', true)
          .eq('status', 'confirmed')
          .order('job_feed_posted_at', { ascending: false })

        if (error) {
          throw error
        }

        return data || []
      },
    })
  } catch (error) {
    console.error('Error fetching job feed:', error)
    return []
  }
}

export const createJobParticipation = async (
  userId,
  { orderId, specificAddress, contactDetails, propertyId = null }
) => {
  if (!userId || !orderId) {
    return { data: null, error: new Error('Job is required.') }
  }

  const payload = {
    user_id: userId,
    order_id: orderId,
    property_id: propertyId || null,
    specific_address: String(specificAddress || '').trim(),
    contact_details: String(contactDetails || '').trim(),
    status: 'pending',
  }

  if (!payload.specific_address || !payload.contact_details) {
    return {
      data: null,
      error: new Error('Specific address and contact details are required.'),
    }
  }

  try {
    const { data, error } = await supabase
      .from(JOB_PARTICIPATIONS_TABLE)
      .insert(payload)
      .select('*')
      .maybeSingle()

    if (error) {
      if (isMissingResourceError(error)) {
        return {
          data: null,
          error: new Error('Missing job participation table. Run the latest user panel migration.'),
        }
      }

      throw error
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error creating job participation:', error)
    return { data: null, error }
  } finally {
    invalidateUserResource(userId, 'job-history')
    invalidateUserResource(userId, 'dashboard')
  }
}

export const getJobHistory = async (userId) => {
  if (!userId) {
    return []
  }

  try {
    return await fetchWithUserPanelCache({
      userId,
      resourceKey: 'job-history',
      fetcher: async () => {
        const { data, error } = await supabase
          .from(JOB_PARTICIPATIONS_TABLE)
          .select(`
            *,
            order:orders(*),
            property:properties(id, property_id_number, category, area, state_district)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          if (isMissingResourceError(error)) {
            return []
          }

          throw error
        }

        return data || []
      },
    })
  } catch (error) {
    console.error('Error fetching job history:', error)
    return []
  }
}

export const updatePropertyPanelState = async (propertyId, updates) => {
  if (!propertyId) {
    return { data: null, error: new Error('Property is required.') }
  }

  try {
    const nextUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('properties')
      .update(nextUpdates)
      .eq('id', propertyId)
      .select('*')
      .maybeSingle()

    if (error) {
      throw error
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error updating property panel state:', error)
    return { data: null, error }
  } finally {
    invalidateUserPanelCache(getPropertyAnalyticsCacheKey(propertyId))
  }
}

export const getPropertyAnalytics = async (propertyId) => {
  if (!propertyId) {
    return {
      contactUnlocks: 0,
      totalCreditsSpent: 0,
      recentViewCount: 0,
    }
  }

  try {
    return await fetchWithUserPanelCache({
      userId: 'global',
      resourceKey: `property-analytics:${propertyId}`,
      cacheKey: getPropertyAnalyticsCacheKey(propertyId),
      fetcher: async () => {
        const { data, error } = await supabase.rpc('get_property_contact_unlock_analytics', {
          p_property_id: propertyId,
        })

        if (error) {
          throw error
        }

        const analytics = Array.isArray(data) ? data[0] : data

        return {
          contactUnlocks: Number(analytics?.contact_unlocks || 0),
          totalCreditsSpent: Number(analytics?.total_credits_spent || 0),
          recentViewCount: Number(analytics?.recent_view_count || 0),
        }
      },
    })
  } catch (error) {
    console.error('Error loading property analytics:', error)
    return {
      contactUnlocks: 0,
      totalCreditsSpent: 0,
      recentViewCount: 0,
    }
  }
}

export const getEarningsPanelData = async (userId) =>
  fetchWithUserPanelCache({
    userId,
    resourceKey: 'earnings-panel',
    fetcher: async () => {
      const [summary, settings] = await Promise.all([
        getReferralSummary(userId),
        getReferralSettings(),
      ])

      return {
        summary,
        settings,
      }
    },
  })

export const getWalletPanelData = async (userId) =>
  fetchWithUserPanelCache({
    userId,
    resourceKey: 'wallet-panel',
    fetcher: async () => {
      const [wallets, credits, creditHistory, paymentHistory] = await Promise.all([
        getUserWallets(userId),
        getUserCredits(userId),
        getTransactionHistory(userId, 50),
        getPaymentHistory(userId, 20),
      ])

      return {
        wallets,
        creditBalance: Number(credits || 0),
        creditHistory: creditHistory || [],
        paymentHistory: paymentHistory?.data || [],
      }
    },
  })

export const getWithdrawalsPanelData = async (userId) =>
  fetchWithUserPanelCache({
    userId,
    resourceKey: 'withdrawals-panel',
    fetcher: async () => {
      const [settings, wallets, withdrawals, withdrawableBalance] = await Promise.all([
        getReferralSettings(),
        getUserWallets(userId),
        getWithdrawalRequests(userId),
        getWithdrawableBalance(userId),
      ])

      return {
        settings,
        wallets,
        withdrawals,
        withdrawableBalance: Number(withdrawableBalance || 0),
      }
    },
  })

export const createContactUnlockRefundRequest = async (contactViewId, reasonCode, details = '') => {
  if (!contactViewId || !reasonCode) {
    return { data: null, error: new Error('Unlock record and reason are required.') }
  }

  try {
    const { data, error } = await supabase.rpc('create_contact_unlock_refund_request', {
      p_contact_view_id: contactViewId,
      p_reason_code: reasonCode,
      p_details: details || null,
    })

    if (error) {
      throw error
    }

    return { data: Array.isArray(data) ? data[0] : data, error: null }
  } catch (error) {
    console.error('Error creating contact unlock refund request:', error)
    return { data: null, error }
  } finally {
    try {
      const user = await getCurrentUser()
      if (user?.id) {
        invalidateUserResource(user.id, 'unlocked-properties')
        invalidateUserResource(user.id, 'dashboard')
        invalidateUserResource(user.id, 'wallet-panel')
        invalidateUserResource(user.id, 'credit-history')
        invalidateUserResource(user.id, 'credit-balance')
      }
    } catch (invalidateError) {
      console.warn('Unable to refresh user caches after refund request:', invalidateError)
    }
  }
}

export const SAVED_PROPERTIES_BROWSER_EVENT = SAVED_PROPERTIES_EVENT
