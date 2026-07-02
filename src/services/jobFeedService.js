import { supabase } from './supabaseClient'
import { readSnapshot, writeSnapshot } from './cacheService'

export const getPublicJobFeedOrdersCacheKey = () => 'job-feed:public-orders'

let publicJobFeedOrdersRequest = null

const getErrorMessage = (error) => {
  if (!error) {
    return 'Unknown error'
  }

  if (typeof error === 'string') {
    return error
  }

  return error.message || error.details || error.hint || JSON.stringify(error)
}

const isSupabaseQuotaError = (error) => {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('exceed_storage_size_quota') ||
    message.includes('quota') ||
    message.includes('restricted')
  )
}

export const getPublicJobFeedOrders = async () => {
  const cacheKey = getPublicJobFeedOrdersCacheKey()

  if (publicJobFeedOrdersRequest) {
    return publicJobFeedOrdersRequest
  }

  publicJobFeedOrdersRequest = (async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          division,
          district,
          area,
          sub_area,
          category,
          rooms,
          property_need_from,
          max_budget,
          additional_preferences,
          created_at,
          status,
          job_feed_title,
          job_feed_description,
          is_job_feed_posted,
          job_feed_posted_at
        `)
        .eq('is_job_feed_posted', true)
        .eq('status', 'confirmed')
        .order('job_feed_posted_at', { ascending: false })

      if (error) throw error
      const orders = data || []
      writeSnapshot(cacheKey, orders)
      return { data: orders, error: null }
    } catch (error) {
      const cachedOrders = readSnapshot(cacheKey)
      if (cachedOrders) {
        if (process.env.NODE_ENV === 'development' && !isSupabaseQuotaError(error)) {
          console.warn(
            `Using cached public job feed orders after fetch failed: ${getErrorMessage(error)}`
          )
        }

        return { data: cachedOrders, error: null }
      }

      if (process.env.NODE_ENV === 'development' && !isSupabaseQuotaError(error)) {
        console.warn(`Public job feed orders unavailable: ${getErrorMessage(error)}`)
      }

      return { data: [], error: null }
    } finally {
      publicJobFeedOrdersRequest = null
    }
  })()

  return publicJobFeedOrdersRequest
}
