// Property moderation: paginated list with duplicate-phone annotation through
// the indexed contact_phone_key column + RPCs, bulk status changes, featured
// flag and soft delete, all through actor-safe RPCs.

import { supabase } from '../supabaseClient'
import { normalizePhoneForDuplicateKey } from '../../lib/phoneKey'
import { resolveCountKeys } from '../../lib/propertyCounts'
import { fetchAdminRow, runAdminListQuery } from './adminQuery'
import { callAdminRpc } from './adminRpc'
import { fail, logAdminError, ok } from './adminResult'
import { invalidateAdminSnapshots } from './adminCache'
import { headCount } from './dashboard'

const PROPERTY_IMAGES_BUCKET = 'property-images'

// Only what the table, the row actions and the details dialog read. Searching
// (sub_area) and sorting (updated_at) work on columns that are not selected.
export const PROPERTY_LIST_COLUMNS = `
  id, user_id, property_id_number, category, property_type, short_description, state_district, area,
  contact_number, contact_phone_key, rent_amount_bdt, rent_period, is_rent_negotiable, status, is_featured,
  total_rooms, total_bathrooms, created_at, reviewed_at,
  moderation_reason, internal_note, deleted_at,
  property_images(image_url, display_order)
`
// properties.user_id has no foreign key to users on the deployed database, so
// PostgREST cannot embed the submitter; it is fetched in one extra query per page.

const attachSubmitters = async (rows = []) => {
  const ids = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)))
  if (ids.length === 0) return rows
  const { data, error } = await supabase.from('users').select('id, name, email, phone, is_active').in('id', ids)
  if (error) {
    logAdminError('properties.attachSubmitters', error)
    return rows
  }
  const byId = Object.fromEntries((data || []).map((user) => [user.id, user]))
  return rows.map((row) => ({ ...row, submitted_by: byId[row.user_id] || row.submitted_by || null }))
}

export const normalizePropertyImageUrl = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image/')) return trimmed
  const bucketPathMatch = trimmed.match(/(?:^|\/)property-images\/(.+)$/i)
  const objectPath = (bucketPathMatch?.[1] || trimmed).replace(/^\/+/, '')
  if (!objectPath) return null
  const { data } = supabase.storage.from(PROPERTY_IMAGES_BUCKET).getPublicUrl(objectPath)
  return data?.publicUrl || null
}

/** Same output shape the legacy PropertyManagement normaliser produced, plus duplicate fields. */
export const normalizeAdminProperty = (row, phoneCounts = null) => {
  const images = (Array.isArray(row.property_images) ? [...row.property_images] : [])
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((image) => normalizePropertyImageUrl(image.image_url))
    .filter(Boolean)
  const submitter = row.submitted_by || {}
  const phoneKey = row.contact_phone_key || normalizePhoneForDuplicateKey(row.contact_number)
  const counts = phoneCounts && phoneKey ? phoneCounts[phoneKey] : null
  return {
    ...row,
    submitted_by: { id: submitter.id || row.user_id || null, name: submitter.name || '', email: submitter.email || '', phone: submitter.phone || '', is_active: submitter.is_active !== false },
    images,
    primary_image: images[0] || null,
    status: row.status || 'pending',
    is_featured: Boolean(row.is_featured),
    bedrooms: row.total_rooms,
    bathrooms: row.total_bathrooms,
    location: { area: row.area, state_district: row.state_district },
    pricing: { rent_amount_bdt: row.rent_amount_bdt, rent_period: row.rent_period, is_rent_negotiable: Boolean(row.is_rent_negotiable) },
    duplicatePhoneKey: phoneKey || null,
    duplicateCount: counts ? Number(counts.property_count) : null,
    duplicatePendingCount: counts ? Number(counts.pending_count) : null,
    isDuplicatePhone: counts ? Number(counts.property_count) > 1 : false,
  }
}

