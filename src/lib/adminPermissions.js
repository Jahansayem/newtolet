// Admin roles and the permission matrix.
//
// The database is the source of truth (public.admin_role_permissions, read via
// the get_my_admin_profile() RPC). This mirror exists for two reasons:
//   1. the legacy fallback: a user with users.is_admin = true but no membership
//      rows (or an unreachable RPC) is treated as super_admin;
//   2. documentation and client-side pre-checks (hide/disable controls).
// Keep ROLE_PERMISSIONS identical to the seed in the admin roles migration; the
// RLS test suite asserts the per-role counts match.
//
// Pure module: no Supabase import, safe for node --test.

export const ADMIN_ROLES = Object.freeze([
  'super_admin',
  'moderator',
  'finance',
  'support',
  'content_manager',
])

export const ADMIN_ROLE_LABELS = Object.freeze({
  super_admin: 'Super admin',
  moderator: 'Moderator',
  finance: 'Finance',
  support: 'Support',
  content_manager: 'Content manager',
})

export const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard.view',
  USERS_VIEW: 'users.view',
  USERS_MODERATE: 'users.moderate',
  USERS_MANAGE_ROLES: 'users.manage_roles',
  USERS_MANAGE_EMPLOYEE: 'users.manage_employee',
  PROPERTIES_VIEW: 'properties.view',
  PROPERTIES_MODERATE: 'properties.moderate',
  PROPERTIES_FEATURE: 'properties.feature',
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_REVIEW: 'payments.review',
  CREDITS_ADJUST: 'credits.adjust',
  PRICING_MANAGE: 'pricing.manage',
  REFUNDS_REVIEW: 'refunds.review',
  ORDERS_MANAGE: 'orders.manage',
  INQUIRIES_MANAGE: 'inquiries.manage',
  FEEDBACK_REVIEW: 'feedback.review',
  CONTENT_MANAGE: 'content.manage',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
})

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS))

export const ROLE_PERMISSIONS = Object.freeze({
  super_admin: ALL_PERMISSIONS,
  moderator: Object.freeze([
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MODERATE,
    PERMISSIONS.USERS_MANAGE_EMPLOYEE,
    PERMISSIONS.PROPERTIES_VIEW,
    PERMISSIONS.PROPERTIES_MODERATE,
    PERMISSIONS.PROPERTIES_FEATURE,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.INQUIRIES_MANAGE,
    PERMISSIONS.FEEDBACK_REVIEW,
  ]),
  finance: Object.freeze([
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_REVIEW,
    PERMISSIONS.CREDITS_ADJUST,
    PERMISSIONS.PRICING_MANAGE,
    PERMISSIONS.REFUNDS_REVIEW,
    PERMISSIONS.ORDERS_MANAGE,
  ]),
  support: Object.freeze([
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.PROPERTIES_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.INQUIRIES_MANAGE,
    PERMISSIONS.FEEDBACK_REVIEW,
  ]),
  content_manager: Object.freeze([
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PROPERTIES_VIEW,
    PERMISSIONS.PROPERTIES_FEATURE,
    PERMISSIONS.FEEDBACK_REVIEW,
    PERMISSIONS.CONTENT_MANAGE,
  ]),
})

// A legacy admin (users.is_admin = true with no membership rows) is treated as
// super_admin until roles are assigned explicitly.
export const LEGACY_ADMIN_ROLE = 'super_admin'

export const isKnownRole = (role) => ADMIN_ROLES.includes(role)

/** Union of permissions granted by a list of roles; unknown roles are ignored. */
export const resolvePermissions = (roles = []) => {
  const set = new Set()
  for (const role of roles || []) {
    for (const permission of ROLE_PERMISSIONS[role] || []) {
      set.add(permission)
    }
  }
  return set
}

export const hasPermission = (permissionSet, permission) => {
  if (!permission) return true
  if (!permissionSet) return false
  return permissionSet.has ? permissionSet.has(permission) : permissionSet.includes(permission)
}

export const hasAnyPermission = (permissionSet, permissions = []) =>
  permissions.length === 0 || permissions.some((permission) => hasPermission(permissionSet, permission))

/** Human label for a role list, e.g. "Super admin · Finance". */
export const formatRoleLabels = (roles = []) =>
  (roles || [])
    .filter(isKnownRole)
    .map((role) => ADMIN_ROLE_LABELS[role])
    .join(' · ')
