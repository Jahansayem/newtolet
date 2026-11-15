'use client'

import React, { useState } from 'react'
import { createCustomerOrder, getDuplicateOrderNo, updateCustomerOrder } from '../../../services/admin/customerOrders'
import { SOURCE_LABELS } from '../../../lib/customerOrderStatus'
import { useAdminMutation } from '../hooks/useAdminMutation'
import Button from '../../ui/Button'
import FormDialog from '../../ui/FormDialog'
import InlineAlert from '../../ui/InlineAlert'

const TEXT_FIELDS = ['customer_name', 'customer_phone', 'facebook_name', 'facebook_thread_url', 'source', 'area', 'move_in_date', 'tenant_type', 'gas', 'facilities', 'requirement_notes']
const NUMBER_FIELDS = ['rooms', 'budget_min', 'budget_max', 'bathrooms', 'balconies']
const MANUAL_SOURCES = ['manual', 'phone', 'messenger', 'lead_generation']

const toLocalInput = (iso) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const draftFrom = (order) => {
  const draft = { follow_up_at: toLocalInput(order?.follow_up_at), assigned_to: order?.assigned_to || '' }
  for (const key of TEXT_FIELDS) draft[key] = order?.[key] ?? ''
  for (const key of NUMBER_FIELDS) draft[key] = order?.[key] ?? ''
  if (!order) draft.source = 'manual'
  return draft
}

/** Draft -> { key: value|null } with trimmed text, whole numbers and an ISO follow-up time. */
const normalise = (draft) => {
  const values = {}
  for (const key of TEXT_FIELDS) values[key] = String(draft[key] ?? '').trim() || null
  for (const key of NUMBER_FIELDS) values[key] = draft[key] === '' || draft[key] === null ? null : Number(draft[key])
  values.follow_up_at = draft.follow_up_at ? new Date(draft.follow_up_at).toISOString() : null
  return values
}

const sameValue = (key, next, order) => {
  if (key === 'follow_up_at') return (next ? new Date(next).getTime() : null) === (order.follow_up_at ? new Date(order.follow_up_at).getTime() : null)
  return (next ?? null) === (order[key] ?? null)
}

const Field = ({ id, label, help = null, children }) => (
  <div>
    <label className="ui-label" htmlFor={id}>{label}</label>
    {children}
    {help ? <p className="ui-help">{help}</p> : null}
  </div>
)

/**
 * Create (order = null) or edit a customer order. The service charge is never
 * a field here: the server sets it. Status and payments have their own controls.
 */