const cleanSearch = (search = '') => String(search || '').replace(/^#/, '').trim()

/** Adds duplicateCount / isDuplicatePhone to a page of rows using one RPC call. */
export const annotateDuplicates = async (rows = []) => {
  const keys = Array.from(new Set(rows.map((row) => row.contact_phone_key || normalizePhoneForDuplicateKey(row.contact_number)).filter(Boolean)))
  if (keys.length === 0) return rows.map((row) => normalizeAdminProperty(row))
  const result = await callAdminRpc('admin_phone_key_counts', { p_keys: keys })
  let counts = null
  if (!result.error && Array.isArray(result.data)) {
    counts = Object.fromEntries(result.data.map((entry) => [entry.phone_key, entry]))
  } else if (result.error) {
    logAdminError('properties.annotateDuplicates', result.error)
  }
  return rows.map((row) => normalizeAdminProperty(row, counts))
}

/**
 * listProperties({ page, pageSize, sort, filters: { status, featured, phoneKey, archived }, search })
 * search matches the listing id number exactly or title/area/district/category/phone.
 */
export const listProperties = async ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) => {
  const term = cleanSearch(search)
  const result = await runAdminListQuery({
    table: 'properties',
    columns: PROPERTY_LIST_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'rent_amount_bdt', 'status', 'updated_at'],
    filters: { status: filters.status === 'all' ? '' : filters.status, is_featured: filters.featured, contact_phone_key: filters.phoneKey },
    filterSpec: { status: { op: 'eq' }, is_featured: { op: 'eq', values: (value) => value === 'true' || value === true }, contact_phone_key: { op: 'eq' } },
    search: /^\d{4,}$/.test(term) ? '' : term,
    searchColumns: ['property_id_number', 'short_description', 'area', 'state_district', 'sub_area', 'category', 'contact_number'],
    apply: (query) => {
      let next = filters.archived === 'archived' ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
      if (/^\d{4,}$/.test(term)) next = next.eq('property_id_number', term)
      return next
    },
    signal,
  })
  if (result.error) return result
  const rows = await annotateDuplicates(await attachSubmitters(result.data || []))
  return { ...result, data: rows }
}

export const getProperty = async (propertyId, { signal } = {}) => {
  const result = await fetchAdminRow({ table: 'properties', columns: `*, property_images(image_url, display_order)`, id: propertyId, signal })
  if (result.error) return result
  const [row] = await annotateDuplicates(await attachSubmitters([result.data]))
  return ok(row)
}

/** Groups of listings sharing a phone number (RPC, indexed), with a preview listing per group. */
export const listDuplicatePhoneGroups = async ({ page = 1, pageSize = 20, status = 'pending' } = {}) => {
  const limit = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit
  const rpc = await callAdminRpc('admin_duplicate_phone_groups', { p_status: status || null, p_limit: limit, p_offset: offset })
  if (rpc.error) return { ...rpc, page, pageSize: limit, totalCount: 0, hasMore: false }
  const groups = Array.isArray(rpc.data) ? rpc.data : []
  const totalCount = groups.length ? Number(groups[0].total_groups) : 0
  const previewIds = groups.map((group) => group.latest_property_id).filter(Boolean)
  let previews = {}
  if (previewIds.length) {
    const { data, error } = await supabase.from('properties').select(PROPERTY_LIST_COLUMNS).in('id', previewIds)
    if (error) return fail(error)
    const withSubmitters = await attachSubmitters(data || [])
    previews = Object.fromEntries(withSubmitters.map((row) => [row.id, normalizeAdminProperty(row)]))
  }
  const items = groups.map((group) => {
    const preview = previews[group.latest_property_id] || null
    return {
      id: group.phone_key,
      duplicatePhoneKey: group.phone_key,
      contact_number: preview?.contact_number || group.phone_key,
      pendingDuplicateCount: Number(group.pending_count),
      totalPropertiesCount: Number(group.property_count),
      previewProperty: preview,
      latestPendingCreatedAt: group.latest_created_at,
    }
  })
  return ok(items, { page: Math.max(Number(page) || 1, 1), pageSize: limit, totalCount, hasMore: offset + items.length < totalCount })
}

/** Listings by id, in the order given (used by the featured-listings editor). */
export const listPropertiesByIds = async (ids = [], { signal } = {}) => {
  const unique = Array.from(new Set((ids || []).filter(Boolean)))
  if (unique.length === 0) return ok([])
  let query = supabase.from('properties').select(PROPERTY_LIST_COLUMNS).in('id', unique.slice(0, 100))
  if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal)
  const { data, error } = await query
  if (error) return fail(error)
  const rows = await annotateDuplicates(await attachSubmitters(data || []))
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]))
  return ok(unique.map((id) => byId[id]).filter(Boolean))
}

