import React from 'react'
import { Link } from 'react-router-dom'
import { FiArrowDownRight, FiArrowUpRight, FiMinus } from 'react-icons/fi'
import Skeleton from './Skeleton'

const TONE_CLASS = {
  neutral: '',
  warning: 'border-l-4 border-l-marigold-500',
  danger: 'border-l-4 border-l-danger',
  success: 'border-l-4 border-l-success',
}

const TREND_ICON = { up: FiArrowUpRight, down: FiArrowDownRight, flat: FiMinus }

/**
 * Neutral, token-based metric card. Trend is always text + icon, never
 * colour alone. Clickable when `href` or `onClick` is given.
 */
export default function StatCard({
  label,
  value,
  hint = null,
  icon = null,
  trend = null,
  tone = 'neutral',
  href = null,
  onClick = null,
  loading = false,
  error = null,
  className = '',
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption font-medium text-muted">{label}</p>
        {icon ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : error ? (
        <p className="mt-3 text-sm font-medium text-danger">Unavailable</p>
      ) : (
        <p className="mt-2 text-3xl font-bold tabular-nums text-ink">{value ?? '—'}</p>
      )}
      {!loading && (hint || trend) ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-muted">
          {trend ? (
            <span className={`inline-flex items-center gap-1 font-medium ${trend.direction === 'up' ? 'text-success' : trend.direction === 'down' ? 'text-danger' : 'text-muted'}`}>
              {React.createElement(TREND_ICON[trend.direction] || FiMinus, { 'aria-hidden': 'true' })}
              {trend.value}
              {trend.label ? <span className="font-normal text-muted">{trend.label}</span> : null}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      ) : null}
    </>
  )

  const classes = `ui-card block p-5 text-left ${TONE_CLASS[tone] || ''} ${href || onClick ? 'ui-card-interactive' : ''} ${className}`.trim()
  const accessibleName = `${label}: ${loading ? 'loading' : error ? 'unavailable' : value ?? 'no data'}`

  if (href) {
    return (
      <Link to={href} className={classes} aria-label={`${accessibleName}, open`}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classes} w-full`} aria-label={`${accessibleName}, open`}>
        {body}
      </button>
    )
  }
  return (
    <div className={classes} aria-busy={loading || undefined}>
      {body}
    </div>
  )
}
