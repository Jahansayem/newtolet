import { supabase } from './supabaseClient'
import { authenticatedJsonRequest } from './apiClient'

const getLocalDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatReportLabel = (dateKey) => {
  const date = new Date(`${dateKey}T00:00:00`)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

// Helper function to handle table not found errors
const handleTableNotFoundError = (error, tableName) => {
  if (error?.code === 'PGRST205' || error?.message?.includes('Could not find the table')) {
    console.warn(`Table '${tableName}' does not exist. Please run the SQL migration.`)
    return { data: [], error: null } // Return empty array instead of error
  }
  return { data: null, error }
}

// ==================== USER MANAGEMENT ====================

// Get all blacklisted users with details
export const getBlacklistedUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('user_blacklist')
      .select(`
        *,
        users(id, name, email, phone, is_active)
      `)
      .order('blacklisted_at', { ascending: false })

    if (error) {
      const handled = handleTableNotFoundError(error, 'user_blacklist')
      if (handled.data !== null) return handled
      throw error
    }
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching blacklisted users:', error)
    return { data: [], error: null }
  }
}

// Check if user is blacklisted
export const checkUserBlacklist = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_blacklist')
      .select('*')
      .eq('user_id', userId)
      .order('blacklisted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { blacklisted: false, data: null, error }
    return { blacklisted: !!data, data, error: null }
  } catch (error) {
    console.error('Error checking blacklist:', error)
    return { blacklisted: false, data: null, error }
  }
}

// Add user to blacklist
export const blacklistUser = async (userId, reason, adminId, notes = '', isPermanent = true) => {
  try {
    // Add to blacklist table
    const { data: blacklistData, error: blacklistError } = await supabase
      .from('user_blacklist')
      .insert({
        user_id: userId,
        reason,
        blacklisted_by: adminId,
        notes,
        is_permanent: isPermanent
      })
      .select()

    if (blacklistError) throw blacklistError

    // Also deactivate user account
    const { data: userData, error: userError } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId)
      .select()

    if (userError) throw userError

    return { data: { ...blacklistData[0], user: userData[0] }, error: null }
  } catch (error) {
    console.error('Error blacklisting user:', error)
    return { data: null, error }
  }
}

// Remove user from blacklist
export const unblacklistUser = async (userId) => {
  try {
    // Remove from blacklist table
    const { error: deleteError } = await supabase
      .from('user_blacklist')
      .delete()
      .eq('user_id', userId)

    if (deleteError) throw deleteError

    // Reactivate user account
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: true })
      .eq('id', userId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error unblacklisting user:', error)
    return { data: null, error }
  }
}

// Get blacklist reasons
export const getBlacklistReasons = () => {
  return [
    { value: 'Violation of terms', label: 'Violation of Terms' },
    { value: 'Fraud', label: 'Fake Listings / Fraud' },
    { value: 'Harassment', label: 'Harassment / Abuse' },
    { value: 'Spam', label: 'Spam / Excessive Posting' },
    { value: 'Payment fraud', label: 'Payment Issues' },
    { value: 'Other', label: 'Other' }
  ]
}

// Get all users
export const getAllUsers = async () => {
  try {
    console.log('Fetching all users from Supabase...')
    const { data, error, count } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    console.log('getAllUsers result:', { dataCount: data?.length, error, count })

    if (error) {
      console.error('Error in getAllUsers query:', error)
      throw error
    }
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { data: null, error }
  }
}

// Update user status (block/unblock)
export const updateUserStatus = async (userId, isActive) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: isActive })
      .eq('id', userId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating user status:', error)
    return { data: null, error }
  }
}

// Delete user
export const deleteUser = async (userId) => {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting user:', error)
    return { error }
  }
}

// Make user admin
export const updateUserRole = async (userId, isAdmin) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        is_admin: isAdmin,
        ...(isAdmin ? { is_employee: false } : {})
      })
      .eq('id', userId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating user role:', error)
    return { data: null, error }
  }
}

export const updateUserEmployeeStatus = async (userId, isEmployee) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_employee: isEmployee })
      .eq('id', userId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating employee status:', error)
    return { data: null, error }
  }
}

// ==================== PROPERTY MANAGEMENT ====================

const buildPropertyImageMap = (images = []) => {
  const imageMap = new Map()

  images.forEach((image) => {
    if (!image?.property_id) {
      return
    }

    const existingImages = imageMap.get(image.property_id) || []
    existingImages.push(image.image_url)
    imageMap.set(image.property_id, existingImages)
  })

  return imageMap
}

const normalizeAdminPropertyRecord = (property, imageMap = new Map()) => ({
  ...property,
  images: imageMap.get(property.id) || [],
  status: property.status || 'pending',
  is_featured: property.is_featured || false,
  location: {
    area: property.area,
    state_district: property.state_district,
  },
  pricing: {
    rent_amount_bdt: property.rent_amount_bdt,
    rent_period: property.rent_period,
  },
})

