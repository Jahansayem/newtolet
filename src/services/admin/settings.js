// Platform settings and admin memberships. Every write goes through
// admin_update_site_settings (per-key permission check + audit row); roles are
// changed with admin_set_user_roles from ./users.

import { supabase } from '../supabaseClient'
import { callAdminRpc } from './adminRpc'
import { fail, ok } from './adminResult'
import { invalidateAdminSnapshots } from './adminCache'

export const SITE_SETTINGS_COLUMNS = 'id, auto_approve_properties, site_theme, maintenance_mode, contact_info, featured_property_ids, updated_at'

export const DEFAULT_SITE_SETTINGS = {
  id: null,
  auto_approve_properties: false,
  site_theme: 'light',
  maintenance_mode: false,
  contact_info: {},
  featured_property_ids: [],
  updated_at: null,
}

export const CONTACT_INFO_FIELDS = [
  { key: 'phone', label: 'Phone', type: 'tel', placeholder: '01XXXXXXXXX' },
  { key: 'whatsapp', label: 'WhatsApp', type: 'tel', placeholder: '01XXXXXXXXX' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'hello@newtolet.com' },
  { key: 'address', label: 'Office address', type: 'text', placeholder: 'House, road, area, city' },
  { key: 'facebook', label: 'Facebook page', type: 'url', placeholder: 'https://facebook.com/…' },
  { key: 'hours', label: 'Support hours', type: 'text', placeholder: 'Sat–Thu, 10:00–18:00' },
]

export const MAX_FEATURED_LISTINGS = 12

const normalizeSettings = (row) => ({
  ...DEFAULT_SITE_SETTINGS,
  ...(row || {}),
  contact_info: row?.contact_info && typeof row.contact_info === 'object' ? row.contact_info : {},
  featured_property_ids: Array.isArray(row?.featured_property_ids) ? row.featured_property_ids : [],
  site_theme: row?.site_theme === 'dark' ? 'dark' : 'light',
})

export const getSiteSettings = async ({ signal } = {}) => {
  let query = supabase.from('site_settings').select(SITE_SETTINGS_COLUMNS).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) return fail(error)
  return ok(normalizeSettings(data))
}

/**
 * updateSiteSettings({ maintenance_mode?, auto_approve_properties?, site_theme?, contact_info?, featured_property_ids? })
 * The RPC checks settings.manage for the first three keys and content.manage for the last two.
 */
export const updateSiteSettings = async (patch = {}) => {
  const result = await callAdminRpc('admin_update_site_settings', { p_patch: patch })
  if (!result.error) {
    invalidateAdminSnapshots('settings')
    invalidateAdminSnapshots('dashboard')
  }
  return result.error ? result : { ...result, data: normalizeSettings(result.data) }
}

export const ADMIN_MEMBERSHIP_COLUMNS = `
  id, user_id, role, is_active, source, created_at, revoked_at,
  user:users!admin_memberships_user_id_fkey(id, name, email, phone, is_active, is_admin)
`

/** Active memberships grouped per user: [{ userId, user, roles, source, since }]. */
export const listAdminMemberships = async ({ signal } = {}) => {
  let query = supabase.from('admin_memberships').select(ADMIN_MEMBERSHIP_COLUMNS).eq('is_active', true).order('created_at', { ascending: true })
  if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) return fail(error)
  const byUser = new Map()
  for (const row of data || []) {
    const entry = byUser.get(row.user_id) || { userId: row.user_id, user: row.user || null, roles: [], source: row.source, since: row.created_at }
    entry.roles.push(row.role)
    if (row.created_at < entry.since) entry.since = row.created_at
    if (row.source === 'manual') entry.source = 'manual'
    byUser.set(row.user_id, entry)
  }
  return ok(Array.from(byUser.values()).sort((a, b) => (a.user?.name || a.user?.email || '').localeCompare(b.user?.name || b.user?.email || '')))
}
