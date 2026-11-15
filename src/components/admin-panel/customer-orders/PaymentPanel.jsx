'use client'

import React, { useState } from 'react'
import { FiCheck, FiPlus, FiX } from 'react-icons/fi'
import { recordPaymentClaim, reviewPaymentClaim } from '../../../services/admin/customerOrders'
import {
  CLAIM_STATUS_META,
  PAYMENT_STATUS_META,
  PAYMENT_VERIFICATION_META,
  isClosedStatus,
  previewVerification,
  refundWindowDaysLeft,
} from '../../../lib/customerOrderStatus'
import { PERMISSIONS } from '../../../lib/adminPermissions'
import { useAdminPermissions } from '../../../contexts/AdminAccessContext'
import { useAdminMutation } from '../hooks/useAdminMutation'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmDialog from '../../ui/ConfirmDialog'
import FormDialog from '../../ui/FormDialog'
import InlineAlert from '../../ui/InlineAlert'

const bdt = (value) => `৳${Number(value || 0).toLocaleString('en-US')}`
const formatWhen = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
const claimReference = (claim) => (claim.trx_id ? `TrxID ${claim.trx_id}` : `Sender last-4 ${claim.sender_last4}`)

const Amount = ({ label, value, strong = false }) => (
  <div className="min-w-0">
    <dt className="text-caption text-muted">{label}</dt>
    <dd className={`tabular-nums ${strong ? 'text-xl font-semibold text-ink' : 'text-base font-medium text-ink'}`}>{value}</dd>
  </div>
)

/**
 * Charge / paid / due, every payment claim, a "Record payment" form (amount
 * required) and per-claim Verify / Reject for admins holding payments.review.
 * Totals come from the server; this component never adds them up.
 */
