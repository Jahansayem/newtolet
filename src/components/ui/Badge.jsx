import React from 'react'

const VARIANT_CLASS = {
  neutral: 'ui-badge-neutral',
  brand: 'ui-badge-brand',
  success: 'ui-badge-success',
  warning: 'ui-badge-warning',
  pending: 'ui-badge-warning',
  danger: 'ui-badge-danger',
  promoted: 'ui-badge-promoted',
}

/**
 * Text badge. Status is always conveyed by the text, never by colour alone.
 */
export default function Badge({ variant = 'neutral', icon = null, className = '', children, ...rest }) {
  return (
    <span className={`ui-badge ${VARIANT_CLASS[variant] || VARIANT_CLASS.neutral} ${className}`.trim()} {...rest}>
      {icon ? <span aria-hidden="true" className="inline-flex">{icon}</span> : null}
      {children}
    </span>
  )
}
