'use client'

import React, { useEffect, useState } from 'react'
import { FiRefreshCw, FiSlash } from 'react-icons/fi'
import { listPaymentLinkAttempts } from '../../../services/admin/paymentLinks'
import { formatBdt, getPaymentAttemptStatusMeta, getPaymentLinkStatusMeta } from '../../../lib/paymentLinks'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import Dialog from '../../ui/Dialog'
import InlineAlert from '../../ui/InlineAlert'
import KeyValueList from '../../ui/KeyValueList'
import { SkeletonRows } from '../../ui/Skeleton'
import PaymentLinkShare from './PaymentLinkShare'

const formatWhen = (value) =>
  value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null

/**
 * One payment link: what it is, how to share it, and every payment attempt.
 * `mode="created"` is the same dialog right after a link is made, with the
 * share controls first and the history hidden (there is none yet).
 */
export default function PaymentLinkDetailDialog({ link, mode = 'detail', onClose, onCheck = null, onCancel = null, checking = false, canManage = false, refreshToken = 0 }) {
  const [attempts, setAttempts] = useState({ status: 'idle', rows: [], error: null })
  const linkId = link?.id || null
  const showAttempts = mode === 'detail'

  useEffect(() => {
    if (!linkId || !showAttempts) return undefined
    const controller = new AbortController()
    setAttempts((current) => ({ ...current, status: 'loading', error: null }))
    void listPaymentLinkAttempts(linkId, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      setAttempts(result.error ? { status: 'error', rows: [], error: result.error } : { status: 'ready', rows: result.data, error: null })
    })
    return () => controller.abort()
  }, [linkId, showAttempts, refreshToken])

  if (!link) return null

  const meta = getPaymentLinkStatusMeta(link.status)
  const isActive = link.status === 'ACTIVE'

  const items = [
    { label: 'What it is for', value: link.purpose },
    { label: 'Customer', value: [link.customer_name, link.customer_phone].filter(Boolean).join(' · ') || 'Asked on the pay page' },
    { label: 'Customer order', value: link.customer_order_no || 'Not attached' },
    { label: 'Created', value: [formatWhen(link.created_at), link.created_by_label].filter(Boolean).join(' · ') },
    link.status === 'PAID' ? { label: 'Paid', value: [formatWhen(link.paid_at), link.paid_method].filter(Boolean).join(' · ') } : null,
    link.status === 'PAID' ? { label: 'EPS transaction', value: link.paid_eps_transaction_id || link.paid_reference } : null,
    link.status === 'CANCELLED' ? { label: 'Cancelled', value: [formatWhen(link.cancelled_at), link.cancel_reason].filter(Boolean).join(' · ') } : null,
    link.note ? { label: 'Internal note', value: link.note } : null,
  ].filter(Boolean)

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === 'created' ? 'Payment link is ready' : `Payment link ${link.code}`}
      description={mode === 'created' ? 'Send it to the customer. You can find it again in this list at any time.' : null}
      size="lg"
      fullScreenOnMobile
      footer={
        <>
          {showAttempts && isActive && canManage && onCancel ? (
            <Button variant="danger-outline" icon={<FiSlash />} onClick={() => onCancel(link)}>
              Cancel link
            </Button>
          ) : null}
          {showAttempts && isActive && onCheck ? (
            <Button variant="secondary" icon={<FiRefreshCw />} busy={checking} busyLabel="Checking…" onClick={() => onCheck(link)}>
              Check payment
            </Button>
          ) : null}
          <Button variant={mode === 'created' ? 'secondary' : 'primary'} onClick={onClose}>
            {mode === 'created' ? 'Done' : 'Close'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--radius-card)] bg-canvas p-4">
          <div>
            <p className="text-caption text-muted">Amount</p>
            <p className="text-3xl font-bold tabular-nums text-ink">{formatBdt(link.amount_bdt)}</p>
          </div>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>

        {isActive ? <PaymentLinkShare link={link} autoFocusCopy={mode === 'created'} /> : null}

        <KeyValueList items={items} columns={2} />

        {showAttempts ? (
          <section aria-labelledby="pl-attempts-heading">
            <h3 id="pl-attempts-heading" className="text-sm font-semibold text-ink">Payment attempts</h3>
            {attempts.status === 'loading' ? (
              <div className="mt-2">
                <SkeletonRows rows={2} />
              </div>
            ) : attempts.status === 'error' ? (
              <InlineAlert variant="warning" className="mt-2">
                The attempts could not be loaded: {attempts.error?.message}
              </InlineAlert>
            ) : attempts.rows.length === 0 ? (
              <p className="mt-1 text-sm text-muted">The customer has not started a payment yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-[var(--radius-card)] border border-line">
                {attempts.rows.map((attempt) => {
                  const attemptMeta = getPaymentAttemptStatusMeta(attempt.status)
                  return (
                    <li key={attempt.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          <span className="tabular-nums">{formatBdt(attempt.amount)}</span>
                          {attempt.gateway_payload?.financialEntity ? ` · ${attempt.gateway_payload.financialEntity}` : ''}
                        </p>
                        <p className="break-all text-caption text-muted">
                          {formatWhen(attempt.created_at)}
                          {attempt.reference ? ` · Ref ${attempt.reference}` : ''}
                        </p>
                        {attempt.review_note ? <p className="text-caption text-muted">{attempt.review_note}</p> : null}
                      </div>
                      <Badge variant={attemptMeta.variant}>{attemptMeta.label}</Badge>
                    </li>
                  )
                })}
              </ul>
            )}
            {attempts.rows.some((attempt) => attempt.status === 'awaiting_admin_approval') ? (
              <InlineAlert variant="warning" className="mt-3">
                A payment on this link is held for review. Open the Payments tab to approve or reject it.
              </InlineAlert>
            ) : null}
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
