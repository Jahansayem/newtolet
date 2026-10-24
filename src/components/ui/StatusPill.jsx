import React from 'react'
import Badge from './Badge'
import { getStatusMeta } from '../../lib/adminStatusMeta'

/** Badge for an entity status, resolved through the shared status map. */
export default function StatusPill({ status, fallbackLabel = null, label = null, className = '', ...rest }) {
  const meta = getStatusMeta(status, fallbackLabel)
  return (
    <Badge variant={meta.variant} className={className} {...rest}>
      {label || meta.label}
    </Badge>
  )
}