// Stat-card counts. A metric that could not be read is `null`, never 0, so the
// caller can keep its last known value or show it as unavailable.
const countDuplicateGroups = async () => {
  const result = await callAdminRpc('admin_duplicate_phone_groups', { p_status: 'pending', p_limit: 1, p_offset: 0 })
  if (result.error) return { value: null, error: result.error }
  // No rows from the RPC means there are no duplicate groups.
  if (!Array.isArray(result.data)) return { value: null, error: null }
  return { value: result.data.length ? Number(result.data[0].total_groups) : 0, error: null }
}

const COUNT_FETCHERS = {
  total: () => headCount('properties', (q) => q.is('deleted_at', null)),
  approved: () => headCount('properties', (q) => q.eq('status', 'approved').is('deleted_at', null)),
  pending: () => headCount('properties', (q) => q.eq('status', 'pending').is('deleted_at', null)),
  rejected: () => headCount('properties', (q) => q.eq('status', 'rejected').is('deleted_at', null)),
  duplicatePending: countDuplicateGroups,
}

/**
 * getPropertyCounts({ only }) — `only` limits the requests to those counts, so
 * a retry asks again only for the ones that failed. `data` holds the requested
 * keys; `failedKeys` lists the ones that could not be read and `error` is the
 * first of their errors.
 */
export const getPropertyCounts = async ({ only = null } = {}) => {
  const keys = resolveCountKeys(only)
  const settled = await Promise.all(keys.map((key) => COUNT_FETCHERS[key]()))
  const data = {}
  const failedKeys = []
  let firstError = null
  keys.forEach((key, index) => {
    const { value, error } = settled[index]
    data[key] = value
    if (value === null) failedKeys.push(key)
    if (error && !firstError) firstError = error
  })
  return { ...ok(data), error: firstError, partial: failedKeys.length > 0, failedKeys }
}

const after = (result) => {
  if (!result.error) {
    invalidateAdminSnapshots('properties')
    invalidateAdminSnapshots('duplicate-groups')
  }
  return result
}

/** setPropertyStatus({ ids, status, reason, note }) — bulk, one audit row per listing. */
export const setPropertyStatus = async ({ ids = [], status, reason = null, note = null }) =>
  after(await callAdminRpc('admin_set_property_status', { p_property_ids: ids, p_status: status, p_reason: reason, p_internal_note: note, p_from_status: null }))

// The pending queue as "Approve all" sees it: not removed, not deactivated.
const approvablePending = (query) => query.eq('status', 'pending').is('deleted_at', null).or('is_active.is.null,is_active.eq.true')

/** How many listings "Approve all pending" would approve right now. { value, error } */
export const countApprovablePending = () => headCount('properties', approvablePending)

const APPROVE_ALL_CHUNK = 200
const APPROVE_ALL_MAX_ROUNDS = 100

/**
 * Approves the whole pending queue in batches (the RPC accepts at most 500 ids
 * per call). Stops at the first failure; `count` is how many were approved,
 * also when it stops early.
 */
export const approveAllPending = async (reason = null, { onProgress = null } = {}) => {
  let approved = 0
  const stop = (error) => {
    if (approved > 0) after({ error: null })
    const failed = fail(error)
    const message = approved > 0 ? `${approved} listings were approved, then it stopped: ${failed.error.message}` : failed.error.message
    return { ...failed, error: { ...failed.error, message }, count: approved }
  }
  for (let round = 0; round < APPROVE_ALL_MAX_ROUNDS; round += 1) {
    const { data, error } = await approvablePending(supabase.from('properties').select('id')).order('created_at', { ascending: true }).limit(APPROVE_ALL_CHUNK)
    if (error) return stop(error)
    const ids = (data || []).map((row) => row.id)
    if (ids.length === 0) break
    const result = await callAdminRpc('admin_set_property_status', { p_property_ids: ids, p_status: 'approved', p_reason: reason, p_internal_note: null, p_from_status: null })
    if (result.error) return stop(result.error)
    const done = result.count ?? ids.length
    if (done === 0) break
    approved += done
    onProgress?.(approved)
  }
  return after(ok(null, { count: approved }))
}

export const setPropertyFeatured = async (propertyId, isFeatured) =>
  after(await callAdminRpc('admin_set_property_featured', { p_property_id: propertyId, p_is_featured: isFeatured }))

export const softDeleteProperty = async (propertyId, reason) =>
  after(await callAdminRpc('admin_soft_delete_property', { p_property_id: propertyId, p_reason: reason }))
