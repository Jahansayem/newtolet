'use client'

import React, { useState } from 'react'
import { FiPlus } from 'react-icons/fi'
import { addCustomerOrderMatch, updateCustomerOrderMatch } from '../../../services/admin/customerOrders'
import { useAdminMutation } from '../hooks/useAdminMutation'
import ActionMenu from '../../ui/ActionMenu'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmDialog from '../../ui/ConfirmDialog'
import FormDialog from '../../ui/FormDialog'

const bdt = (value) => `৳${Number(value || 0).toLocaleString('en-US')}`
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

const EMPTY_DRAFT = { reference_id: '', general_location: '', rent: '', verification_status: 'unverified', owner_contact_phone: '', exact_address: '', owner_permission: false }

/**
 * Listings found for an order. The counts shown at the top of the order and in
 * the list are derived from these rows on the server; there is no count field.
 * Owner phone and exact address are internal: the agent API returns them only
 * for a fully paid + verified order where the owner agreed.
 */
export default function MatchesPanel({ order, matches = [], onChanged }) {
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)

  const updateMutation = useAdminMutation((matchId, patch) => updateCustomerOrderMatch(matchId, patch), {
    successMessage: (_result, _matchId, patch) => (patch.removed ? 'Listing removed from the order' : 'Listing updated'),
    errorMessage: 'Listing could not be updated',
    invalidate: ['customer-orders'],
    onSuccess: () => onChanged?.(),
  })

  const busy = updateMutation.busy
  const menuItems = (match) => [
    match.verification_status === 'verified'
      ? { key: 'unverify', label: 'Mark unverified', disabled: busy, onSelect: () => updateMutation.run(match.id, { verification_status: 'unverified' }) }
      : { key: 'verify', label: 'Mark verified', disabled: busy, onSelect: () => updateMutation.run(match.id, { verification_status: 'verified' }) },
    match.owner_permission
      ? { key: 'revoke', label: 'Withdraw owner permission', disabled: busy, onSelect: () => updateMutation.run(match.id, { owner_permission: false }) }
      : { key: 'permit', label: 'Record owner permission', disabled: busy, onSelect: () => updateMutation.run(match.id, { owner_permission: true }) },
    { key: 'remove', label: 'Remove from order', tone: 'danger', disabled: busy, onSelect: () => setRemoveTarget(match) },
  ]

  return (
    <section className="ui-card space-y-4 p-4" aria-labelledby="co-matches-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="co-matches-heading" className="text-base font-semibold text-ink">Listings found</h3>
          <p className="text-caption text-muted">
            {order.listings_found_count} total · {order.listings_verified_count} verified · {order.listings_unverified_count} unverified
          </p>
        </div>
        <Button variant="secondary" icon={<FiPlus />} onClick={() => setAddOpen(true)}>
          Attach listing
        </Button>
      </div>

      {matches.length === 0 ? (
        <p className="text-sm text-muted">No listing has been attached to this order yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line">
          {matches.map((match) => (
            <li key={match.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {match.general_location || 'Location not recorded'}
                  {match.rent !== null && match.rent !== undefined ? <span className="tabular-nums"> · {bdt(match.rent)}</span> : null}
                </p>
                <p className="text-caption text-muted">
                  Ref {match.reference_id} · added by {match.created_by_label} · {formatDate(match.created_at)}
                </p>
                {match.owner_contact_phone || match.exact_address ? (
                  <p className="text-caption text-muted">
                    Owner: {match.owner_contact_phone || 'no phone'}
                    {match.exact_address ? ` · ${match.exact_address}` : ''}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={match.verification_status === 'verified' ? 'success' : 'neutral'}>
                  {match.verification_status === 'verified' ? 'Verified' : 'Unverified'}
                </Badge>
                <Badge variant={match.owner_permission ? 'success' : 'neutral'}>{match.owner_permission ? 'Owner agreed' : 'No owner permission'}</Badge>
                <ActionMenu label={`Actions for listing ${match.reference_id}`} items={menuItems(match)} size="sm" iconOnly />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="ui-help">Reference IDs, Facebook group names and post links are internal. Never send them to a customer.</p>

      <AddMatchDialog open={addOpen} order={order} onClose={() => setAddOpen(false)} onAdded={onChanged} />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={async () => {
          const target = removeTarget
          setRemoveTarget(null)
          await updateMutation.run(target.id, { removed: true })
        }}
        title="Remove this listing from the order?"
        description={removeTarget ? `Ref ${removeTarget.reference_id} will no longer count towards the listings found. The removal stays on the timeline.` : ''}
        confirmLabel="Remove listing"
        busy={updateMutation.busy}
        busyLabel="Removing…"
      />
    </section>
  )
}

const AddMatchDialog = ({ open, order, onClose, onAdded }) => {
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [seed, setSeed] = useState(false)
  const [localError, setLocalError] = useState(null)
  if (open !== seed) {
    setSeed(open)
    if (open) {
      setDraft(EMPTY_DRAFT)
      setLocalError(null)
    }
  }

  const mutation = useAdminMutation((id, match) => addCustomerOrderMatch(id, match), {
    successMessage: 'Listing attached',
    errorMessage: 'Listing could not be attached',
    invalidate: ['customer-orders'],
  })

  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }))

  const submit = async () => {
    setLocalError(null)
    if (!draft.reference_id.trim()) return setLocalError('The internal reference ID is required.')
    const match = { reference_id: draft.reference_id.trim(), verification_status: draft.verification_status, owner_permission: draft.owner_permission }
    if (draft.general_location.trim()) match.general_location = draft.general_location.trim()
    if (draft.rent !== '') match.rent = Number(draft.rent)
    if (draft.owner_contact_phone.trim()) match.owner_contact_phone = draft.owner_contact_phone.trim()
    if (draft.exact_address.trim()) match.exact_address = draft.exact_address.trim()
    const result = await mutation.run(order.id, match)
    if (result.error) return undefined
    onAdded?.()
    return onClose()
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={`Attach a listing to ${order.order_no}`}
      description="One property preview found for this customer."
      submitLabel="Attach listing"
      busy={mutation.busy}
      error={localError || mutation.error}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="ui-label" htmlFor="co-match-ref">Reference ID</label>
          <input id="co-match-ref" className="ui-field" required maxLength={255} value={draft.reference_id} onChange={set('reference_id')} />
          <p className="ui-help">Internal only.</p>
        </div>
        <div>
          <label className="ui-label" htmlFor="co-match-status">Verification</label>
          <select id="co-match-status" className="ui-field" value={draft.verification_status} onChange={set('verification_status')}>
            <option value="unverified">Unverified</option>
            <option value="verified">Verified</option>
          </select>
        </div>
        <div>
          <label className="ui-label" htmlFor="co-match-location">General location</label>
          <input id="co-match-location" className="ui-field" maxLength={255} placeholder="Mirpur 10" value={draft.general_location} onChange={set('general_location')} />
        </div>
        <div>
          <label className="ui-label" htmlFor="co-match-rent">Rent (BDT)</label>
          <input id="co-match-rent" className="ui-field" type="number" min={0} step={1} value={draft.rent} onChange={set('rent')} />
        </div>
        <div>
          <label className="ui-label" htmlFor="co-match-phone">Owner phone</label>
          <input id="co-match-phone" className="ui-field" inputMode="tel" maxLength={20} value={draft.owner_contact_phone} onChange={set('owner_contact_phone')} />
        </div>
        <div>
          <label className="ui-label" htmlFor="co-match-address">Exact address</label>
          <input id="co-match-address" className="ui-field" maxLength={2000} value={draft.exact_address} onChange={set('exact_address')} />
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line p-4">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={draft.owner_permission} onChange={(event) => setDraft((current) => ({ ...current, owner_permission: event.target.checked }))} />
        <span>
          <span className="block text-sm font-semibold text-ink">The owner agreed to share their contact</span>
          <span className="ui-help block">Owner phone and address reach the customer only after the full charge is paid and verified.</span>
        </span>
      </label>
    </FormDialog>
  )
}
