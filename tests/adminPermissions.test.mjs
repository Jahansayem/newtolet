import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  resolvePermissions,
  hasPermission,
  hasAnyPermission,
  formatRoleLabels,
} from '../src/lib/adminPermissions.js'

// These counts are asserted against public.admin_role_permissions by
// scripts/deploy/supabase-selfhost/rls-tests.sql (T0.2). Change both together.
test('per-role permission counts match the SQL seed', () => {
  assert.equal(ROLE_PERMISSIONS.super_admin.length, 19)
  assert.equal(ROLE_PERMISSIONS.moderator.length, 10)
  assert.equal(ROLE_PERMISSIONS.finance.length, 8)
  assert.equal(ROLE_PERMISSIONS.support.length, 7)
  assert.equal(ROLE_PERMISSIONS.content_manager.length, 5)
})

test('super_admin holds every permission', () => {
  assert.deepEqual(new Set(ROLE_PERMISSIONS.super_admin), new Set(Object.values(PERMISSIONS)))
})

test('every role is defined and uses known permissions', () => {
  const known = new Set(Object.values(PERMISSIONS))
  for (const role of ADMIN_ROLES) {
    assert.ok(ROLE_PERMISSIONS[role], `role ${role}`)
    for (const permission of ROLE_PERMISSIONS[role]) assert.ok(known.has(permission), `${role}: ${permission}`)
  }
})

test('resolvePermissions unions roles and ignores unknown ones', () => {
  const set = resolvePermissions(['finance', 'content_manager', 'bogus'])
  assert.ok(set.has(PERMISSIONS.PAYMENTS_REVIEW))
  assert.ok(set.has(PERMISSIONS.CONTENT_MANAGE))
  assert.ok(!set.has(PERMISSIONS.AUDIT_VIEW))
  assert.equal(resolvePermissions([]).size, 0)
  assert.equal(resolvePermissions(null).size, 0)
})

test('hasPermission / hasAnyPermission', () => {
  const set = resolvePermissions(['support'])
  assert.equal(hasPermission(set, PERMISSIONS.INQUIRIES_MANAGE), true)
  assert.equal(hasPermission(set, PERMISSIONS.PAYMENTS_REVIEW), false)
  assert.equal(hasPermission(set, undefined), true, 'no permission required')
  assert.equal(hasPermission(null, PERMISSIONS.DASHBOARD_VIEW), false)
  assert.equal(hasAnyPermission(set, [PERMISSIONS.PAYMENTS_REVIEW, PERMISSIONS.ORDERS_MANAGE]), true)
  assert.equal(hasAnyPermission(set, []), true)
  assert.equal(hasPermission([PERMISSIONS.AUDIT_VIEW], PERMISSIONS.AUDIT_VIEW), true, 'arrays accepted')
})

test('formatRoleLabels', () => {
  assert.equal(formatRoleLabels(['super_admin', 'finance', 'nope']), 'Super admin · Finance')
  assert.equal(formatRoleLabels([]), '')
})
