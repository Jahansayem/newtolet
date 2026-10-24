import React from 'react'
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo, FiLock, FiX } from 'react-icons/fi'
import Button from './Button'

const VARIANTS = {
  info: { className: 'ui-note', icon: FiInfo, role: 'status' },
  success: { className: 'ui-note ui-note-success', icon: FiCheckCircle, role: 'status' },
  warning: { className: 'ui-note ui-note-warning', icon: FiAlertTriangle, role: 'status' },
  danger: { className: 'ui-note ui-note-danger', icon: FiAlertCircle, role: 'alert' },
  permission: { className: 'ui-note', icon: FiLock, role: 'status' },
}

const PERMISSION_COPY = "You don't have permission to view this. Ask a super admin to grant access."

/**
 * Inline message surface (load errors, warnings, permission state) with an
 * optional retry action and dismiss button.
 */
export default function InlineAlert({
  variant = 'info',
  title = null,
  children = null,
  action = null,
  onDismiss = null,
  role = null,
  className = '',
  ...rest
}) {
  const config = VARIANTS[variant] || VARIANTS.info
  const Icon = config.icon
  const body = variant === 'permission' && !children ? PERMISSION_COPY : children
  return (
    <div className={`${config.className} flex items-start gap-3 ${className}`.trim()} role={role || config.role} {...rest}>
      <Icon className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {body ? <div className={title ? 'mt-1' : ''}>{body}</div> : null}
        {action ? (
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={action.onClick} busy={action.busy} icon={action.icon}>
              {action.label}
            </Button>
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <Button variant="ghost" size="sm" iconOnly aria-label="Dismiss" onClick={onDismiss} className="-mr-2 -mt-1">
          <FiX />
        </Button>
      ) : null}
    </div>
  )
}
