'use client'

import React from 'react'
import { useAdminPermissions } from '../../contexts/AdminAccessContext'
import InlineAlert from '../ui/InlineAlert'

/** Renders children only when the current admin holds `permission`. */
export default function PermissionGate({ permission, fallback = <InlineAlert variant="permission" />, children }) {
  const { hasPermission } = useAdminPermissions()
  if (permission && !hasPermission(permission)) return fallback
  return children
}
