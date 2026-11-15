'use client'

import React, { useMemo } from 'react'
import { describeActor, describeTimelineItem } from '../../../lib/customerOrderStatus'
import Badge from '../../ui/Badge'

const dayKey = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const formatTime = (value) => new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** Status changes, notes and activity for one order, newest first, grouped by day. */
export default function OrderTimeline({ items = [] }) {
  const groups = useMemo(() => {
    const byDay = []
    for (const item of items) {
      const key = dayKey(item.at)
      const last = byDay[byDay.length - 1]
      if (last && last.key === key) last.items.push(item)
      else byDay.push({ key, items: [item] })
    }
    return byDay
  }, [items])

  if (items.length === 0) return <p className="text-sm text-muted">Nothing has happened on this order yet.</p>

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          <h4 className="text-caption font-semibold uppercase tracking-wide text-muted">{group.key}</h4>
          <ol className="mt-1 divide-y divide-line rounded-[var(--radius-card)] border border-line">
            {group.items.map((item, index) => {
              const summary = describeTimelineItem(item)
              return (
                <li key={`${item.kind}-${item.at}-${index}`} className="flex flex-wrap items-start gap-3 px-3 py-2 text-sm">
                  <span className="w-12 shrink-0 tabular-nums text-caption text-muted">{formatTime(item.at)}</span>
                  <Badge variant={summary.variant}>{summary.title}</Badge>
                  <span className="min-w-0 flex-1">
                    {summary.detail ? <span className="block whitespace-pre-wrap break-words text-ink">{summary.detail}</span> : null}
                    <span className="block text-caption text-muted">{describeActor(item)}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
