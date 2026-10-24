import React, { forwardRef } from 'react'
import { Link } from 'react-router-dom'

const VARIANT_CLASS = {
  primary: 'ui-btn-primary',
  secondary: 'ui-btn-secondary',
  ghost: 'ui-btn-ghost',
  danger: 'ui-btn-danger',
  'danger-outline': 'ui-btn-danger-outline',
}

const SIZE_CLASS = { sm: 'ui-btn-sm', md: '', lg: 'ui-btn-lg' }

/**
 * Thin wrapper over the .ui-btn CSS primitives.
 * - `busy` disables the control, sets aria-busy and shows a spinner + busyLabel
 * - `iconOnly` switches to the round icon button and requires an aria-label
 * - `to` renders a router Link, `href` an anchor, otherwise a <button>
 */
const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    busy = false,
    busyLabel = 'Working…',
    icon = null,
    iconOnly = false,
    fullWidth = false,
    type = 'button',
    className = '',
    to,
    href,
    disabled = false,
    children,
    ...rest
  },
  ref
) {
  if (iconOnly && !rest['aria-label'] && process.env.NODE_ENV !== 'production') {
    console.warn('Button: iconOnly buttons need an aria-label')
  }
  const classes = [
    'ui-btn',
    VARIANT_CLASS[variant] || VARIANT_CLASS.secondary,
    SIZE_CLASS[size] || '',
    iconOnly ? (size === 'lg' ? 'ui-btn-icon-lg' : 'ui-btn-icon') : '',
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {busy ? (
        <span className="loading loading-spinner loading-xs" aria-hidden="true" />
      ) : icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">{icon}</span>
      ) : null}
      {iconOnly ? null : busy ? <span>{busyLabel}</span> : children}
      {iconOnly && busy ? <span className="sr-only">{busyLabel}</span> : null}
    </>
  )

  if (to && !busy && !disabled) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    )
  }
  if (href && !busy && !disabled) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    )
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {content}
    </button>
  )
})

export default Button
