import { supabase } from './supabaseClient'
import { readSnapshot, writeSnapshot } from './cacheService'

export const getPublicJobFeedOrdersCacheKey = () => 'job-feed:public-orders'

let publicJobFeedOrdersRequest = null

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
      console.error('Error fetching public job feed orders:', error)

      const cachedOrders = readSnapshot(cacheKey)
      if (cachedOrders) {
        return { data: cachedOrders, error: null }
      }

      return { data: [], error }
    } finally {
      publicJobFeedOrdersRequest = null
    }
  })()

  return publicJobFeedOrdersRequest
}
