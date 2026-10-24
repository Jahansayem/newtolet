'use client'

import React, { useEffect, useId, useRef } from 'react'
import Dialog from './Dialog'
import Button from './Button'
import InlineAlert from './InlineAlert'

/**
 * Dialog wrapping a <form>. The submit button lives in the footer and targets
 * the form by id. On a failed submit the error alert receives focus.
 */
export default function FormDialog({
  open,
  onClose,
  onSubmit,
  title,
  description = null,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  busy = false,
  busyLabel = 'Saving…',
  error = null,
  submitVariant = 'primary',
  submitDisabled = false,
  size = 'md',
  initialFocusRef = null,
  fullScreenOnMobile = false,
}) {
  const formId = useId()
  const errorRef = useRef(null)
  const errorMessage = typeof error === 'string' ? error : error?.message || null

  useEffect(() => {
    if (errorMessage && errorRef.current) errorRef.current.focus()
  }, [errorMessage])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (busy) return
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    onSubmit?.(data, event)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      dismissible={!busy}
      initialFocusRef={initialFocusRef}
      fullScreenOnMobile={fullScreenOnMobile}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="submit" form={formId} variant={submitVariant} busy={busy} busyLabel={busyLabel} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        {errorMessage ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <InlineAlert variant="danger">{errorMessage}</InlineAlert>
          </div>
        ) : null}
        {children}
      </form>
    </Dialog>
  )
}
