'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { CUSTOMER_ORDERS_DOMAIN, getCustomerOrderCounts } from '../../../services/admin/customerOrders'
import { ADMIN_CACHE_EVENT } from '../../../services/admin/adminCache'
import { buildPageHref } from '../../../lib/routePaths'
import StatCard from '../../ui/StatCard'

const COUNTERS = [
  { key: 'open', field: 'open', label: 'Open orders', tone: 'neutral' },
  { key: 'awaiting', field: 'awaiting_verification', label: 'Payments to verify', tone: 'warning' },
  { key: 'refund', field: 'refund_window', label: 'In 7-day refund window', tone: 'neutral' },
  { key: 'overdue', field: 'overdue_follow_ups', label: 'Overdue follow-ups', tone: 'danger' },
  { key: 'zero', field: 'zero_listings', label: 'Open with 0 listings', tone: 'warning' },
]

/**
 * The five customer-order counters. Inside the Customer Orders section each
 * card toggles a list filter (`onSelect`); on the dashboard each card links to
 * the section with that filter applied. `hideOnError` drops the whole strip
 * when the counts cannot be read (no permission, or the migration is missing).
 */
export default function CustomerOrderCounters({ activeQueue = '', onSelect = null, hideOnError = false, refreshToken = 0, title = null }) {
  const [state, setState] = useState({ status: 'loading', data: null })

  const load = useCallback(async () => {
    const result = await getCustomerOrderCounts()
    setState(result.error ? { status: 'error', data: null } : { status: 'ready', data: result.data })
  }, [])

  useEffect(() => {
    void load()
    const onInvalidate = (event) => {
      if (!event.detail?.domain || event.detail.domain === CUSTOMER_ORDERS_DOMAIN) void load()
    }
    window.addEventListener(ADMIN_CACHE_EVENT, onInvalidate)
    return () => window.removeEventListener(ADMIN_CACHE_EVENT, onInvalidate)
  }, [load, refreshToken])

  if (hideOnError && state.status === 'error') return null

  const cards = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {COUNTERS.map((counter) => {
        const value = state.data?.[counter.field]
        const link = onSelect
          ? { onClick: () => onSelect(activeQueue === counter.key ? '' : counter.key) }
          : { href: buildPageHref('admin', { tab: 'customer-orders', queue: counter.key }) }
        return (
          <StatCard
            key={counter.key}
            label={counter.label}
            value={value}
            hint={activeQueue === counter.key ? 'Filter on' : null}
            loading={state.status === 'loading'}
            error={state.status === 'error' ? true : null}
            tone={value > 0 ? counter.tone : 'neutral'}
            {...link}
          />
        )
      })}
    </div>
  )

  if (!title) return cards
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {cards}
    </section>
  )
}
