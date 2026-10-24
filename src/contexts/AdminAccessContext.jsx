'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getMyAdminProfile } from '../services/adminAccessService'
import {
  LEGACY_ADMIN_ROLE,
  hasAnyPermission as hasAnyPermissionIn,
  hasPermission as hasPermissionIn,
  resolvePermissions,
} from '../lib/adminPermissions'

/**
 * Admin access state for the signed-in user.
 *
 * status: 'idle' (no user) | 'loading' | 'ready' | 'error'
 * Permissions come from the server; if the RPC is unavailable the legacy
 * users.is_admin flag resolves to super_admin so existing admins keep working
 * through the staged rollout.
 */
const EMPTY = Object.freeze({
  roles: [],
  permissions: new Set(),
  capabilities: [],
  isAdmin: false,
  isActive: true,
  isLegacyAdmin: false,
})

export const AdminAccessContext = createContext(null)

const deriveLegacy = (user) => {
  if (!user || user.is_admin !== true) return EMPTY
  return {
    roles: [LEGACY_ADMIN_ROLE],
    permissions: resolvePermissions([LEGACY_ADMIN_ROLE]),
    capabilities: [],
    isAdmin: true,
    isActive: user.is_active !== false,
    isLegacyAdmin: true,
  }
}

export const AdminAccessProvider = ({ children }) => {
  const { user, isLoading } = useAuth()
  const [status, setStatus] = useState('idle')
  const [access, setAccess] = useState(EMPTY)
  const [error, setError] = useState(null)
  const loadedForRef = useRef(null)
  const abortRef = useRef(null)

  const load = useCallback(
    async (currentUser) => {
      if (!currentUser?.id) {
        loadedForRef.current = null
        setAccess(EMPTY)
        setError(null)
        setStatus('idle')
        return
      }
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStatus('loading')
      const result = await getMyAdminProfile({ signal: controller.signal })
      if (controller.signal.aborted) return
      if (result.data) {
        const serverPermissions = new Set(result.data.permissions)
        // A legacy admin without membership rows gets super_admin locally too,
        // so the UI matches what admin_has_permission() will allow.
        const permissions = result.data.legacyAdmin ? resolvePermissions([LEGACY_ADMIN_ROLE]) : serverPermissions
        setAccess({
          roles: result.data.legacyAdmin && result.data.roles.length === 0 ? [LEGACY_ADMIN_ROLE] : result.data.roles,
          permissions,
          capabilities: result.data.capabilities,
          isAdmin: result.data.isActive && (result.data.roles.length > 0 || result.data.legacyAdmin || result.data.isAdmin),
          isActive: result.data.isActive,
          isLegacyAdmin: result.data.legacyAdmin,
        })
        setError(null)
        setStatus('ready')
      } else {
        setAccess(result.legacy ? deriveLegacy(currentUser) : EMPTY)
        setError(result.error)
        setStatus(result.legacy ? 'ready' : 'error')
      }
      loadedForRef.current = currentUser.id
    },
    []
  )

  useEffect(() => {
    if (isLoading) return undefined
    if (!user?.id) {
      void load(null)
      return undefined
    }
    if (loadedForRef.current === user.id) return undefined
    void load(user)
    return () => abortRef.current?.abort()
  }, [isLoading, user, load])

  const refresh = useCallback(() => {
    loadedForRef.current = null
    return load(user)
  }, [load, user])

  const value = useMemo(
    () => ({
      status,
      isReady: status === 'ready' || status === 'error' || status === 'idle',
      isAdmin: access.isAdmin,
      isActive: access.isActive,
      isLegacyAdmin: access.isLegacyAdmin,
      roles: access.roles,
      permissions: access.permissions,
      capabilities: access.capabilities,
      error,
      hasPermission: (permission) => hasPermissionIn(access.permissions, permission),
      hasAnyPermission: (permissions) => hasAnyPermissionIn(access.permissions, permissions),
      hasCapability: (name) => access.capabilities.length === 0 || access.capabilities.includes(name),
      refresh,
    }),
    [status, access, error, refresh]
  )

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
}

export const useAdminPermissions = () => {
  const context = useContext(AdminAccessContext)
  if (!context) {
    throw new Error('useAdminPermissions must be used within AdminAccessProvider')
  }
  return context
}

export default AdminAccessContext
