'use client'

import React, { useState } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'
import { createPaymentLink, searchOrdersForPaymentLink } from '../../../services/admin/paymentLinks'
import { getCustomerOrderStatusLabel, isClosedStatus } from '../../../lib/customerOrderStatus'
import {
  PAYMENT_LINK_AMOUNT_MAX,
  PAYMENT_LINK_AMOUNT_MIN,
  PAYMENT_LINK_QUICK_AMOUNTS,
  formatBdt,
  validatePaymentLinkForm,
} from '../../../lib/paymentLinks'
import { useAdminMutation } from '../hooks/useAdminMutation'
import Button from '../../ui/Button'
import FormDialog from '../../ui/FormDialog'

const EMPTY = { amount: '', purpose: '', customerName: '', customerPhone: '', customerEmail: '', note: '' }

const Field = ({ id, label, help = null, optional = false, children }) => (
  <div className="min-w-0">
    <label className="ui-label" htmlFor={id}>
      {label}
      {optional ? <span className="ml-1 font-normal text-muted">(optional)</span> : null}
    </label>
    {children}
    {help ? <p className="ui-help">{help}</p> : null}
  </div>
)

/**
 * "New payment link". `presetOrder` ({ id, order_no, customer_name,
 * customer_phone, amount_due }) opens the form already attached to a Customer
 * Order, with the amount due filled in.
 */
