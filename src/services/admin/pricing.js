// Pricing version history: every admin_update_pricing / admin_rollback_pricing
// call stores a snapshot in credit_pricing_versions (pricing.manage to read).

import { callAdminRpc } from './adminRpc'
import { runAdminListQuery } from './adminQuery'
import { invalidateAdminSnapshots } from './adminCache'

export const PRICING_VERSION_COLUMNS = `
  id, note, published_at, published_by, is_rollback_of, snapshot,
  publisher:users!credit_pricing_versions_published_by_fkey(id, name, email)
`

export const listPricingVersions = ({ page = 1, pageSize = 20, sort } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'credit_pricing_versions',
    columns: PRICING_VERSION_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'published_at', dir: 'desc' },
    sortable: ['published_at', 'id'],
    signal,
  })

/** Current live pricing as the same snapshot shape stored in the versions table. */
export const getPricingSnapshot = () => callAdminRpc('admin_pricing_snapshot', {})

export const rollbackPricingVersion = async (versionId, note = null) => {
  const result = await callAdminRpc('admin_rollback_pricing', { p_version_id: versionId, p_note: note })
  if (!result.error) {
    invalidateAdminSnapshots('pricing')
    invalidateAdminSnapshots('pricing-versions')
  }
  return result
}

const money = (value) => (value === null || value === undefined ? '—' : `৳${Number(value).toLocaleString('en-BD')}`)

/** Flattens a pricing snapshot into label → text pairs so two versions can be diffed. */
export const flattenPricingSnapshot = (snapshot = {}) => {
  const flat = {}
  const settings = snapshot?.credit_settings || snapshot?.site_costs || {}
  if (settings.property_listing !== undefined) flat.listing_cost = `${settings.property_listing} credits`
  if (settings.contact_view !== undefined) flat.contact_unlock_cost = `${settings.contact_view} credits`
  if (settings.photo_view !== undefined) flat.photo_view_cost = `${settings.photo_view} credits`
  for (const pkg of Array.isArray(snapshot?.packages) ? snapshot.packages : []) {
    const name = pkg.package_name || pkg.id || 'package'
    const flags = [pkg.active === false ? 'inactive' : 'active', pkg.is_popular ? 'popular' : null].filter(Boolean).join(', ')
    flat[`package: ${name}`] = `${pkg.credits_amount} credits · ${money(pkg.price_bdt)}${pkg.discount_percentage ? ` · ${pkg.discount_percentage}% off` : ''} · ${flags}`
  }
  return flat
}

export const PRICING_DIFF_LABELS = {
  listing_cost: 'Listing cost',
  contact_unlock_cost: 'Contact unlock cost',
  photo_view_cost: 'Photo view cost',
}
