'use client'

import React, { useEffect, useState } from 'react'
import { FiCheck, FiX } from 'react-icons/fi'
import { listProperties } from '../../../services/admin/properties'
import { getPropertyDisplayLabel } from '../../../utils/propertyDisplaySerial'
import Button from '../../ui/Button'
import InlineAlert from '../../ui/InlineAlert'
import StatusPill from '../../ui/StatusPill'

const rentText = (listing) => {
  if (listing.rent_amount_bdt) return `৳${Number(listing.rent_amount_bdt).toLocaleString()}${listing.rent_period ? ` / ${listing.rent_period}` : ''}`
  return listing.is_rent_negotiable ? 'Negotiable' : 'No rent'
}

/**
 * Other listings that share the edited listing's phone number, so duplicates
 * can be compared and decided without leaving the editor.
 */
export default function SamePhonePanel({ phoneKey, phoneNumber, excludeId, refreshKey = 0, heldIds = null, canModerate = false, onOpen, onApprove, onReject }) {
  const [state, setState] = useState({ status: 'loading', items: [], error: null })

  useEffect(() => {
    if (!phoneKey) {
      setState({ status: 'ready', items: [], error: null })
      return undefined
    }
    const controller = new AbortController()
    setState((current) => ({ ...current, status: 'loading', error: null }))
    void listProperties({ page: 1, pageSize: 20, filters: { status: '', phoneKey } }, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      if (result.error) {
        if (result.error.code !== 'ABORTED') setState({ status: 'error', items: [], error: result.error })
        return
      }
      setState({ status: 'ready', items: (result.data || []).filter((item) => item.id !== excludeId), error: null })
    })
    return () => controller.abort()
  }, [phoneKey, excludeId, refreshKey])

  const { status, items, error } = state

  return (
    <section className="ui-card p-4" aria-labelledby="same-phone-heading" data-testid="same-phone-panel">
      <h3 id="same-phone-heading" className="font-semibold text-ink">
        Other listings with this phone{status === 'ready' ? ` (${items.length})` : ''}
      </h3>
      {phoneNumber ? <p className="text-caption text-muted">{phoneNumber}</p> : null}

      {status === 'loading' ? <p className="mt-3 text-sm text-muted" role="status">Loading…</p> : null}
      {status === 'error' ? (
        <InlineAlert variant="danger" className="mt-3">
          {error?.message || 'The other listings could not be loaded.'}
        </InlineAlert>
      ) : null}
      {status === 'ready' && items.length === 0 ? <p className="mt-3 text-sm text-muted">No other listing uses this phone number.</p> : null}

      {items.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {items.map((item) => {
            const label = getPropertyDisplayLabel(item)
            const held = Boolean(heldIds?.has(item.id))
            const shownStatus = held ? 'approved' : item.status
            return (
              <li key={item.id} className="py-3" data-listing-id={item.property_id_number}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ui-id-ticket">{label}</span>
                  <StatusPill status={shownStatus} />
                </div>
                <p className="mt-1 text-sm text-ink">
                  {[rentText(item), `${item.total_rooms ?? '—'} rooms`, item.floor_level || 'No floor', item.area || 'No area'].join(' · ')}
                </p>
                <p className="mt-1 line-clamp-2 text-caption text-muted">{item.short_description || 'No description'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" aria-label={`Open ${label}`} onClick={() => onOpen?.(item.id)}>
                    Open
                  </Button>
                  {canModerate && shownStatus === 'pending' ? (
                    <>
                      <Button size="sm" variant="primary" icon={<FiCheck />} aria-label={`Approve ${label}`} onClick={() => onApprove?.(item)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger-outline" icon={<FiX />} aria-label={`Reject ${label}`} onClick={() => onReject?.(item)}>
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