const fetchPropertyImages = async (propertyIds) => {
  if (!propertyIds?.length) {
    return []
  }

  const { data, error } = await supabase
    .from('property_images')
    .select('*')
    .in('property_id', propertyIds)
    .order('display_order')

  if (error) {
    throw error
  }

  return data || []
}

export const getAdminPropertyCounts = async () => {
  try {
    const [totalResult, approvedResult, pendingResult, rejectedResult] = await Promise.all([
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    ])

    const queryError =
      totalResult.error || approvedResult.error || pendingResult.error || rejectedResult.error

    if (queryError) {
      throw queryError
    }

    return {
      data: {
        total: totalResult.count || 0,
        approved: approvedResult.count || 0,
        pending: pendingResult.count || 0,
        rejected: rejectedResult.count || 0,
      },
      error: null,
    }
  } catch (error) {
    console.error('Error fetching property counts:', error)
    return {
      data: {
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      },
      error,
    }
  }
}

export const getAdminPropertiesPage = async ({ page = 1, pageSize = 20, status = 'all' } = {}) => {
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.max(1, Number(pageSize) || 20)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  try {
    let query = supabase
      .from('properties')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: properties, error, count } = await query

    if (error) {
      throw error
    }

    if (!properties?.length) {
      return {
        data: [],
        error: null,
        page: safePage,
        pageSize: safePageSize,
        totalCount: count || 0,
        hasMore: false,
      }
    }

    const propertyIds = properties.map((property) => property.id)
    const propertyImages = await fetchPropertyImages(propertyIds)
    const imageMap = buildPropertyImageMap(propertyImages)
    const propertiesWithImages = properties.map((property) =>
      normalizeAdminPropertyRecord(property, imageMap)
    )

    return {
      data: propertiesWithImages,
      error: null,
      page: safePage,
      pageSize: safePageSize,
      totalCount: count || 0,
      hasMore: from + propertiesWithImages.length < (count || 0),
    }
  } catch (error) {
    console.error('Error fetching paginated admin properties:', error)
    return {
      data: null,
      error,
      page: safePage,
      pageSize: safePageSize,
      totalCount: 0,
      hasMore: false,
    }
  }
}

// Get all properties with images
export const getAllProperties = async () => {
  try {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!properties || properties.length === 0) {
      return { data: [], error: null }
    }

    const propertyIds = properties.map((p) => p.id)
    const propertyImages = await fetchPropertyImages(propertyIds)
    const imageMap = buildPropertyImageMap(propertyImages)
    const propertiesWithImages = properties.map((property) =>
      normalizeAdminPropertyRecord(property, imageMap)
    )

    return { data: propertiesWithImages, error: null }
  } catch (error) {
    console.error('Error fetching properties:', error)
    return { data: null, error }
  }
}

// Update property status (approve/reject/pending)
export const updatePropertyStatus = async (propertyId, status) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .update({
        status: status,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', propertyId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating property status:', error)
    return { data: null, error }
  }
}

export const approveAllPendingProperties = async () => {
  try {
    const reviewedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('properties')
      .update({
        status: 'approved',
        reviewed_at: reviewedAt
      })
      .eq('status', 'pending')
      .select('id')

    if (error) throw error

    return {
      data: {
        approvedCount: data?.length || 0,
        properties: data || []
      },
      error: null
    }
  } catch (error) {
    console.error('Error approving all pending properties:', error)
    return { data: null, error }
  }
}

// Delete property
export const deleteProperty = async (propertyId) => {
  try {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting property:', error)
    return { error }
  }
}

// Toggle property featured status
export const togglePropertyFeatured = async (propertyId, isFeatured) => {
  try {
    const { data, error } = await supabase
      .from('properties')
      .update({ is_featured: isFeatured })
      .eq('id', propertyId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error toggling featured status:', error)
    return { data: null, error }
  }
}

// ==================== FEEDBACK MANAGEMENT ====================

// Get all feedback
export const getAllFeedback = async () => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      const handled = handleTableNotFoundError(error, 'feedback')
      if (handled.data !== null) return handled
      throw error
    }
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return { data: [], error: null }
  }
}

// Delete feedback
export const deleteFeedback = async (feedbackId) => {
  try {
    const { error } = await supabase
      .from('feedback')
      .delete()
      .eq('id', feedbackId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting feedback:', error)
    return { error }
  }
}

// Mark feedback as resolved
export const updateFeedbackStatus = async (feedbackId, isResolved) => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .update({ is_resolved: isResolved })
      .eq('id', feedbackId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating feedback status:', error)
    return { data: null, error }
  }
}

// Approve feedback (make it visible on homepage)
export const approveFeedback = async (feedbackId, userId) => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId
      })
      .eq('id', feedbackId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error approving feedback:', error)
    return { data: null, error }
  }
}

// Reject feedback (hide from homepage)
export const rejectFeedback = async (feedbackId, userId) => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId
      })
      .eq('id', feedbackId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error rejecting feedback:', error)
    return { data: null, error }
  }
}

