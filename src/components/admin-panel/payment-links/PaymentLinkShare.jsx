'use client'

import React, { useCallback } from 'react'
import { FiCopy, FiExternalLink, FiMessageCircle } from 'react-icons/fi'
import { buildPayLinkUrl, buildShareMessage, buildWhatsAppShareUrl } from '../../../lib/paymentLinks'
import { useToast } from '../../ui/ToastProvider'
import Button from '../../ui/Button'

/** copyLink(link) / copyMessage(link), each reporting through a toast. */
export const usePaymentLinkClipboard = () => {
  const toast = useToast()

  const copy = useCallback(
    async (text, done) => {
      try {
        await navigator.clipboard.writeText(text)
        toast.info(done)
      } catch {
        toast.error('Could not copy to the clipboard', { description: 'Select the link and copy it by hand.' })
      }
    },
    [toast]
  )

  return {
    copyLink: (link) => copy(buildPayLinkUrl(link.code), 'Payment link copied'),
    copyMessage: (link) => copy(buildShareMessage(link), 'Message copied'),
  }
}

/**
 * The link in a quiet read-only field with Copy, WhatsApp and Open.
 * Used by the "link is ready" dialog and the detail dialog.
 */
export default function PaymentLinkShare({ link, autoFocusCopy = false }) {
  const { copyLink, copyMessage } = usePaymentLinkClipboard()
  const url = buildPayLinkUrl(link.code)

  return (
    <div className="space-y-3">
      <div>
        <label className="ui-label" htmlFor={`pl-url-${link.code}`}>Payment link</label>
        <div className="flex gap-2">
          <input
            id={`pl-url-${link.code}`}
            className="ui-field min-w-0 flex-1 bg-canvas font-mono text-caption text-ink"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
          />
          <Button variant="primary" icon={<FiCopy />} onClick={() => copyLink(link)} {...(autoFocusCopy ? { 'data-autofocus': true } : {})}>
            Copy
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={<FiMessageCircle />} href={buildWhatsAppShareUrl(link)} target="_blank" rel="noopener noreferrer">
          Send on WhatsApp
        </Button>
        <Button variant="secondary" icon={<FiCopy />} onClick={() => copyMessage(link)}>
          Copy message
        </Button>
        <Button variant="ghost" icon={<FiExternalLink />} href={url} target="_blank" rel="noopener noreferrer">
          Open pay page
        </Button>
      </div>
    </div>
  )
}
