import React from 'react'
import Badge from './Badge'

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'object') return JSON.stringify(value, null, 1)
  return String(value)
}

const Cell = ({ value }) => {
  const text = formatValue(value)
  if (text === null) return <span className="text-subtle" aria-label="empty">—</span>
  return <span className="break-words whitespace-pre-wrap">{text}</span>
}

/**
 * Definition list. In `diff` mode each item shows before/after values,
 * labelled with text badges (not colour alone).
 */
export default function KeyValueList({ items = [], columns = 1, diff = false, className = '' }) {
  return (
    <dl className={`grid gap-x-6 gap-y-3 ${columns === 2 ? 'sm:grid-cols-2' : ''} ${className}`.trim()}>
      {items.map((item) => (
        <div key={item.key || item.label} className="min-w-0">
          <dt className="text-caption font-semibold uppercase tracking-wide text-muted">{item.label}</dt>
          {diff ? (
            <dd className="mt-1 flex flex-col gap-1 text-sm text-ink">
              <span className="flex items-start gap-2">
                <Badge variant="danger">Before</Badge>
                <Cell value={item.before} />
              </span>
              <span className="flex items-start gap-2">
                <Badge variant="success">After</Badge>
                <Cell value={item.after} />
              </span>
            </dd>
          ) : (
            <dd className="mt-1 text-sm text-ink">
              <Cell value={item.value} />
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}

/** Build diff items from two plain objects (union of keys). */
export const diffItems = (before = {}, after = {}, labels = {}) => {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]))
  return keys
    .filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
    .map((key) => ({ key, label: labels[key] || key.replace(/_/g, ' '), before: before?.[key], after: after?.[key] }))
}
