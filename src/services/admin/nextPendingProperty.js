// "Update & next" on the admin edit page: finds the pending listing that
// follows the current one in the moderation order (newest first).

import { supabase } from '../supabaseClient'
import { buildAfterRowFilter } from '../../lib/nextPendingFilter'
import { fail, logAdminError, ok } from './adminResult'

/**
 * @param {object} options
 * @param {string} [options.excludeId] - listing being edited; never returned
 * @param {string} [options.afterCreatedAt] - created_at of the current listing when it is
 *   itself pending, so the search continues below it instead of starting from the top
 * @param {string} [options.afterId] - id of the current listing (timestamp tie-break)
 * @returns {Promise<{ data: string | null, error: object | null }>} next listing id, or null
 */
export const getNextPendingPropertyId = async ({ excludeId, afterCreatedAt, afterId } = {}) => {
  let query = supabase
    .from('properties')
    .select('id')
    .eq('status', 'pending')
    .is('deleted_at', null)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const afterFilter = buildAfterRowFilter({ createdAt: afterCreatedAt, id: afterId })
  if (afterFilter) {
    query = query.or(afterFilter)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)

  if (error) {
    logAdminError('properties.getNextPendingPropertyId', error)
    return fail(error)
  }

  return ok(data?.[0]?.id || null)
}