export default function PaymentLinkFormDialog({ open, onClose, onCreated, presetOrder = null }) {
  const [form, setForm] = useState(EMPTY)
  const [order, setOrder] = useState(null)
  const [orderTerm, setOrderTerm] = useState('')
  const [orderResults, setOrderResults] = useState(null)
  const [orderSearching, setOrderSearching] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [localError, setLocalError] = useState(null)
  const [seed, setSeed] = useState(false)

  // Reset when the dialog opens (state is seeded during render, as in OrderFormDialog).
  if (open !== seed) {
    setSeed(open)
    if (open) {
      setForm(
        presetOrder
          ? {
              ...EMPTY,
              amount: Number(presetOrder.amount_due) > 0 ? String(presetOrder.amount_due) : '',
              purpose: `Service charge for order ${presetOrder.order_no}`,
              customerName: presetOrder.customer_name || '',
              customerPhone: presetOrder.customer_phone || '',
            }
          : EMPTY
      )
      setOrder(presetOrder)
      setOrderTerm('')
      setOrderResults(null)
      setOrderError(null)
      setLocalError(null)
    }
  }

  const mutation = useAdminMutation((values) => createPaymentLink(values), {
    successMessage: 'Payment link created',
    errorMessage: 'The payment link could not be created',
    invalidate: ['payment-links'],
  })

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const searchOrders = async () => {
    const term = orderTerm.trim()
    if (term.length < 3) {
      setOrderError('Type at least 3 characters of the order number, phone or name.')
      return
    }
    setOrderError(null)
    setOrderSearching(true)
    const result = await searchOrdersForPaymentLink(term)
    setOrderSearching(false)
    if (result.error) {
      setOrderResults(null)
      setOrderError(result.error.permissionDenied ? 'Attaching an order needs access to Customer Orders.' : result.error.message)
      return
    }
    setOrderResults(result.data)
  }

  const pickOrder = (picked) => {
    setOrder(picked)
    setOrderResults(null)
    setOrderTerm('')
    setForm((current) => ({
      ...current,
      amount: current.amount || (Number(picked.amount_due) > 0 ? String(picked.amount_due) : ''),
      purpose: current.purpose || `Service charge for order ${picked.order_no}`,
      customerName: current.customerName || picked.customer_name || '',
      customerPhone: current.customerPhone || picked.customer_phone || '',
    }))
  }

  const submit = async () => {
    const { values, error } = validatePaymentLinkForm({ ...form, customerOrderId: order?.id || null })
    if (error) {
      setLocalError(error)
      return
    }
    setLocalError(null)
    const result = await mutation.run(values)
    if (result.error) return
    onCreated?.(result.data)
    onClose?.()
  }

  const amountNumber = Number(form.amount)

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title="New payment link"
      description="The customer opens the link, sees the amount and pays through EPS. One payment closes the link."
      submitLabel="Create link"
      busy={mutation.busy}
      busyLabel="Creating…"
      error={localError || mutation.error}
      size="lg"
      fullScreenOnMobile
    >
      <fieldset className="space-y-4">
        <legend className="ui-eyebrow">Payment</legend>
        <Field id="pl-amount" label="Amount (BDT)" help={`Whole taka, ${formatBdt(PAYMENT_LINK_AMOUNT_MIN)} to ${formatBdt(PAYMENT_LINK_AMOUNT_MAX)}.`}>
          <input
            id="pl-amount"
            data-autofocus
            className="ui-field tabular-nums"
            type="number"
            inputMode="numeric"
            min={PAYMENT_LINK_AMOUNT_MIN}
            max={PAYMENT_LINK_AMOUNT_MAX}
            step={1}
            required
            value={form.amount}
            onChange={set('amount')}
          />
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Common amounts">
            {PAYMENT_LINK_QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                className={`ui-chip min-h-9 tabular-nums ${amountNumber === amount ? 'border-brand bg-brand-soft text-brand' : ''}`}
                aria-pressed={amountNumber === amount}
                onClick={() => setForm((current) => ({ ...current, amount: String(amount) }))}
              >
                {formatBdt(amount)}
              </button>
            ))}
          </div>
        </Field>
        <Field id="pl-purpose" label="What it is for" help="Shown to the customer on the pay page, for example: Service charge for house search.">
          <input id="pl-purpose" className="ui-field" maxLength={120} required value={form.purpose} onChange={set('purpose')} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 border-t border-line pt-4">
        <legend className="ui-eyebrow">Customer</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pl-name" label="Name" optional>
            <input id="pl-name" className="ui-field" maxLength={80} autoComplete="off" value={form.customerName} onChange={set('customerName')} />
          </Field>
          <Field id="pl-phone" label="Mobile number" optional>
            <input id="pl-phone" className="ui-field tabular-nums" inputMode="tel" maxLength={17} autoComplete="off" placeholder="01XXXXXXXXX" value={form.customerPhone} onChange={set('customerPhone')} />
          </Field>
        </div>
        <p className="ui-help">Leave these empty and the pay page asks the customer for them before paying.</p>
      </fieldset>

      <fieldset className="space-y-3 border-t border-line pt-4">
        <legend className="ui-eyebrow">Customer order</legend>
        {order ? (
          <div className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-canvas p-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-ink">{order.order_no}</p>
              <p className="text-caption text-muted">
                {order.customer_name}
                {order.customer_phone ? ` · ${order.customer_phone}` : ''}
                {order.amount_due !== undefined && order.amount_due !== null ? ` · due ${formatBdt(order.amount_due)}` : ''}
              </p>
              <p className="ui-help">When this link is paid, the payment is recorded and verified on this order.</p>
            </div>
            <Button size="sm" variant="ghost" iconOnly aria-label={`Detach order ${order.order_no}`} icon={<FiX />} onClick={() => setOrder(null)} />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="ui-label" htmlFor="pl-order-search">
                  Attach to an order<span className="ml-1 font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="pl-order-search"
                  className="ui-field"
                  placeholder="Order number, phone or name"
                  value={orderTerm}
                  onChange={(event) => setOrderTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void searchOrders()
                    }
                  }}
                />
              </div>
              <Button variant="secondary" icon={<FiSearch />} busy={orderSearching} busyLabel="Searching…" onClick={() => void searchOrders()}>
                Find order
              </Button>
            </div>
            {orderError ? <p className="ui-error" role="alert">{orderError}</p> : null}
            {orderResults ? (
              orderResults.length === 0 ? (
                <p className="text-sm text-muted" role="status">No customer order matches that.</p>
              ) : (
                <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line" aria-label="Matching customer orders">
                  {orderResults.map((result) => {
                    const closed = isClosedStatus(result.status)
                    return (
                      <li key={result.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">
                            {result.order_no} · {result.customer_name}
                          </p>
                          <p className="text-caption text-muted">
                            {getCustomerOrderStatusLabel(result.status)}
                            {result.customer_phone ? ` · ${result.customer_phone}` : ''} · due {formatBdt(result.amount_due)}
                          </p>
                        </div>
                        <Button size="sm" variant="secondary" disabled={closed} onClick={() => pickOrder(result)} aria-label={`Attach order ${result.order_no}`}>
                          {closed ? 'Closed' : 'Attach'}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )
            ) : null}
          </>
        )}
      </fieldset>

      <fieldset className="border-t border-line pt-4">
        <legend className="ui-eyebrow">Internal</legend>
        <Field id="pl-note" label="Note" optional help="Only admins see this.">
          <textarea id="pl-note" className="ui-field" rows={2} maxLength={500} value={form.note} onChange={set('note')} />
        </Field>
      </fieldset>
    </FormDialog>
  )
}
