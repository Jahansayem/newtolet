// Loads the signed-in user's admin roles and permissions from the database.
//
// Source of truth is the get_my_admin_profile() RPC (admin roles migration).
// When the RPC is missing (database not migrated yet) or unreachable, the
// caller falls back to the legacy users.is_admin flag; we signal that with
// `legacy: true` so the context can resolve super_admin permissions locally.

import { supabase } from './supabaseClient'
import { classifyError, ADMIN_ERROR_CODES } from '../lib/adminErrorCodes'
import { isKnownRole } from '../lib/adminPermissions'

const toStringArray = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [])

/**
 * @returns {Promise<{
 *   data: { userId: string|null, isActive: boolean, isAdmin: boolean, roles: string[], permissions: string[], legacyAdmin: boolean, capabilities: string[] } | null,
 *   error: ReturnType<typeof classifyError> | null,
 *   legacy: boolean
 * }>}
 */
export const getMyAdminProfile = async ({ signal } = {}) => {
  try {
    let query = supabase.rpc('get_my_admin_profile')
    if (signal && typeof query.abortSignal === 'function') {
      query = query.abortSignal(signal)
    }
    const { data, error } = await query
    if (error) {
      const classified = classifyError(error)
      const legacy = classified.code === ADMIN_ERROR_CODES.MISSING_RPC || classified.retryable
      return { data: null, error: classified, legacy }
    }
    const profile = data && typeof data === 'object' ? data : {}
    return {
      data: {
        userId: profile.user_id || null,
        isActive: profile.is_active !== false,
        isAdmin: Boolean(profile.is_admin),
        roles: toStringArray(profile.roles).filter(isKnownRole),
        permissions: toStringArray(profile.permissions),
        legacyAdmin: Boolean(profile.legacy_admin),
        capabilities: toStringArray(profile.capabilities),
      },
      error: null,
      legacy: false,
    }
  } catch (error) {
    const classified = classifyError(error)
    return { data: null, error: classified, legacy: classified.code !== ADMIN_ERROR_CODES.ABORTED }
  }
}
