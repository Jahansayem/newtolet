import { supabase } from './supabaseClient'

export const getPublicJobFeedOrders = async () => {
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
    return { data: data || [], error: null }
  } catch (error) {
    console.error('Error fetching public job feed orders:', error)
    return { data: [], error }
  }
}