// ==================== ORDERS MANAGEMENT ====================

// Get all orders
export const getAllOrders = async () => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        users(name, email)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching orders:', error)
    return { data: null, error }
  }
}

// Update order status
export const updateOrderStatus = async (orderId, status) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: status })
      .eq('id', orderId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating order status:', error)
    return { data: null, error }
  }
}

export const updateOrderJobFeed = async (orderId, updates) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating order job feed:', error)
    return { data: null, error }
  }
}

// Delete order
export const deleteOrder = async (orderId) => {
  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting order:', error)
    return { error }
  }
}

// ==================== PROPERTY INQUIRIES ====================

// Get all property inquiries
export const getAllPropertyInquiries = async () => {
  try {
    const { data, error } = await supabase
      .from('property_inquiries')
      .select(`
        *,
        properties(id, category, short_description, state_district, area)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      const handled = handleTableNotFoundError(error, 'property_inquiries')
      if (handled.data !== null) return handled
      throw error
    }
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching property inquiries:', error)
    return { data: [], error: null }
  }
}

// Update inquiry status
export const updateInquiryStatus = async (inquiryId, status) => {
  try {
    const { data, error } = await supabase
      .from('property_inquiries')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', inquiryId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating inquiry status:', error)
    return { data: null, error }
  }
}

// Delete inquiry
export const deleteInquiry = async (inquiryId) => {
  try {
    const { error } = await supabase
      .from('property_inquiries')
      .delete()
      .eq('id', inquiryId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting inquiry:', error)
    return { error }
  }
}

// ==================== PAYMENT TRANSACTIONS ====================

// Get all payment transactions
export const getAllPaymentTransactions = async () => {
  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        users(name, email),
        credit_packages(package_name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      const handled = handleTableNotFoundError(error, 'payment_transactions')
      if (handled.data !== null) return handled
      throw error
    }
    return { data: (data || []).map(mapPaymentTransactionRecord), error: null }
  } catch (error) {
    console.error('Error fetching payment transactions:', error)
    return { data: [], error: null }
  }
}

// Get payment transactions by status
export const getPaymentTransactionsByStatus = async (status) => {
  try {
    let query = supabase
      .from('payment_transactions')
      .select(`
        *,
        users(name, email),
        credit_packages(package_name)
      `)
      .order('created_at', { ascending: false })

    query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      const handled = handleTableNotFoundError(error, 'payment_transactions')
      if (handled.data !== null) return handled
      throw error
    }
    return { data: (data || []).map(mapPaymentTransactionRecord), error: null }
  } catch (error) {
    console.error('Error fetching payment transactions by status:', error)
    return { data: [], error: null }
  }
}

// Get payment transactions by user
export const getPaymentTransactionsByUser = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      const handled = handleTableNotFoundError(error, 'payment_transactions')
      if (handled.data !== null) return handled
      throw error
    }
    return { data: (data || []).map(mapPaymentTransactionRecord), error: null }
  } catch (error) {
    console.error('Error fetching user transactions:', error)
    return { data: [], error: null }
  }
}

// Update transaction status
export const updateTransactionStatus = async (transactionId, status) => {
  try {
    const { data, error } = await supabase
      .from('payment_transactions')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .select('*')
      .maybeSingle()

    if (error) throw error
    return {
      data: mapPaymentTransactionRecord(
        ensureSingleMutationResult(data, 'Payment transaction')
      ),
      error: null
    }
  } catch (error) {
    console.error('Error updating transaction status:', error)
    return { data: null, error }
  }
}

export const approvePaymentTransaction = async (transactionId) => {
  try {
    const response = await authenticatedJsonRequest(`/api/admin/payments/${transactionId}/approve`, {
      method: 'POST'
    })

    return {
      data: mapPaymentTransactionRecord(response?.data || {}),
      error: null
    }
  } catch (error) {
    console.error('Error approving payment transaction:', error)
    return { data: null, error }
  }
}

// Get transaction statistics
export const getTransactionStats = async () => {
  try {
    const { data: allTransactions, error } = await supabase
      .from('payment_transactions')
      .select('status, amount')

    if (error) {
      const handled = handleTableNotFoundError(error, 'payment_transactions')
      if (handled.data !== null) {
        return {
          data: {
            totalTransactions: 0,
            totalRevenue: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            pendingTransactions: 0
          },
          error: null
        }
      }
      throw error
    }

    const stats = {
      totalTransactions: allTransactions?.length || 0,
      totalRevenue: allTransactions?.reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0,
      successfulTransactions: allTransactions?.filter(t => t.status === 'credited').length || 0,
      failedTransactions: allTransactions?.filter(t => t.status === 'failed').length || 0,
      pendingTransactions:
        allTransactions?.filter(t => t.status === 'pending' || t.status === 'awaiting_admin_approval').length || 0
    }

    return { data: stats, error: null }
  } catch (error) {
    console.error('Error fetching transaction stats:', error)
    return {
      data: {
        totalTransactions: 0,
        totalRevenue: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        pendingTransactions: 0
      },
      error: null
    }
  }
}

// ==================== ANALYTICS ====================

// Get dashboard statistics
export const getDashboardStats = async () => {
  console.log('Fetching dashboard stats...')

  try {
    const [usersResult, propsResult, ordersResult, pendingResult] = await Promise.allSettled([
      getAllUsers(),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    const allUsers = usersResult.status === 'fulfilled' ? (usersResult.value.data || []) : []
    const totalUsers = allUsers.filter(user => user.is_admin === true).length
    const activeUsers = allUsers.filter(user => user.is_admin === true && user.is_active !== false).length
    const totalProperties = propsResult.status === 'fulfilled' ? (propsResult.value.count || 0) : 0
    const totalOrders = ordersResult.status === 'fulfilled' ? (ordersResult.value.count || 0) : 0
    const pendingProperties = pendingResult.status === 'fulfilled' ? (pendingResult.value.count || 0) : 0

    // Get feedback count from localStorage
    const feedbackData = JSON.parse(localStorage.getItem('userFeedback') || '[]')
    const totalFeedback = feedbackData.length

    const statsData = {
      totalUsers,
      activeUsers,
      totalProperties,
      pendingProperties,
      totalOrders,
      totalFeedback
    }

    console.log('Final dashboard stats:', statsData)

    return {
      data: statsData,
      error: null
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return {
      data: {
        totalUsers: 0,
        activeUsers: 0,
        totalProperties: 0,
        pendingProperties: 0,
        totalOrders: 0,
        totalFeedback: 0
      },
      error: null
    }
  }
}

export const getDailyListingReport = async (days = 7) => {
  const safeDays = Math.max(1, days)
  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  startDate.setDate(startDate.getDate() - (safeDays - 1))

  try {
    const { data, error } = await supabase
      .from('properties')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    const countsByDay = {}
    for (let offset = 0; offset < safeDays; offset += 1) {
      const day = new Date(startDate)
      day.setDate(startDate.getDate() + offset)
      countsByDay[getLocalDateKey(day)] = 0
    }

    ;(data || []).forEach((property) => {
      if (!property.created_at) {
        return
      }

      const dateKey = getLocalDateKey(property.created_at)
      if (dateKey in countsByDay) {
        countsByDay[dateKey] += 1
      }
    })

    const dailyCounts = Object.entries(countsByDay).map(([date, count]) => ({
      date,
      label: formatReportLabel(date),
      count
    }))

    return {
      data: {
        days: safeDays,
        dailyCounts,
        totalNewListings: dailyCounts.reduce((sum, item) => sum + item.count, 0),
        todaysNewListings: dailyCounts[dailyCounts.length - 1]?.count || 0
      },
      error: null
    }
  } catch (error) {
    console.error('Error fetching daily listing report:', error)

    const fallbackDays = []
    for (let offset = 0; offset < safeDays; offset += 1) {
      const day = new Date(startDate)
      day.setDate(startDate.getDate() + offset)
      const dateKey = getLocalDateKey(day)
      fallbackDays.push({
        date: dateKey,
        label: formatReportLabel(dateKey),
        count: 0
      })
    }

    return {
      data: {
        days: safeDays,
        dailyCounts: fallbackDays,
        totalNewListings: 0,
        todaysNewListings: 0
      },
      error: null
    }
  }
}

const buildEmptyEmployeeListingReport = (safeDays, startDate) => {
  const dailyRows = []

  for (let offset = 0; offset < safeDays; offset += 1) {
    const day = new Date(startDate)
    day.setDate(startDate.getDate() + offset)
    const dateKey = getLocalDateKey(day)

    dailyRows.push({
      date: dateKey,
      label: formatReportLabel(dateKey),
      countsByEmployeeId: {},
      total: 0
    })
  }

  return {
    days: safeDays,
    employees: [],
    dailyRows,
    todayCountsByEmployeeId: {},
    todayTotal: 0,
    totalsByEmployeeId: {},
    grandTotal: 0
  }
}

export const getDailyEmployeeWiseListingReport = async (days = 7) => {
  const safeDays = Math.max(1, days)
  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)
  startDate.setDate(startDate.getDate() - (safeDays - 1))
  const todayDateKey = getLocalDateKey(new Date())

  const emptyReport = buildEmptyEmployeeListingReport(safeDays, startDate)

  try {
    const [recentPropertiesResult, propertyOwnersResult, usersResult] = await Promise.all([
      supabase
        .from('properties')
        .select('created_at, user_id')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true }),
      supabase
        .from('properties')
        .select('user_id'),
      getAllUsers()
    ])

    if (recentPropertiesResult.error) throw recentPropertiesResult.error
    if (propertyOwnersResult.error) throw propertyOwnersResult.error
    if (usersResult.error) throw usersResult.error

    const usersById = new Map(
      (usersResult.data || [])
        .filter((user) => user?.id)
        .map((user) => [user.id, user])
    )

    const employeeIds = Array.from(
      new Set(
        (propertyOwnersResult.data || [])
          .map((property) => property?.user_id)
          .filter(Boolean)
      )
    )

    const employees = employeeIds
      .map((employeeId) => {
        const user = usersById.get(employeeId)
        return {
          id: employeeId,
          name: user?.name || user?.email || 'Employee',
          email: user?.email || ''
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name))
    const employeeIdSet = new Set(employeeIds)

    if (employees.length === 0) {
      return { data: emptyReport, error: null }
    }

    const dailyCountsByEmployee = {}
    const todayCountsByEmployeeId = Object.fromEntries(employees.map((employee) => [employee.id, 0]))

    ;(recentPropertiesResult.data || []).forEach((property) => {
      if (!property?.created_at || !property?.user_id || !employeeIdSet.has(property.user_id)) {
        return
      }

      const dateKey = getLocalDateKey(property.created_at)
      if (!dailyCountsByEmployee[dateKey]) {
        dailyCountsByEmployee[dateKey] = {}
      }

      dailyCountsByEmployee[dateKey][property.user_id] =
        (dailyCountsByEmployee[dateKey][property.user_id] || 0) + 1

      if (dateKey === todayDateKey) {
        todayCountsByEmployeeId[property.user_id] += 1
      }
    })

    const totalsByEmployeeId = Object.fromEntries(employees.map((employee) => [employee.id, 0]))

    const dailyRows = emptyReport.dailyRows.map((day) => {
      const rawCounts = dailyCountsByEmployee[day.date] || {}
      const countsByEmployeeId = {}
      let total = 0

      employees.forEach((employee) => {
        const count = rawCounts[employee.id] || 0
        countsByEmployeeId[employee.id] = count
        totalsByEmployeeId[employee.id] += count
        total += count
      })

      return {
        ...day,
        countsByEmployeeId,
        total
      }
    })

    const grandTotal = dailyRows.reduce((sum, day) => sum + day.total, 0)
    const todayTotal = Object.values(todayCountsByEmployeeId).reduce((sum, count) => sum + count, 0)

    return {
      data: {
        days: safeDays,
        employees,
        dailyRows,
        todayCountsByEmployeeId,
        todayTotal,
        totalsByEmployeeId,
        grandTotal
      },
      error: null
    }
  } catch (error) {
    console.error('Error fetching daily employee-wise listing report:', error)
    return { data: emptyReport, error: null }
  }
}

// Get recent activities
export const getRecentActivities = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      const handled = handleTableNotFoundError(error, 'activities')
      if (handled.data !== null) return handled
      throw error
    }
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching recent activities:', error)
    return { data: [], error: null }
  }
}

// ==================== CREDIT PACKAGE MANAGEMENT ====================

// Default credit costs
const DEFAULT_CREDIT_COSTS = {
  property_listing: 20,
  contact_view: 10,
  photo_view: 10
}

const CREDIT_SETTINGS_ROW_ID = true

const readLocalJson = (key, fallback) => {
  try {
    if (typeof window === 'undefined') {
      return fallback
    }

    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error)
    return fallback
  }
}

const writeLocalJson = (key, value) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (error) {
    console.error(`Error writing localStorage key "${key}":`, error)
  }
}

const ensureSingleMutationResult = (data, entityName) => {
  if (!data) {
    throw new Error(`${entityName} not found`)
  }

  return data
}

const mapCreditPackageRecord = (record, fallbackIndex = 0) => ({
  id: record.id,
  name: record.package_name || record.name || `Package ${fallbackIndex + 1}`,
  credits: Number(record.credits_amount ?? record.credits ?? 0),
  price: Number(record.price_bdt ?? record.price ?? 0),
  discount: Number(record.discount_percentage ?? record.discount ?? 0),
  popular: Boolean(record.is_popular ?? record.popular ?? false),
  is_active: record.active ?? record.is_active ?? true
})

const buildCreditPackagePayload = (packageData, includeOptionalFields = true) => {
  const payload = {
    package_name: packageData.name,
    credits_amount: Number(packageData.credits),
    price_bdt: Number(packageData.price),
    active: packageData.is_active ?? true
  }

  if (includeOptionalFields) {
    payload.discount_percentage = Number(packageData.discount || 0)
    payload.is_popular = Boolean(packageData.popular)
  }

  return payload
}

const mapCreditSettingsRecord = (record) => ({
  property_listing: Number(record?.property_listing ?? DEFAULT_CREDIT_COSTS.property_listing),
  contact_view: Number(record?.contact_view ?? DEFAULT_CREDIT_COSTS.contact_view),
  photo_view: Number(record?.photo_view ?? DEFAULT_CREDIT_COSTS.photo_view)
})

const mapPaymentTransactionRecord = (record) => ({
  ...record,
  amount: Number(record?.amount ?? record?.amount_bdt ?? 0),
  credits_to_add: Number(record?.credits_to_add ?? 0),
  transaction_id: record?.transaction_id || record?.invoice_id || record?.id,
  invoice_id: record?.invoice_id || record?.reference || null,
  description: record?.description || `${Number(record?.credits_to_add ?? 0)} credits purchase`,
  status:
    record?.status === 'paid' || record?.status === 'success'
      ? 'credited'
      : record?.status === 'created'
        ? 'pending'
        : (record?.status || 'pending'),
  raw_status: record?.status,
  payment_method: record?.payment_method ? String(record.payment_method).toLowerCase() : null
})

const isMissingColumnError = (error) =>
  error?.code === 'PGRST204' ||
  error?.message?.includes('Could not find the') ||
  error?.message?.includes('column') ||
  error?.details?.includes?.('column')

const isMissingTableError = (error) =>
  error?.code === 'PGRST205' ||
  error?.message?.includes('Could not find the table')

const SITE_THEME_STORAGE_KEY = 'siteTheme'
const SITE_THEME_SETTING_KEY = 'site_theme'
const DEFAULT_SITE_THEME = 'light'
const AUTO_APPROVE_STORAGE_KEY = 'autoApproveProperties'
const AUTO_APPROVE_SETTING_KEY = 'auto_approve_properties'

const normalizeSiteTheme = (value) => (value === 'dark' ? 'dark' : DEFAULT_SITE_THEME)
const normalizeAutoApproveProperties = (value) =>
  value === true || value === 'true' || value === 1 || value === '1'

const getSiteThemeFromKeyValueSettings = async () => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', SITE_THEME_SETTING_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return normalizeSiteTheme(data.setting_value)
}

const saveSiteThemeToKeyValueSettings = async (theme) => {
  const { data, error } = await supabase
    .from('site_settings')
    .upsert(
      {
        setting_key: SITE_THEME_SETTING_KEY,
        setting_value: normalizeSiteTheme(theme)
      },
      { onConflict: 'setting_key' }
    )
    .select()

  if (error) {
    throw error
  }

  return data
}

const getSiteThemeFromFlatSettings = async () => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('id, site_theme')
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return normalizeSiteTheme(data.site_theme)
}

const saveSiteThemeToFlatSettings = async (theme) => {
  const { data: existingRow, error: selectError } = await supabase
    .from('site_settings')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (selectError) {
    throw selectError
  }

  const payload = {
    ...(existingRow?.id ? { id: existingRow.id } : {}),
    site_theme: normalizeSiteTheme(theme)
  }

  const { data, error } = await supabase
    .from('site_settings')
    .upsert(payload)
    .select()

  if (error) {
    throw error
  }

  return data
}

const getAutoApproveFromKeyValueSettings = async () => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', AUTO_APPROVE_SETTING_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return normalizeAutoApproveProperties(data.setting_value)
}

const saveAutoApproveToKeyValueSettings = async (enabled) => {
  const normalizedValue = normalizeAutoApproveProperties(enabled)

  const { data, error } = await supabase
    .from('site_settings')
    .upsert(
      {
        setting_key: AUTO_APPROVE_SETTING_KEY,
        setting_value: String(normalizedValue)
      },
      { onConflict: 'setting_key' }
    )
    .select()

  if (error) {
    throw error
  }

  return data
}

const getAutoApproveFromFlatSettings = async () => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('id, auto_approve_properties')
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return normalizeAutoApproveProperties(data.auto_approve_properties)
}

const saveAutoApproveToFlatSettings = async (enabled) => {
  const normalizedValue = normalizeAutoApproveProperties(enabled)

  const { data: existingRow, error: selectError } = await supabase
    .from('site_settings')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (selectError) {
    throw selectError
  }

  const payload = {
    ...(existingRow?.id ? { id: existingRow.id } : {}),
    auto_approve_properties: normalizedValue
  }

  const { data, error } = await supabase
    .from('site_settings')
    .upsert(payload)
    .select()

  if (error) {
    throw error
  }

  return data
}

const getCreditCostsFromTable = async () => {
  const { data, error } = await supabase
    .from('credit_settings')
    .select('property_listing, contact_view, photo_view')
    .eq('id', CREDIT_SETTINGS_ROW_ID)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return { ...DEFAULT_CREDIT_COSTS }
  }

  return mapCreditSettingsRecord(data)
}

const saveCreditCostsToTable = async (costs) => {
  const payload = {
    id: CREDIT_SETTINGS_ROW_ID,
    property_listing: Number(costs.property_listing),
    contact_view: Number(costs.contact_view),
    photo_view: Number(costs.photo_view)
  }

  const { data, error } = await supabase
    .from('credit_settings')
    .upsert(payload, { onConflict: 'id' })
    .select()

  if (error) {
    throw error
  }

  return data
}

export const getCreditPackages = async () => {
  try {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .order('credits_amount', { ascending: true })

    if (error) {
      const handled = handleTableNotFoundError(error, 'credit_packages')
      if (handled.data !== null) {
        return []
      }
      throw error
    }

    return (data || []).map((record, index) => mapCreditPackageRecord(record, index))
  } catch (error) {
    console.error('Error getting credit packages:', error)
    return []
  }
}

export const saveCreditPackages = async (packages) => {
  try {
    const payload = packages.map((packageData) => ({
      id: packageData.id,
      ...buildCreditPackagePayload(packageData, true)
    }))

    const { error } = await supabase
      .from('credit_packages')
      .upsert(payload)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error('Error saving credit packages:', error)
    return { success: false, error }
  }
}

export const addCreditPackage = async (packageData) => {
  try {
    let result = await supabase
      .from('credit_packages')
      .insert(buildCreditPackagePayload(packageData, true))
      .select()

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase
        .from('credit_packages')
        .insert(buildCreditPackagePayload(packageData, false))
        .select()
    }

    if (result.error) {
      throw result.error
    }

    const normalized = mapCreditPackageRecord(
      ensureSingleMutationResult(result.data?.[0], 'Credit package'),
      0
    )

    return { data: normalized, error: null }
  } catch (error) {
    console.error('Error adding credit package:', error)
    return { data: null, error }
  }
}

export const updateCreditPackage = async (packageId, updateData) => {
  try {
    let result = await supabase
      .from('credit_packages')
      .update(buildCreditPackagePayload(updateData, true))
      .eq('id', packageId)
      .select()

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase
        .from('credit_packages')
        .update(buildCreditPackagePayload(updateData, false))
        .eq('id', packageId)
        .select()
    }

    if (result.error) {
      throw result.error
    }

    const normalized = mapCreditPackageRecord(
      ensureSingleMutationResult(result.data?.[0], 'Credit package'),
      0
    )

    return { data: normalized, error: null }
  } catch (error) {
    console.error('Error updating credit package:', error)
    return { data: null, error }
  }
}

export const deleteCreditPackage = async (packageId) => {
  try {
    const { data, error } = await supabase
      .from('credit_packages')
      .delete()
      .eq('id', packageId)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }
    ensureSingleMutationResult(data, 'Credit package')

    return { error: null }
  } catch (error) {
    console.error('Error deleting credit package:', error)
    return { error }
  }
}

export const togglePackageStatus = async (packageId) => {
  try {
    const packages = await getCreditPackages()
    const targetPackage = packages.find((pkg) => pkg.id === packageId)

    if (!targetPackage) {
      return { data: null, error: new Error('Package not found') }
    }

    return updateCreditPackage(packageId, {
      ...targetPackage,
      is_active: !targetPackage.is_active
    })
  } catch (error) {
    console.error('Error toggling package status:', error)
    return { data: null, error }
  }
}

export const getCreditCosts = async () => {
  try {
    return await getCreditCostsFromTable()
  } catch (error) {
    console.error('Error getting credit costs:', error)
    return { ...DEFAULT_CREDIT_COSTS }
  }
}

export const saveCreditCosts = async (costs) => {
  const normalizedCosts = {
    property_listing: Number(costs.property_listing ?? DEFAULT_CREDIT_COSTS.property_listing),
    contact_view: Number(costs.contact_view ?? DEFAULT_CREDIT_COSTS.contact_view),
    photo_view: Number(costs.photo_view ?? DEFAULT_CREDIT_COSTS.photo_view)
  }

  try {
    await saveCreditCostsToTable(normalizedCosts)
    return { success: true, error: null }
  } catch (error) {
    console.error('Error saving credit costs:', error)
    return { success: false, error }
  }
}

export const getSiteTheme = async () => {
  try {
    let theme = null

    try {
      theme = await getSiteThemeFromKeyValueSettings()
    } catch (error) {
      if (!isMissingColumnError(error)) {
        console.warn('Unable to read key/value site theme setting:', error)
      }
    }

    if (!theme) {
      try {
        theme = await getSiteThemeFromFlatSettings()
      } catch (error) {
        if (!isMissingColumnError(error)) {
          console.warn('Unable to read flat site theme setting:', error)
        }
      }
    }

    const normalizedTheme = normalizeSiteTheme(
      theme || readLocalJson(SITE_THEME_STORAGE_KEY, DEFAULT_SITE_THEME)
    )
    writeLocalJson(SITE_THEME_STORAGE_KEY, normalizedTheme)
    return normalizedTheme
  } catch (error) {
    console.error('Error getting site theme:', error)
    return normalizeSiteTheme(readLocalJson(SITE_THEME_STORAGE_KEY, DEFAULT_SITE_THEME))
  }
}

export const saveSiteTheme = async (theme) => {
  const normalizedTheme = normalizeSiteTheme(theme)

  try {
    try {
      await saveSiteThemeToFlatSettings(normalizedTheme)
    } catch (flatError) {
      if (!isMissingColumnError(flatError)) {
        console.warn('Unable to save flat site theme setting:', flatError)
      }
      await saveSiteThemeToKeyValueSettings(normalizedTheme)
    }

    writeLocalJson(SITE_THEME_STORAGE_KEY, normalizedTheme)
    return { success: true, error: null, theme: normalizedTheme }
  } catch (error) {
    console.error('Error saving site theme:', error)
    writeLocalJson(SITE_THEME_STORAGE_KEY, normalizedTheme)
    return { success: false, error, theme: normalizedTheme }
  }
}

// Update user credits manually (admin)
export const updateUserCredits = async (userId, credits, action = 'set') => {
  try {
    let newCredits = credits

    if (action === 'add' || action === 'subtract') {
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('credits')
        .eq('id', userId)
        .single()

      if (fetchError) throw fetchError

      const currentCredits = user?.credits || 0
      newCredits = action === 'add' ? currentCredits + credits : Math.max(0, currentCredits - credits)
    }

    const { data, error } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('id', userId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating user credits:', error)
    return { data: null, error }
  }
}

// Get all users with credits
export const getAllUsersWithCredits = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, credits, is_active')
      .order('credits', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching users with credits:', error)
    return { data: [], error }
  }
}

// ==================== SITE SETTINGS ====================

// Get site settings
export const getSiteSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .single()

    if (error) {
      const handled = handleTableNotFoundError(error, 'site_settings')
      if (handled.data !== null) return { data: {}, error: null }
      throw error
    }
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching site settings:', error)
    return { data: {}, error: null }
  }
}

// Update site settings
export const updateSiteSettings = async (settings) => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .upsert(settings)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating site settings:', error)
    return { data: null, error }
  }
}

// Get auto-approve properties setting
export const getAutoApproveProperties = async () => {
  try {
    let autoApproveValue = null
    let source = 'local_storage'
    let missingTable = false

    try {
      autoApproveValue = await getAutoApproveFromFlatSettings()
      if (autoApproveValue !== null) {
        source = 'site_settings_flat'
      }
    } catch (error) {
      if (isMissingTableError(error)) {
        missingTable = true
      }
      if (!isMissingColumnError(error)) {
        console.warn('Unable to read flat auto-approve setting:', error)
      }
    }

    if (autoApproveValue === null) {
      try {
        autoApproveValue = await getAutoApproveFromKeyValueSettings()
        if (autoApproveValue !== null) {
          source = 'site_settings_key_value'
          missingTable = false
        }
      } catch (error) {
        if (isMissingTableError(error)) {
          missingTable = true
        }
        if (!isMissingColumnError(error)) {
          console.warn('Unable to read key/value auto-approve setting:', error)
        }
      }
    }

    const normalizedValue = normalizeAutoApproveProperties(
      autoApproveValue ?? readLocalJson(AUTO_APPROVE_STORAGE_KEY, false)
    )
    writeLocalJson(AUTO_APPROVE_STORAGE_KEY, normalizedValue)

    return {
      data: { auto_approve_properties: normalizedValue },
      error: null,
      meta: {
        source,
        isFallback: source === 'local_storage',
        missingTable
      }
    }
  } catch (error) {
    console.error('Error fetching auto-approve setting:', error)
    const fallbackValue = normalizeAutoApproveProperties(
      readLocalJson(AUTO_APPROVE_STORAGE_KEY, false)
    )
    return {
      data: {
        auto_approve_properties: fallbackValue
      },
      error: null,
      meta: {
        source: 'local_storage',
        isFallback: true,
        missingTable: isMissingTableError(error)
      }
    }
  }
}

// Toggle auto-approve properties setting
export const toggleAutoApproveProperties = async (enabled) => {
  const normalizedValue = normalizeAutoApproveProperties(enabled)

  try {
    let source = 'site_settings_flat'

    try {
      await saveAutoApproveToFlatSettings(normalizedValue)
    } catch (flatError) {
      if (isMissingTableError(flatError)) {
        source = 'local_storage'
      }
      if (!isMissingColumnError(flatError)) {
        console.warn('Unable to save flat auto-approve setting:', flatError)
      }
      await saveAutoApproveToKeyValueSettings(normalizedValue)
      source = 'site_settings_key_value'
    }

    writeLocalJson(AUTO_APPROVE_STORAGE_KEY, normalizedValue)
    return {
      data: { auto_approve_properties: normalizedValue },
      error: null,
      meta: {
        source,
        isFallback: false,
        missingTable: false
      }
    }
  } catch (error) {
    console.error('Error toggling auto-approve setting:', error)
    writeLocalJson(AUTO_APPROVE_STORAGE_KEY, normalizedValue)
    return {
      data: { auto_approve_properties: normalizedValue },
      error,
      meta: {
        source: 'local_storage',
        isFallback: true,
        missingTable: isMissingTableError(error)
      }
    }
  }
}
