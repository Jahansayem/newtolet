'use client'

import React, { useEffect, useId, useState } from 'react'
import { FiCheck, FiEdit2 } from 'react-icons/fi'
import { listProperties, setPropertyStatus } from '../../../../services/admin/properties'
import { buildComparison, countDifferences, planKeepOne } from '../../../../lib/duplicateCompare'
import { buildAdminEditPropertyHref } from '../../../../lib/routePaths'
import { getPropertyDisplayLabel } from '../../../../utils/propertyDisplaySerial'
import { useToast } from '../../../ui/ToastProvider'
import Badge from '../../../ui/Badge'
import Button from '../../../ui/Button'
import ConfirmDialog from '../../../ui/ConfirmDialog'
import Dialog from '../../../ui/Dialog'
import InlineAlert from '../../../ui/InlineAlert'
import StatusPill from '../../../ui/StatusPill'

const MAX_LISTINGS = 20
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * Listings that share a phone number, side by side: one column per listing,
 * one row per field, rows that differ marked. "Keep this one" approves that
 * listing and, by the admin's choice for this group, rejects the other
 * pending listings as duplicates or leaves them as they are.
 */
export default function DuplicateCompare({ phoneKey, phoneNumber = '', heldIds = null, canModerate = false, onClose, onEdit, onViewList, onChanged }) {
  const toast = useToast()
  const choiceName = useId()
  const [state, setState] = useState({ key: null, status: 'loading', items: [], total: 0, error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const [keep, setKeep] = useState(null)
  const [othersAction, setOthersAction] = useState('reject')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!phoneKey) return undefined
    const controller = new AbortController()
    void listProperties({ page: 1, pageSize: MAX_LISTINGS, filters: { status: '', phoneKey } }, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted || result.error?.code === 'ABORTED') return
      if (result.error) setState({ key: phoneKey, status: 'error', items: [], total: 0, error: result.error })
      else setState({ key: phoneKey, status: 'ready', items: result.data || [], total: result.totalCount ?? (result.data || []).length, error: null })
    })
    return () => controller.abort()
  }, [phoneKey, reloadKey])

  const current = state.key === phoneKey ? state : { status: 'loading', items: [], total: 0, error: null }
  // A listing approved with the Undo toast still open already counts as approved here.
  const listings = current.items.map((item) => (heldIds?.has(item.id) && item.status !== 'approved' ? { ...item, status: 'approved' } : item))
  const rows = buildComparison(listings)
  const differences = countDifferences(rows)
  const labelOf = (listing) => getPropertyDisplayLabel(listing) || 'this listing'

  const plan = keep ? planKeepOne(listings, keep.id, othersAction) : null
  const pendingOthers = keep ? listings.filter((listing) => listing.id !== keep.id && listing.status === 'pending').length : 0
  const settledOthers = keep ? listings.length - 1 - pendingOthers : 0

  const startKeep = (listing) => {
    setOthersAction('reject')
    setKeep(listing)
  }

  const confirmKeep = async () => {
    if (!keep || !plan) return
    const keepLabel = labelOf(keep)
    setBusy(true)
    // Approve first: if the second step fails, the kept listing is live and
    // the others are still pending, never the other way round.
    if (plan.approveIds.length > 0) {
      const approved = await setPropertyStatus({ ids: plan.approveIds, status: 'approved' })
      if (approved.error) {
        setBusy(false)
        toast.error(`${keepLabel} was not approved`, { description: `Nothing was changed. ${approved.error.message}` })
        return
      }
    }
    let rejectError = null
    if (plan.rejectIds.length > 0) {
      const rejected = await setPropertyStatus({ ids: plan.rejectIds, status: 'rejected', reason: `Duplicate of ${keepLabel}.` })
      rejectError = rejected.error
    }
    setBusy(false)
    setKeep(null)
    setReloadKey((key) => key + 1)
    onChanged?.()
    if (rejectError) {
      toast.error('The other listings were not rejected', { description: `${keepLabel} is approved; the others are still pending. ${rejectError.message}` })
      return
    }
    toast.success(`Kept ${keepLabel}`, {
      description: plan.rejectIds.length > 0 ? `${plural(plan.rejectIds.length, 'other listing')} rejected as duplicates.` : 'The other listings were left as they are.',
    })
  }

  return (
    <>
      <Dialog
        open={Boolean(phoneKey)}
        onClose={onClose}
        title="Compare listings with the same phone"
        description={[phoneNumber || phoneKey, current.status === 'ready' ? plural(current.total, 'listing') : null].filter(Boolean).join(' · ')}
        size="2xl"
        fullScreenOnMobile
      >
        {current.status === 'loading' ? <p className="text-sm text-muted" role="status">Loading listings…</p> : null}
        {current.status === 'error' ? <InlineAlert variant="danger" action={{ label: 'Try again', onClick: () => setReloadKey((key) => key + 1) }}>{current.error?.message || 'The listings could not be loaded.'}</InlineAlert> : null}
        {current.status === 'ready' && listings.length < 2 ? (
          <InlineAlert variant="info">{listings.length === 0 ? 'No active listing uses this phone number.' : 'Only one active listing uses this phone number now, so there is nothing to compare.'}</InlineAlert>
        ) : null}

        {current.status === 'ready' && listings.length >= 2 ? (
          <div className="space-y-3" data-testid="duplicate-compare">
            <p className="text-sm text-muted" role="status">
              {differences === 0 ? 'These listings have the same details.' : `${plural(differences, 'field')} differ; they are marked.`}
              {current.total > listings.length ? ` Showing the ${listings.length} newest of ${current.total}.` : ''}
              {onViewList ? (
                <>
                  {' '}
                  <button type="button" className="font-medium text-brand hover:underline" onClick={onViewList}>
                    View them in the list
                  </button>
                </>
              ) : null}
            </p>
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
              <table className="ui-table ui-table-dense">
                <caption className="sr-only">Listings sharing phone {phoneNumber || phoneKey}, compared field by field</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-36 min-w-36">Field</th>
                    {listings.map((listing) => {
                      const label = labelOf(listing)
                      return (
                        <th key={listing.id} scope="col" className="min-w-56 normal-case tracking-normal" data-listing-id={listing.property_id_number}>
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="ui-id-ticket">{label}</span>
                              <StatusPill status={listing.status} />
                            </div>
                            <div className="h-24 w-full overflow-hidden rounded-[var(--radius-chip)] bg-canvas">
                              {listing.primary_image ? <img src={listing.primary_image} alt={`First photo of ${label}`} className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full items-center justify-center text-caption font-normal text-muted">No photo</span>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {canModerate ? (
                                <Button size="sm" variant="primary" icon={<FiCheck />} aria-label={`Keep ${label}`} onClick={() => startKeep(listing)}>
                                  Keep this one
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<FiEdit2 />}
                                aria-label={`Edit ${label}`}
                                href={buildAdminEditPropertyHref(listing.id)}
                                onClick={(event) => {
                                  event.preventDefault()
                                  onEdit?.(listing.id)
                                }}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} data-field={row.key} data-differs={row.differs ? 'true' : 'false'}>
                      <th scope="row" className="normal-case tracking-normal">
                        <span className="text-sm font-semibold text-ink">{row.label}</span>
                        {row.differs ? (
                          <Badge variant="warning" className="ml-2">
                            Differs
                          </Badge>
                        ) : null}
                      </th>
                      {row.values.map((value, index) => (
                        <td key={listings[index].id} className={row.differs ? 'bg-marigold-soft' : ''}>
                          {row.key === 'status' ? (
                            <StatusPill status={value} />
                          ) : value ? (
                            <span className={`break-words ${row.key === 'description' ? 'whitespace-pre-wrap' : ''}`}>{value}</span>
                          ) : (
                            <span className="text-muted">Empty</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(keep)}
        onCancel={() => (busy ? null : setKeep(null))}
        onConfirm={confirmKeep}
        title={keep ? `Keep ${labelOf(keep)}?` : 'Keep this listing?'}
        description={
          keep
            ? keep.status === 'approved'
              ? `${labelOf(keep)} is already approved and stays live.`
              : `${labelOf(keep)} is approved and becomes public.`
            : null
        }
        confirmLabel={plan && plan.rejectIds.length > 0 ? `Keep it and reject ${plural(plan.rejectIds.length, 'other')}` : 'Keep it'}
        tone="primary"
        busy={busy}
        busyLabel="Working…"
      >
        {keep ? (
          <fieldset className="mt-4" disabled={busy}>
            <legend className="ui-label">The other {plural(pendingOthers, 'pending listing')}</legend>
            {pendingOthers === 0 ? (
              <p className="text-sm text-muted">There are no other pending listings in this group.</p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="radio" className="mt-1" name={choiceName} value="reject" checked={othersAction === 'reject'} onChange={() => setOthersAction('reject')} />
                  <span>
                    Reject as duplicates
                    <span className="block text-caption text-muted">Their owners see “Duplicate of {labelOf(keep)}.”</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="radio" className="mt-1" name={choiceName} value="leave" checked={othersAction === 'leave'} onChange={() => setOthersAction('leave')} />
                  <span>
                    Leave them pending
                    <span className="block text-caption text-muted">Nothing else changes; decide on them later.</span>
                  </span>
                </label>
              </div>
            )}
            {settledOthers > 0 ? <p className="mt-3 text-caption text-muted">{plural(settledOthers, 'listing')} already approved or rejected in this group {settledOthers === 1 ? 'is' : 'are'} not changed.</p> : null}
          </fieldset>
        ) : null}
      </ConfirmDialog>
    </>
  )
}