export default function OrderFormDialog({ open, order = null, assignees = [], onClose, onSaved, onOpenExisting }) {
  const isEdit = Boolean(order)
  const [draft, setDraft] = useState(() => draftFrom(order))
  const [seed, setSeed] = useState(null)
  const [duplicateOf, setDuplicateOf] = useState(null)
  const [localError, setLocalError] = useState(null)

  // Reset the form each time the dialog opens for a different order (or for a new one).
  const seedKey = open ? order?.id || 'new' : null
  if (seedKey !== seed) {
    setSeed(seedKey)
    if (seedKey) {
      setDraft(draftFrom(order))
      setDuplicateOf(null)
      setLocalError(null)
    }
  }

  const mutation = useAdminMutation(
    (values, options) => (isEdit ? updateCustomerOrder(order.id, values) : createCustomerOrder(values, options)),
    {
      successMessage: (result) => (isEdit ? `Order ${result.data?.order_no || ''} updated` : `Order ${result.data?.order_no || ''} created`),
      // The duplicate warning is shown inline with a "Create anyway" choice, not as a failure toast.
      errorMessage: (error) => (getDuplicateOrderNo(error) ? 'Possible duplicate order' : 'Order could not be saved'),
      invalidate: ['customer-orders'],
    }
  )

  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }))

  const submit = async ({ confirmDuplicate = false } = {}) => {
    setLocalError(null)
    const values = normalise(draft)
    if (!values.customer_name) return setLocalError('Customer name is required.')
    if (!isEdit && !values.customer_phone && !values.facebook_thread_url) {
      return setLocalError('Add at least one contact channel: a phone number or the Facebook thread link.')
    }
    if (values.budget_min !== null && values.budget_max !== null && values.budget_min > values.budget_max) {
      return setLocalError('Minimum budget cannot be greater than maximum budget.')
    }

    let payload
    if (isEdit) {
      payload = {}
      for (const [key, value] of Object.entries(values)) {
        if (!sameValue(key, value, order)) payload[key] = value
      }
      if (Object.keys(payload).length === 0) return onClose()
    } else {
      payload = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null))
      if (draft.assigned_to) payload.assigned_to = draft.assigned_to
    }

    const result = await mutation.run(payload, { confirmDuplicate })
    if (result.error) {
      setDuplicateOf(getDuplicateOrderNo(result.error))
      return undefined
    }
    onSaved?.(result.data)
    return onClose()
  }

  const error = localError || (duplicateOf ? null : mutation.error)

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={() => submit()}
      title={isEdit ? `Edit order ${order.order_no}` : 'New customer order'}
      description={isEdit ? 'Customer details and requirements. Status and payments are changed from the order page.' : 'House search order. The 500 BDT service charge is set by the system.'}
      submitLabel={isEdit ? 'Save changes' : 'Create order'}
      busy={mutation.busy}
      error={error}
      size="xl"
      fullScreenOnMobile
    >
      {duplicateOf ? (
        <InlineAlert variant="warning" title={`Order ${duplicateOf} is already active for this customer and area`}>
          <p>Update that order instead of creating a second one, unless this really is a separate search.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onOpenExisting ? (
              <Button size="sm" variant="secondary" onClick={() => onOpenExisting(duplicateOf)}>
                Find {duplicateOf}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" busy={mutation.busy} onClick={() => submit({ confirmDuplicate: true })}>
              Create anyway
            </Button>
          </div>
        </InlineAlert>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="ui-eyebrow">Customer</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="co-name" label="Customer name">
            <input id="co-name" className="ui-field" required maxLength={255} value={draft.customer_name} onChange={set('customer_name')} />
          </Field>
          <Field id="co-phone" label="Phone" help="01XXXXXXXXX or +8801XXXXXXXXX">
            <input id="co-phone" className="ui-field" inputMode="tel" maxLength={20} value={draft.customer_phone} onChange={set('customer_phone')} />
          </Field>
          <Field id="co-fb-name" label="Facebook profile name">
            <input id="co-fb-name" className="ui-field" maxLength={255} value={draft.facebook_name} onChange={set('facebook_name')} />
          </Field>
          <Field id="co-fb-thread" label="Facebook thread link" help="Link to the Messenger conversation in Business Suite.">
            <input id="co-fb-thread" className="ui-field" type="url" maxLength={1000} placeholder="https://" value={draft.facebook_thread_url} onChange={set('facebook_thread_url')} />
          </Field>
          <Field id="co-source" label="Source">
            <select id="co-source" className="ui-field" value={draft.source} onChange={set('source')} disabled={draft.source === 'website'}>
              {draft.source === 'website' ? <option value="website">{SOURCE_LABELS.website}</option> : null}
              {MANUAL_SOURCES.map((value) => (
                <option key={value} value={value}>{SOURCE_LABELS[value]}</option>
              ))}
            </select>
          </Field>
          {!isEdit ? (
            <Field id="co-assignee" label="Assign to">
              <select id="co-assignee" className="ui-field" value={draft.assigned_to} onChange={set('assigned_to')}>
                <option value="">Unassigned</option>
                {assignees.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="ui-eyebrow">Requirements</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="co-area" label="Area" help="For example: Mirpur 10, Kazipara">
            <input id="co-area" className="ui-field" maxLength={255} value={draft.area} onChange={set('area')} />
          </Field>
          <Field id="co-tenant" label="Family or bachelor">
            <select id="co-tenant" className="ui-field" value={draft.tenant_type} onChange={set('tenant_type')}>
              <option value="">Not specified</option>
              <option value="family">Family</option>
              <option value="bachelor">Bachelor</option>
            </select>
          </Field>
          <Field id="co-budget-min" label="Budget from (BDT)">
            <input id="co-budget-min" className="ui-field" type="number" min={0} step={1} value={draft.budget_min} onChange={set('budget_min')} />
          </Field>
          <Field id="co-budget-max" label="Budget up to (BDT)">
            <input id="co-budget-max" className="ui-field" type="number" min={0} step={1} value={draft.budget_max} onChange={set('budget_max')} />
          </Field>
          <Field id="co-rooms" label="Rooms">
            <input id="co-rooms" className="ui-field" type="number" min={0} max={50} step={1} value={draft.rooms} onChange={set('rooms')} />
          </Field>
          <Field id="co-move-in" label="Move-in date">
            <input id="co-move-in" className="ui-field" type="date" value={draft.move_in_date} onChange={set('move_in_date')} />
          </Field>
          <Field id="co-bathrooms" label="Bathrooms">
            <input id="co-bathrooms" className="ui-field" type="number" min={0} max={50} step={1} value={draft.bathrooms} onChange={set('bathrooms')} />
          </Field>
          <Field id="co-balconies" label="Balconies">
            <input id="co-balconies" className="ui-field" type="number" min={0} max={50} step={1} value={draft.balconies} onChange={set('balconies')} />
          </Field>
          <Field id="co-gas" label="Gas">
            <input id="co-gas" className="ui-field" maxLength={255} placeholder="line / cylinder" value={draft.gas} onChange={set('gas')} />
          </Field>
          <Field id="co-follow-up" label="Follow up at" help="Shows as overdue on the dashboard once it passes.">
            <input id="co-follow-up" className="ui-field" type="datetime-local" value={draft.follow_up_at} onChange={set('follow_up_at')} />
          </Field>
        </div>
        <Field id="co-facilities" label="Facilities">
          <input id="co-facilities" className="ui-field" maxLength={2000} placeholder="lift, parking, generator…" value={draft.facilities} onChange={set('facilities')} />
        </Field>
        <Field id="co-notes" label="Requirement notes">
          <textarea id="co-notes" className="ui-field" rows={3} maxLength={2000} value={draft.requirement_notes} onChange={set('requirement_notes')} />
        </Field>
      </fieldset>
    </FormDialog>
  )
}
