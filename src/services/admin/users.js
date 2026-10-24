// User moderation through actor-safe RPCs. The acting admin is auth.uid() on
// the server; nothing here accepts or sends an admin id.

import { supabase } from '../supabaseClient'
import { callAdminRpc } from './adminRpc'
import { fail, ok } from './adminResult'
import { runAdminListQuery } from './adminQuery'
import { invalidateAdminSnapshots } from './adminCache'

const afterMutation = (result) => {
  if (!result.error) invalidateAdminSnapshots('users')
  return result
}

export const USER_LIST_COLUMNS = `
  id, name, email, phone, avatar_url, provider, credits, is_active, is_admin, is_employee, role, created_at, updated_at,
  blacklist:user_blacklist!user_blacklist_user_id_fkey(id, reason, notes, blacklisted_at, is_permanent, expires_at, lifted_at),
  memberships:admin_memberships!admin_memberships_user_id_fkey(role, is_active)
`

const normalizeUser = (row) => {
  const blacklist = Array.isArray(row.blacklist) ? row.blacklist : row.blacklist ? [row.blacklist] : []
  const activeBlacklist = blacklist.find((entry) => !entry.lifted_at) || null
  const memberships = Array.isArray(row.memberships) ? row.memberships : []
  return {
    ...row,
    blacklist: activeBlacklist,
    blacklist_history: blacklist,
    is_blacklisted: Boolean(activeBlacklist),
    roles: memberships.filter((entry) => entry.is_active).map((entry) => entry.role),
  }
}

/** listUsers({ page, pageSize, sort, filters: { status: 'active'|'blocked', role, isAdmin }, search }) */
export const listUsers = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'users',
    columns: USER_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'name', 'email', 'credits'],
    filters: { is_active: filters.status, is_admin: filters.isAdmin, is_employee: filters.isEmployee },
    filterSpec: {
      is_active: { op: 'eq', values: (value) => value === 'active' },
      is_admin: { op: 'eq', values: (value) => value === 'true' || value === true },
      is_employee: { op: 'eq', values: (value) => value === 'true' || value === true },
    },
    search,
    searchColumns: ['name', 'email', 'phone'],
    map: normalizeUser,
    signal,
  })

export const getBlacklistReasons = () => [
  { value: 'Violation of terms', label: 'Violation of terms' },
  { value: 'Fraud', label: 'Fake listings / fraud' },
  { value: 'Harassment', label: 'Harassment / abuse' },
  { value: 'Spam', label: 'Spam / excessive posting' },
  { value: 'Payment fraud', label: 'Payment issues' },
  { value: 'Other', label: 'Other' },
]

/** Active blacklist entry for a user (lifted entries are history). */
export const checkUserBlacklist = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_blacklist')
      .select('id, user_id, reason, notes, blacklisted_at, blacklisted_by, is_permanent, expires_at, lifted_at, lifted_by, lift_note')
      .eq('user_id', userId)
      .order('blacklisted_at', { ascending: false })
      .limit(5)
    if (error) return { blacklisted: false, data: null, history: [], ...fail(error) }
    const history = data || []
    const active = history.find((row) => !row.lifted_at) || null
    return { blacklisted: Boolean(active), history, ...ok(active) }
  } catch (error) {
    return { blacklisted: false, data: null, history: [], ...fail(error) }
  }
}

/**
 * blacklistUser({ userId, reason, notes, isPermanent, expiresAt })
 * Legacy positional form (userId, reason, _ignoredAdminId, notes, isPermanent) is accepted
 * so existing call sites keep working; the admin id argument is ignored.
 */
export const blacklistUser = async (userIdOrOptions, reason, _legacyAdminId, notes = '', isPermanent = true) => {
  const options =
    userIdOrOptions && typeof userIdOrOptions === 'object'
      ? userIdOrOptions
      : { userId: userIdOrOptions, reason, notes, isPermanent }
  return afterMutation(
    await callAdminRpc('admin_blacklist_user', {
      p_user_id: options.userId,
      p_reason: options.reason,
      p_notes: options.notes || null,
      p_is_permanent: options.isPermanent !== false,
      p_expires_at: options.expiresAt || null,
    })
  )
}

export const unblacklistUser = async (userId, note = null) =>
  afterMutation(await callAdminRpc('admin_unblacklist_user', { p_user_id: userId, p_note: note }))

export const setUserActive = async (userId, isActive, reason = null) =>
  afterMutation(await callAdminRpc('admin_set_user_active', { p_user_id: userId, p_is_active: isActive, p_reason: reason }))

export const setEmployeeFlag = async (userId, isEmployee) =>
  afterMutation(await callAdminRpc('admin_set_employee_flag', { p_user_id: userId, p_is_employee: isEmployee }))

export const setUserRoles = async (userId, roles) =>
  afterMutation(await callAdminRpc('admin_set_user_roles', { p_user_id: userId, p_roles: roles }))

export const adjustUserCredits = async ({ userId, delta, reason, expectedBalance = null }) =>
  afterMutation(
    await callAdminRpc('admin_adjust_user_credits', {
      p_user_id: userId,
      p_delta: delta,
      p_reason: reason,
      p_expected_balance: expectedBalance,
    })
  )
