'use client'

import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAdminPermissions } from '../../contexts/AdminAccessContext'
import { AdminAccessDenied, AdminLoadingState } from './AdminAccessStates'

/**
 * Guards admin pages with the real session (AuthContext) and the server-side
 * admin profile (AdminAccessContext). localStorage is never treated as
 * authorization on its own.
 *
 * @param {string} [requiredPermission] optional fine-grained permission key
 */
const AdminRoute = ({ children, requiredPermission = null }) => {
  const location = useLocation()
  const { user, isLoading } = useAuth()
  const access = useAdminPermissions()

  if (isLoading || (user && !access.isReady)) {
    return <AdminLoadingState />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (access.status === 'error' && !access.isAdmin) {
    return (
      <AdminAccessDenied
        title="Could not verify your access"
        description="The server did not confirm your admin role. Check your connection and try again."
        error={access.error}
        onRetry={access.refresh}
      />
    )
  }

  if (!access.isAdmin) {
    return <AdminAccessDenied />
  }

  if (requiredPermission && !access.hasPermission(requiredPermission)) {
    return (
      <AdminAccessDenied
        title="Permission required"
        description="Your admin role does not include access to this area. Ask a super admin to extend your role."
      />
    )
  }

  return children
}

export default AdminRoute
