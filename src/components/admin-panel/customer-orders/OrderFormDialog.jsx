'use client'

import React, { useState } from 'react'
import { createCustomerOrder, getDuplicateOrderNo, updateCustomerOrder } from '../../../services/admin/customerOrders'
import { SOURCE_LABELS } from '../../../lib/customerOrderStatus'
import {
  changedFields,
  countChoices,
  draftFrom,
  facilityChoices,
  gasChoices,
  normalise,
  parseFacilities,
  sourceChoices,
} from '../../../lib/customerOrderForm'
import { useAdminMutation } from '../hooks/useAdminMutation'
import Button from '../../ui/Button'
import FormDialog from '../../ui/FormDialog'
import InlineAlert from '../../ui/InlineAlert'

const Field = ({ id, label, help = null, children }) => (
  <div>
    <label className="ui-label" htmlFor={id}>{label}</label>
    {children}
    {help ? <p className="ui-help">{help}</p> : null}
  </div>
)

/** A labelled set of tick options (radios or checkboxes). */
const ChoiceGroup = ({ id, label, role = 'group', help = null, className = '', children }) => (
  <div className={className} role={role} aria-labelledby={`${id}-label`}>
    <span id={`${id}-label`} className="ui-label">{label}</span>
    <div className="flex flex-wrap gap-x-5 gap-y-1">{children}</div>
    {help ? <p className="ui-help">{help}</p> : null}
  </div>
)

const Choice = ({ type, label, ...input }) => (
  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-ink">
    <input type={type} className="h-5 w-5 accent-brand" {...input} />
    <span>{label}</span>
  </label>
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
  const setValue = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const toggleFacility = (item) =>
    setDraft((current) => ({
      ...current,
      facilities: current.facilities.includes(item) ? current.facilities.filter((entry) => entry !== item) : [...current.facilities, item],
    }))

  // Options come from the stored order, so an older value stays on screen even after it is unticked.
  const sources = sourceChoices(order?.source)
  const gasOptions = gasChoices(draftFrom(order).gas)
  const facilityOptions = facilityChoices(parseFacilities(order?.facilities))

  const submit = async ({ confirmDuplicate = false } = {}) => {
    setLocalError(null)
    const values = normalise(draft)
    if (!values.customer_name) return setLocalError('Customer name is required.')
    if (!isEdit && !values.customer_phone) return setLocalError('Phone number is required.')
    if (values.budget_min !== null && values.budget_max !== null && values.budget_min > values.budget_max) {
      return setLocalError('Minimum budget cannot be greater than maximum budget.')
    }

    let payload
    if (isEdit) {
      payload = changedFields(values, order)
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
          <Field id="co-phone" label="Phone" help="11 digits, for example 01712345678">
            <input id="co-phone" className="ui-field" inputMode="tel" required={!isEdit} maxLength={20} placeholder="01XXXXXXXXX" value={draft.customer_phone} onChange={set('customer_phone')} />
          </Field>
          <ChoiceGroup id="co-source" label="Source" role="radiogroup" className="sm:col-span-2">
            {sources.map((value) => (
              <Choice
                key={value}
                type="radio"
                name="co-source"
                label={SOURCE_LABELS[value] || value}
                value={value}
                checked={draft.source === value}
                disabled={order?.source === 'website'}
                onChange={set('source')}
              />
            ))}
          </ChoiceGroup>
          <Field id="co-fb-name" label="Facebook profile name">
            <input id="co-fb-name" className="ui-field" maxLength={255} value={draft.facebook_name} onChange={set('facebook_name')} />
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
            <select id="co-rooms" className="ui-field" value={draft.rooms} onChange={set('rooms')}>
              <option value="">Not specified</option>
              {countChoices(order?.rooms).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field id="co-move-in" label="Move-in date">
            <input id="co-move-in" className="ui-field" type="date" value={draft.move_in_date} onChange={set('move_in_date')} />
          </Field>
          <Field id="co-bathrooms" label="Bathrooms">
            <select id="co-bathrooms" className="ui-field" value={draft.bathrooms} onChange={set('bathrooms')}>
              <option value="">Not specified</option>
              {countChoices(order?.bathrooms).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field id="co-balconies" label="Balconies">
            <input id="co-balconies" className="ui-field" type="number" min={0} max={50} step={1} value={draft.balconies} onChange={set('balconies')} />
          </Field>
          <ChoiceGroup id="co-gas" label="Gas">
            {gasOptions.map((option) => (
              <Choice
                key={option.value}
                type="checkbox"
                label={option.label}
                checked={draft.gas === option.value}
                onChange={(event) => setValue('gas', event.target.checked ? option.value : '')}
              />
            ))}
          </ChoiceGroup>
          <Field id="co-follow-up" label="Follow up at" help="Shows as overdue on the dashboard once it passes.">
            <input id="co-follow-up" className="ui-field" type="datetime-local" value={draft.follow_up_at} onChange={set('follow_up_at')} />
          </Field>
        </div>
        <ChoiceGroup id="co-facilities" label="Facilities">
          {facilityOptions.map((item) => (
            <Choice key={item} type="checkbox" label={item} checked={draft.facilities.includes(item)} onChange={() => toggleFacility(item)} />
          ))}
        </ChoiceGroup>
        <Field id="co-notes" label="Requirement notes">
          <textarea id="co-notes" className="ui-field" rows={3} maxLength={2000} value={draft.requirement_notes} onChange={set('requirement_notes')} />
        </Field>
      </fieldset>
    </FormDialog>
  )
}