export default function PaymentPanel({ order, claims = [], onChanged }) {
  const { hasPermission } = useAdminPermissions()
  const canReview = hasPermission(PERMISSIONS.PAYMENTS_REVIEW)
  const [recordOpen, setRecordOpen] = useState(false)
  const [verifyTarget, setVerifyTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)

  const reviewMutation = useAdminMutation((claimId, payload) => reviewPaymentClaim(claimId, payload), {
    successMessage: (result, _claimId, payload) => (payload.decision === 'verify' ? 'Payment verified' : 'Payment claim rejected'),
    errorMessage: 'Payment could not be reviewed',
    invalidate: ['customer-orders'],
    onSuccess: () => onChanged?.(),
  })

  const canRecord = !isClosedStatus(order.status) && order.status !== 'REFUND_REQUESTED'
  const refundDays = refundWindowDaysLeft(order)
  const paymentMeta = PAYMENT_STATUS_META[order.payment_status] || PAYMENT_STATUS_META.PENDING
  const verificationMeta = PAYMENT_VERIFICATION_META[order.payment_verification] || PAYMENT_VERIFICATION_META.UNVERIFIED
  const verifyPreview = verifyTarget ? previewVerification(order.service_charge_bdt, claims, verifyTarget.id) : null

  return (
    <section className="ui-card space-y-4 p-4" aria-labelledby="co-payment-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="co-payment-heading" className="text-base font-semibold text-ink">Payment</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant={paymentMeta.variant}>{paymentMeta.label}</Badge>
          <Badge variant={verificationMeta.variant}>{verificationMeta.label}</Badge>
          {order.overpaid ? <Badge variant="warning">Overpaid</Badge> : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Amount label="Service charge" value={bdt(order.service_charge_bdt)} />
        <Amount label="Amount paid" value={bdt(order.amount_paid)} />
        <Amount label="Amount due" value={bdt(order.amount_due)} strong />
        <Amount label="Verified" value={bdt(order.amount_verified)} />
      </dl>

      {order.overpaid ? (
        <InlineAlert variant="warning">
          The recorded payments are {bdt(Number(order.amount_paid) - Number(order.service_charge_bdt))} more than the charge. Check the claims and return the extra by bKash if it is real.
        </InlineAlert>
      ) : null}
      {order.payment_verification === 'VERIFIED' ? (
        <InlineAlert variant="success">
          Fully paid and verified{order.payment_verified_at ? ` on ${formatWhen(order.payment_verified_at)}` : ''}. Owner contact may be shared for listings where the owner agreed.
          {refundDays ? ` Refund window: ${refundDays} day${refundDays === 1 ? '' : 's'} left.` : ''}
        </InlineAlert>
      ) : Number(order.amount_verified) > 0 ? (
        <InlineAlert variant="info">A partial payment is verified. Owner contact stays locked until the full charge is paid and verified.</InlineAlert>
      ) : null}

      <div>
        <h4 className="text-sm font-semibold text-ink">Payment claims</h4>
        {claims.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No payment has been recorded yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-[var(--radius-card)] border border-line">
            {claims.map((claim) => {
              const meta = CLAIM_STATUS_META[claim.status] || CLAIM_STATUS_META.CLAIMED
              return (
                <li key={claim.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      <span className="tabular-nums">{bdt(claim.amount_bdt)}</span> · {claimReference(claim)}
                    </p>
                    <p className="text-caption text-muted">
                      Recorded by {claim.claimed_by_label} · {formatWhen(claim.claimed_at)}
                    </p>
                    {claim.reviewed_at ? (
                      <p className="text-caption text-muted">
                        {claim.status === 'VERIFIED' ? 'Verified' : 'Rejected'} by {claim.reviewed_by_label || 'unknown'} · {formatWhen(claim.reviewed_at)}
                        {claim.review_note ? ` · ${claim.review_note}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {claim.status === 'CLAIMED' && canReview ? (
                      <>
                        <Button size="sm" variant="primary" icon={<FiCheck />} onClick={() => setVerifyTarget(claim)}>
                          Verify
                        </Button>
                        <Button size="sm" variant="secondary" icon={<FiX />} onClick={() => setRejectTarget(claim)}>
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!canReview && claims.some((claim) => claim.status === 'CLAIMED') ? (
          <p className="ui-help mt-2">Verifying or rejecting a payment needs the Finance or Super admin role.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon={<FiPlus />} disabled={!canRecord} onClick={() => setRecordOpen(true)}>
          Record payment
        </Button>
        {!canRecord ? <span className="text-caption text-muted">Payments cannot be recorded on a closed or refund-requested order.</span> : null}
      </div>

      <RecordPaymentDialog open={recordOpen} order={order} onClose={() => setRecordOpen(false)} onRecorded={onChanged} />

      <ConfirmDialog
        open={Boolean(verifyTarget)}
        onCancel={() => setVerifyTarget(null)}
        onConfirm={async () => {
          const target = verifyTarget
          setVerifyTarget(null)
          await reviewMutation.run(target.id, { decision: 'verify' })
        }}
        title={verifyTarget ? `Verify ${bdt(verifyTarget.amount_bdt)}?` : ''}
        description={
          verifyTarget
            ? `${claimReference(verifyTarget)}. Confirm in the bKash account (01731115333) that this money was received before verifying. ${
                verifyPreview?.completesOrder
                  ? 'This completes the charge: the order becomes Payment verified.'
                  : `After this, ${bdt(verifyPreview?.stillUnverified)} of the charge is still unverified, so the order stays unverified and owner contact stays locked.`
              }`
            : ''
        }
        confirmLabel="Verify payment"
        tone="primary"
        busy={reviewMutation.busy}
        busyLabel="Verifying…"
      />

      <RejectClaimDialog
        claim={rejectTarget}
        busy={reviewMutation.busy}
        error={reviewMutation.error}
        onClose={() => setRejectTarget(null)}
        onReject={async (note) => {
          const result = await reviewMutation.run(rejectTarget.id, { decision: 'reject', note })
          if (!result.error) setRejectTarget(null)
        }}
      />
    </section>
  )
}

const RecordPaymentDialog = ({ open, order, onClose, onRecorded }) => {
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState('trx')
  const [reference, setReference] = useState('')
  const [seed, setSeed] = useState(false)
  const [localError, setLocalError] = useState(null)

  if (open !== seed) {
    setSeed(open)
    if (open) {
      setAmount(Number(order.amount_due) > 0 ? String(order.amount_due) : '')
      setKind('trx')
      setReference('')
      setLocalError(null)
    }
  }

  const mutation = useAdminMutation((id, payload) => recordPaymentClaim(id, payload), {
    successMessage: 'Payment recorded. It still needs verification.',
    errorMessage: 'Payment could not be recorded',
    invalidate: ['customer-orders'],
  })

  const submit = async () => {
    setLocalError(null)
    const value = Number(amount)
    if (amount === '' || !Number.isInteger(value) || value <= 0) return setLocalError('Enter the amount the customer paid, as a whole number of BDT.')
    const ref = reference.trim()
    if (kind === 'trx' && !/^[A-Za-z0-9]{6,30}$/.test(ref)) return setLocalError('Enter the bKash TrxID (6-30 letters and digits).')
    if (kind === 'last4' && !/^\d{4}$/.test(ref)) return setLocalError('Enter exactly the last 4 digits of the sender number.')
    const result = await mutation.run(order.id, { amountBdt: value, trxId: kind === 'trx' ? ref : null, senderLast4: kind === 'last4' ? ref : null })
    if (result.error) return undefined
    onRecorded?.()
    return onClose()
  }

  const overCharge = Number(amount) > Number(order.amount_due) && Number(order.amount_due) >= 0 && amount !== ''

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={`Record payment for ${order.order_no}`}
      description="One payment or partial payment. Recording it does not verify it."
      submitLabel="Record payment"
      busy={mutation.busy}
      error={localError || mutation.error}
    >
      <div>
        <label className="ui-label" htmlFor="co-claim-amount">Amount paid (BDT)</label>
        <input id="co-claim-amount" className="ui-field" type="number" min={1} step={1} required value={amount} onChange={(event) => setAmount(event.target.value)} />
        <p className="ui-help">
          Charge {bdt(order.service_charge_bdt)} · paid so far {bdt(order.amount_paid)} · due {bdt(order.amount_due)}
        </p>
        {overCharge ? <p className="ui-help">This is more than the amount due. It will be accepted and the order flagged as overpaid.</p> : null}
      </div>
      <fieldset>
        <legend className="ui-label">Payment reference (one is enough)</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="co-claim-kind" className="h-5 w-5 accent-brand" checked={kind === 'trx'} onChange={() => { setKind('trx'); setReference('') }} />
            bKash TrxID
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="co-claim-kind" className="h-5 w-5 accent-brand" checked={kind === 'last4'} onChange={() => { setKind('last4'); setReference('') }} />
            Sender number, last 4 digits
          </label>
        </div>
      </fieldset>
      <div>
        <label className="ui-label" htmlFor="co-claim-ref">{kind === 'trx' ? 'TrxID' : 'Last 4 digits'}</label>
        <input
          id="co-claim-ref"
          className="ui-field"
          inputMode={kind === 'trx' ? 'text' : 'numeric'}
          maxLength={kind === 'trx' ? 30 : 4}
          required
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <p className="ui-help">A screenshot is not proof of payment. Never ask the customer for an OTP, PIN or password.</p>
      </div>
    </FormDialog>
  )
}

const RejectClaimDialog = ({ claim, busy, error, onClose, onReject }) => {
  const [note, setNote] = useState('')
  const [seed, setSeed] = useState(null)
  const [localError, setLocalError] = useState(null)
  const key = claim?.id || null
  if (key !== seed) {
    setSeed(key)
    setNote('')
    setLocalError(null)
  }

  return (
    <FormDialog
      open={Boolean(claim)}
      onClose={onClose}
      onSubmit={() => {
        if (note.trim().length < 3) return setLocalError('Say why this payment is rejected.')
        setLocalError(null)
        return onReject(note.trim())
      }}
      title={claim ? `Reject ${bdt(claim.amount_bdt)}?` : ''}
      description={claim ? `${claimReference(claim)}. A rejected claim no longer counts towards the amount paid.` : null}
      submitLabel="Reject payment"
      submitVariant="danger"
      busy={busy}
      error={localError || error}
    >
      <div>
        <label className="ui-label" htmlFor="co-reject-note">Reason</label>
        <textarea id="co-reject-note" className="ui-field" rows={3} maxLength={1000} required value={note} onChange={(event) => setNote(event.target.value)} />
        <p className="ui-help">For example: TrxID not found in bKash, or amount does not match. Internal only.</p>
      </div>
    </FormDialog>
  )
}
