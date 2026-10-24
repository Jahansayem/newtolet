import { isRecoverableSupabaseError, supabase } from './supabaseClient'

const PROPERTY_IMAGES_BUCKET = 'property-images'
const MAX_LISTING_REPORT_DAYS = 90
const LISTING_REPORT_STATUSES = ['approved', 'pending']

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

const normalizeReportBoundary = (value, endOfDay = false) => {
  if (value instanceof Date) {
    const normalizedDate = new Date(value)
    normalizedDate.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0)
    return normalizedDate
  }

  if (typeof value === 'string' && value.trim()) {
    const normalizedDate = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)

    if (!Number.isNaN(normalizedDate.getTime())) {
      return normalizedDate
    }
  }

  return null
}

const normalizeReportRange = (rangeOrDays = 7) => {
  if (typeof rangeOrDays === 'number') {
    const safeDays = Math.min(MAX_LISTING_REPORT_DAYS, Math.max(1, rangeOrDays))
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    startDate.setDate(startDate.getDate() - (safeDays - 1))

    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    return {
      startDate,
      endDate,
      startDateKey: getLocalDateKey(startDate),
      endDateKey: getLocalDateKey(endDate),
      totalDays: safeDays,
    }
  }

  const nextStartDate = normalizeReportBoundary(rangeOrDays?.startDate, false)
  const nextEndDate = normalizeReportBoundary(rangeOrDays?.endDate, true)

  if (!nextStartDate || !nextEndDate || nextStartDate.getTime() > nextEndDate.getTime()) {
    return normalizeReportRange(7)
  }

  const requestedTotalDays =
    Math.floor((nextEndDate.getTime() - nextStartDate.getTime()) / 86400000) + 1
  const totalDays = Math.min(MAX_LISTING_REPORT_DAYS, Math.max(1, requestedTotalDays))
  const safeEndDate = new Date(nextStartDate)
  safeEndDate.setDate(nextStartDate.getDate() + (totalDays - 1))
  safeEndDate.setHours(23, 59, 59, 999)

  return {
    startDate: nextStartDate,
    endDate: safeEndDate,
    startDateKey: getLocalDateKey(nextStartDate),
    endDateKey: getLocalDateKey(safeEndDate),
    totalDays,
  }
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

// Blacklist / moderation now run through actor-safe RPCs (src/services/admin/users.js);
// the acting admin is auth.uid() on the server and is never passed from the browser.
export {
  blacklistUser,
  unblacklistUser,
  checkUserBlacklist,
  getBlacklistReasons,
  setUserActive,
  setEmployeeFlag,
  setUserRoles,
  adjustUserCredits,
} from './admin/users'

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
// Property moderation lives in src/services/admin/properties.js (indexed duplicate
// detection via contact_phone_key + RPCs, bulk status / featured / soft delete via
// actor-safe RPCs). Old names are kept as compatibility wrappers.
export {
  listProperties,
  getProperty,
  listDuplicatePhoneGroups,
  getPropertyCounts,
  setPropertyStatus,
  approveAllPending,
  setPropertyFeatured,
  softDeleteProperty,
  getAdminPropertiesPage,
  getAdminPropertiesByPhoneGroup,
  getAdminDuplicatePhoneGroupsPage,
  getAdminPropertyCounts,
  updatePropertyStatus,
  updatePropertiesStatus,
  approveAllPendingProperties,
  deleteProperty,
  togglePropertyFeatured,
} from './admin/properties'

// ==================== FEEDBACK / ORDERS / INQUIRIES / PAYMENTS ====================
// These domains now live in src/services/admin/* (server-side pagination, RPC-backed
// mutations with the actor derived from auth.uid(), archive instead of delete).
// The old names are kept as compatibility wrappers.
export {
  listFeedback,
  reviewFeedback,
  archiveFeedback,
  getAllFeedback,
  deleteFeedback,
  updateFeedbackStatus,
  approveFeedback,
  rejectFeedback,
} from './admin/feedback'
export {
  listOrders,
  setOrderStatus,
  setOrderJobFeed,
  setOrderAssignee,
  archiveOrder,
  getAllOrders,
  updateOrderStatus,
  updateOrderJobFeed,
  deleteOrder,
} from './admin/orders'
export {
  listInquiries,
  updateInquiry,
  archiveInquiry,
  getAllPropertyInquiries,
  updateInquiryStatus,
  deleteInquiry,
} from './admin/inquiries'
export {
  listPayments,
  getPayment,
  approvePayment,
  reviewPayment,
  refundPayment,
  exportPaymentsCsv,
  approvePaymentTransaction,
  getAllPaymentTransactions,
  getPaymentTransactionsByStatus,
} from './admin/payments'

// ==================== ANALYTICS ====================

// Dashboard statistics: head counts for every metric (all users, not only
// admins; feedback from the database, not localStorage), with per-metric
// errors surfaced instead of zeros. See src/services/admin/dashboard.js.
export { getDashboardStats, getAdminQueueCounts, readQueueCountsSnapshot } from './admin/dashboard'

export const getDailyListingReport = async (rangeOrDays = 7) => {
  const range = normalizeReportRange(rangeOrDays)

  try {
    const { data, error } = await supabase
      .from('properties')
      .select('created_at')
      .in('status', LISTING_REPORT_STATUSES)
      .gte('created_at', range.startDate.toISOString())
      .lte('created_at', range.endDate.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    const countsByDay = {}
    for (let offset = 0; offset < range.totalDays; offset += 1) {
      const day = new Date(range.startDate)
      day.setDate(range.startDate.getDate() + offset)
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
        days: range.totalDays,
        totalDays: range.totalDays,
        startDate: range.startDateKey,
        endDate: range.endDateKey,
        dailyCounts,
        totalNewListings: dailyCounts.reduce((sum, item) => sum + item.count, 0),
        todaysNewListings: dailyCounts[dailyCounts.length - 1]?.count || 0
      },
      error: null
    }
  } catch (error) {
    console.error('Error fetching daily listing report:', error)

    const fallbackDays = []
    for (let offset = 0; offset < range.totalDays; offset += 1) {
      const day = new Date(range.startDate)
      day.setDate(range.startDate.getDate() + offset)
      const dateKey = getLocalDateKey(day)
      fallbackDays.push({
        date: dateKey,
        label: formatReportLabel(dateKey),
        count: 0
      })
    }

    return {
      data: {
        days: range.totalDays,
        totalDays: range.totalDays,
        startDate: range.startDateKey,
        endDate: range.endDateKey,
        dailyCounts: fallbackDays,
        totalNewListings: 0,
        todaysNewListings: 0
      },
      error
    }
  }
}

const buildEmptySubmitterListingReport = (range) => {
  const dailyRows = []

  for (let offset = 0; offset < range.totalDays; offset += 1) {
    const day = new Date(range.startDate)
    day.setDate(range.startDate.getDate() + offset)
    const dateKey = getLocalDateKey(day)

    dailyRows.push({
      date: dateKey,
      label: formatReportLabel(dateKey),
      countsBySubmitterId: {},
      total: 0
    })
  }

  return {
    days: range.totalDays,
    totalDays: range.totalDays,
    startDate: range.startDateKey,
    endDate: range.endDateKey,
    submitters: [],
    dailyRows,
    todayCountsBySubmitterId: {},
    todayTotal: 0,
    totalsBySubmitterId: {},
    grandTotal: 0
  }
}

export const getDailySubmitterWiseListingReport = async (rangeOrDays = 7) => {
  const range = normalizeReportRange(rangeOrDays)
  const todayDateKey = getLocalDateKey(new Date())

  const emptyReport = buildEmptySubmitterListingReport(range)

  try {
    const [recentPropertiesResult, usersResult] = await Promise.all([
      supabase
        .from('properties')
        .select('created_at, user_id')
        .in('status', LISTING_REPORT_STATUSES)
        .gte('created_at', range.startDate.toISOString())
        .lte('created_at', range.endDate.toISOString())
        .order('created_at', { ascending: true }),
      getAllUsers()
    ])

    if (recentPropertiesResult.error) throw recentPropertiesResult.error
    if (usersResult.error) throw usersResult.error

    const usersById = new Map(
      (usersResult.data || [])
        .filter((user) => user?.id)
        .map((user) => [user.id, user])
    )

    const submitterIds = Array.from(
      new Set(
        (recentPropertiesResult.data || [])
          .map((property) => property?.user_id)
          .filter(Boolean)
      )
    )

    const submitters = submitterIds
      .map((submitterId) => {
        const user = usersById.get(submitterId)
        return {
          id: submitterId,
          name: user?.name || user?.email || 'Unknown User',
          email: user?.email || ''
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name))
    const submitterIdSet = new Set(submitterIds)

    if (submitters.length === 0) {
      return { data: emptyReport, error: null }
    }

    const dailyCountsBySubmitter = {}
    const todayCountsBySubmitterId = Object.fromEntries(submitters.map((submitter) => [submitter.id, 0]))

    ;(recentPropertiesResult.data || []).forEach((property) => {
      if (!property?.created_at || !property?.user_id || !submitterIdSet.has(property.user_id)) {
        return
      }

      const dateKey = getLocalDateKey(property.created_at)
      if (!dailyCountsBySubmitter[dateKey]) {
        dailyCountsBySubmitter[dateKey] = {}
      }

      dailyCountsBySubmitter[dateKey][property.user_id] =
        (dailyCountsBySubmitter[dateKey][property.user_id] || 0) + 1

      if (dateKey === todayDateKey) {
        todayCountsBySubmitterId[property.user_id] += 1
      }
    })

    const totalsBySubmitterId = Object.fromEntries(submitters.map((submitter) => [submitter.id, 0]))

    const dailyRows = emptyReport.dailyRows.map((day) => {
      const rawCounts = dailyCountsBySubmitter[day.date] || {}
      const countsBySubmitterId = {}
      let total = 0

      submitters.forEach((submitter) => {
        const count = rawCounts[submitter.id] || 0
        countsBySubmitterId[submitter.id] = count
        totalsBySubmitterId[submitter.id] += count
        total += count
      })

      return {
        ...day,
        countsBySubmitterId,
        total
      }
    })

    const grandTotal = dailyRows.reduce((sum, day) => sum + day.total, 0)
    const todayTotal = Object.values(todayCountsBySubmitterId).reduce((sum, count) => sum + count, 0)

    return {
      data: {
        days: range.totalDays,
        totalDays: range.totalDays,
        startDate: range.startDateKey,
        endDate: range.endDateKey,
        submitters,
        dailyRows,
        todayCountsBySubmitterId,
        todayTotal,
        totalsBySubmitterId,
        grandTotal
      },
      error: null
    }
  } catch (error) {
    console.error('Error fetching daily submitter-wise listing report:', error)
    return { data: emptyReport, error }
  }
}

export const getDailyEmployeeWiseListingReport = async (days = 7) => {
  const result = await getDailySubmitterWiseListingReport(days)

  if (!result?.data) {
    return result
  }

  return {
    data: {
      ...result.data,
      employees: result.data.submitters,
      todayCountsByEmployeeId: result.data.todayCountsBySubmitterId,
      totalsByEmployeeId: result.data.totalsBySubmitterId,
      dailyRows: result.data.dailyRows.map((day) => ({
        ...day,
        countsByEmployeeId: day.countsBySubmitterId
      }))
    },
    error: result.error
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
  contact_view: 20,
  photo_view: 20
}

const CREDIT_SETTINGS_ROW_ID = true
const CREDIT_SETTINGS_COLUMNS = 'property_listing, contact_view, photo_view'

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

const normalizeSharedUnlockCost = (record) => {
  const resolvedCost = Number(
    record?.property_listing ??
    record?.contact_view ??
    record?.photo_view ??
    DEFAULT_CREDIT_COSTS.contact_view
  )

  return Number.isFinite(resolvedCost) ? resolvedCost : DEFAULT_CREDIT_COSTS.contact_view
}

const mapCreditSettingsRecord = (record) => {
  const sharedUnlockCost = normalizeSharedUnlockCost(record)

  return {
    property_listing: sharedUnlockCost,
    contact_view: sharedUnlockCost,
    photo_view: sharedUnlockCost
  }
}

const isMissingColumnError = (error) =>
  error?.code === 'PGRST204' ||
  error?.message?.includes('Could not find the') ||
  error?.message?.includes('column') ||
  error?.details?.includes?.('column')

const isMissingTableError = (error) =>
  error?.code === 'PGRST205' ||
  error?.message?.includes('Could not find the table')

const isSupabaseQuotaError = (error) =>
  error?.message?.includes('exceed_storage_size_quota') ||
  error?.message?.includes('quota') ||
  error?.message?.includes('restricted') ||
  String(error).includes('exceed_storage_size_quota')

const logAdminError = (message, error) => {
  if (isSupabaseQuotaError(error)) {
    return // Silently skip quota errors
  }
  const errorMsg = error?.message || error?.toString() || 'Unknown error'
  console.error(message, errorMsg)
}

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
    .select(CREDIT_SETTINGS_COLUMNS)
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

const getCreditCostsFromSiteSettings = async () => {
  const { data, error } = await supabase
    .from('site_settings')
    .select(`id, ${CREDIT_SETTINGS_COLUMNS}`)
    .limit(1)
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
  const sharedUnlockCost = normalizeSharedUnlockCost(costs)
  const payload = {
    id: CREDIT_SETTINGS_ROW_ID,
    property_listing: sharedUnlockCost,
    contact_view: sharedUnlockCost,
    photo_view: sharedUnlockCost
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

const saveCreditCostsToSiteSettings = async (costs) => {
  const sharedUnlockCost = normalizeSharedUnlockCost(costs)

  const { data: existingRow, error: selectError } = await supabase
    .from('site_settings')
    .select('id, setting_key, setting_value')
    .limit(1)
    .maybeSingle()

  if (selectError) {
    throw selectError
  }

  const payload = {
    ...(existingRow?.id ? { id: existingRow.id } : {}),
    setting_key: existingRow?.setting_key || 'global',
    setting_value: existingRow?.setting_value || 'global',
    property_listing: sharedUnlockCost,
    contact_view: sharedUnlockCost,
    photo_view: sharedUnlockCost
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
    logAdminError('Error getting credit packages:', error)
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
    if (isRecoverableSupabaseError(error)) {
      return { ...DEFAULT_CREDIT_COSTS }
    }

    if (!isMissingTableError(error) && !isSupabaseQuotaError(error)) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error'
      console.error('Error getting credit costs from credit_settings:', errorMsg)
    }

    try {
      return await getCreditCostsFromSiteSettings()
    } catch (siteSettingsError) {
      if (isRecoverableSupabaseError(siteSettingsError)) {
        return { ...DEFAULT_CREDIT_COSTS }
      }

      if (!isMissingTableError(siteSettingsError) && !isSupabaseQuotaError(siteSettingsError)) {
        const errorMsg = siteSettingsError?.message || siteSettingsError?.toString() || 'Unknown error'
        console.error('Error getting credit costs from site_settings:', errorMsg)
      }

      return { ...DEFAULT_CREDIT_COSTS }
    }
  }
}

export const saveCreditCosts = async (costs) => {
  const sharedUnlockCost = normalizeSharedUnlockCost(costs)
  const normalizedCosts = {
    property_listing: sharedUnlockCost,
    contact_view: sharedUnlockCost,
    photo_view: sharedUnlockCost
  }

  try {
    await saveCreditCostsToTable(normalizedCosts)
    await saveCreditCostsToSiteSettings(normalizedCosts)
    return { success: true, error: null }
  } catch (error) {
    logAdminError('Error saving credit costs:', error)
    return { success: false, error }
  }
}

export const getSiteTheme = async () => {
  try {
    let theme = null

    try {
      theme = await getSiteThemeFromKeyValueSettings()
    } catch (error) {
      if (!isMissingColumnError(error) && !isSupabaseQuotaError(error)) {
        console.warn('Unable to read key/value site theme setting:', error)
      }
    }

    if (!theme) {
      try {
        theme = await getSiteThemeFromFlatSettings()
      } catch (error) {
        if (!isMissingColumnError(error) && !isSupabaseQuotaError(error)) {
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
    logAdminError('Error getting site theme:', error)
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
    logAdminError('Error saving site theme:', error)
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
    logAdminError('Error updating user credits:', error)
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
    logAdminError('Error fetching users with credits:', error)
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
    logAdminError('Error fetching site settings:', error)
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
    logAdminError('Error updating site settings:', error)
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
      if (!isMissingColumnError(error) && !isSupabaseQuotaError(error)) {
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
        if (!isMissingColumnError(error) && !isSupabaseQuotaError(error)) {
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
    logAdminError('Error fetching auto-approve setting:', error)
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
    logAdminError('Error toggling auto-approve setting:', error)
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

const normalizeContactUnlockRefundRequest = (record) => ({
  ...record,
  credits_restored: Number(record?.credits_restored || 0),
  contact_view: record?.contact_view || null,
  user: record?.user || null,
  property: record?.property || null,
})

export const getAdminContactUnlockRefundRequests = async () => {
  try {
    const { data, error } = await supabase
      .from('contact_unlock_refund_requests')
      .select(`
        *,
        contact_view:contact_views(id, viewed_at, credits_spent),
        user:users(id, name, email, phone),
        property:properties(id, property_id_number, category, area, state_district)
      `)
      .order('requested_at', { ascending: false })

    if (error) {
      const handled = handleTableNotFoundError(error, 'contact_unlock_refund_requests')
      if (handled.data !== null) {
        return []
      }
      throw error
    }

    return (data || []).map(normalizeContactUnlockRefundRequest)
  } catch (error) {
    console.error('Error fetching contact unlock refund requests:', error)
    return []
  }
}

export const reviewContactUnlockRefundRequest = async (
  requestId,
  status,
  adminNote = ''
) => {
  if (!requestId || !status) {
    return { data: null, error: new Error('Refund request and status are required.') }
  }

  try {
    const { data, error } = await supabase.rpc('review_contact_unlock_refund_request', {
      p_request_id: requestId,
      p_status: status,
      p_admin_note: adminNote || null,
    })

    if (error) {
      throw error
    }

    return {
      data: normalizeContactUnlockRefundRequest(Array.isArray(data) ? data[0] : data),
      error: null,
    }
  } catch (error) {
    console.error('Error reviewing contact unlock refund request:', error)
    return { data: null, error }
  }
}
