'use client'

import React, { useMemo, useState } from 'react'
import { setCustomerOrderStatus } from '../../../services/admin/customerOrders'
import { getCustomerOrderStatusLabel, getStatusChangeOptions } from '../../../lib/customerOrderStatus'
import { useAdminMutation } from '../hooks/useAdminMutation'
import FormDialog from '../../ui/FormDialog'
import InlineAlert from '../../ui/InlineAlert'

const TARGET_HELP = {
  SEARCHING_BY_AI: 'AI agents search the Facebook groups for this customer.',
  SEARCHING_BY_HUMAN: 'A human agent takes over the search. Say who.',
  PREVIEWS_SENT: 'Previews were sent to the customer. Attach each one under Listings found first.',
  PAYMENT_INTERESTED: 'The customer explicitly agreed to pay.',
  MATCHED: 'The customer accepted a listing. Needs the full charge paid and verified.',
  COMPLETED: 'The service is finished. This cannot be undone.',
  REFUND_REQUESTED: 'No suitable property within 7 days of payment confirmation, or the customer asked for the refund.',
  REFUNDED: 'The bKash refund has been sent by staff. This cannot be undone.',
  CANCELLED: 'The customer dropped out before paying.',
  SELF_SERVICE: 'The customer declined the paid service and will search on the site.',
  PENDING: 'Reopen this order.',
}

/**
 * Status change with a mandatory reason. Only moves the server allows are
 * offered; payment statuses are absent because only a payment claim or a
 * claim review can set them.
 */
export default function StatusChangeDialog({ open, order, defaultTakenOverBy = '', onClose, onChanged }) {
  const options = useMemo(() => (order ? getStatusChangeOptions(order) : []), [order])
  const [toStatus, setToStatus] = useState('')
  const [reason, setReason] = useState('')
  const [takenOverBy, setTakenOverBy] = useState('')
  const [seed, setSeed] = useState(null)
  const [localError, setLocalError] = useState(null)

  const seedKey = open && order ? `${order.id}:${order.status}` : null
  if (seedKey !== seed) {
    setSeed(seedKey)
    if (seedKey) {
      setToStatus(options.find((option) => !option.disabled)?.value || '')
      setReason('')
      setTakenOverBy(defaultTakenOverBy || '')
      setLocalError(null)
    }
  }

  const mutation = useAdminMutation((id, payload) => setCustomerOrderStatus(id, payload), {
    successMessage: (result) => `Status changed to ${getCustomerOrderStatusLabel(result.data?.status)}`,
    errorMessage: 'Status could not be changed',
    invalidate: ['customer-orders'],
  })

  const needsTakeover = toStatus === 'SEARCHING_BY_HUMAN'
  const handingBack = order?.status === 'SEARCHING_BY_HUMAN' && toStatus === 'SEARCHING_BY_AI'

  const submit = async () => {
    setLocalError(null)
    if (!toStatus) return setLocalError('Choose the new status.')
    if (reason.trim().length < 3) return setLocalError('Write a short reason for this change.')
    if (needsTakeover && !takenOverBy.trim()) return setLocalError('Say who is taking over the search.')
    const result = await mutation.run(order.id, { status: toStatus, reason: reason.trim(), takenOverBy: needsTakeover ? takenOverBy.trim() : null })
    if (result.error) return undefined
    onChanged?.(result.data)
    return onClose()
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={order ? `Change status of ${order.order_no}` : 'Change status'}
      description={order ? `Current status: ${getCustomerOrderStatusLabel(order.status)}` : null}
      submitLabel="Change status"
      submitDisabled={options.every((option) => option.disabled)}
      submitVariant={toStatus === 'CANCELLED' || toStatus === 'REFUNDED' ? 'danger' : 'primary'}
      busy={mutation.busy}
      error={localError || mutation.error}
    >
      {options.length === 0 ? (
        <InlineAlert variant="info">This order is closed. Its status can no longer be changed.</InlineAlert>
      ) : (
        <>
          <div>
            <label className="ui-label" htmlFor="co-status-to">New status</label>
            <select id="co-status-to" className="ui-field" value={toStatus} onChange={(event) => setToStatus(event.target.value)}>
              {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                  {option.hint ? ` (${option.hint})` : ''}
                </option>
              ))}
            </select>
            {TARGET_HELP[toStatus] ? <p className="ui-help">{TARGET_HELP[toStatus]}</p> : null}
          </div>
          {needsTakeover ? (
            <div>
              <label className="ui-label" htmlFor="co-status-taken">Who took over the search</label>
              <input id="co-status-taken" className="ui-field" maxLength={255} value={takenOverBy} onChange={(event) => setTakenOverBy(event.target.value)} />
            </div>
          ) : null}
          <div>
            <label className="ui-label" htmlFor="co-status-reason">Reason</label>
            <textarea id="co-status-reason" className="ui-field" rows={3} maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} />
            <p className="ui-help">
              {handingBack ? 'Say why the search goes back to the AI agents. ' : ''}
              Recorded on the timeline with your name. Never shown to the customer.
            </p>
          </div>
          <p className="ui-help">Payment claimed, verified and failed are not in this list: they are set by recording or reviewing a payment.</p>
        </>
      )}
    </FormDialog>
  )
}
