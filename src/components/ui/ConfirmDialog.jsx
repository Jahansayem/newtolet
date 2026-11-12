'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import Dialog from './Dialog'

/**
 * Confirmation step for destructive or irreversible actions. All copy comes in as props.
 * `tone='danger'` renders a red confirm button; use 'primary' for approvals.
 * `confirmText` adds a field the user must fill with exactly that text before
 * the confirm button is enabled (for actions that touch many records).
 */
const ConfirmDialog = ({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  closeLabel = 'Close',
  tone = 'danger',
  busy = false,
  busyLabel = null,
  confirmText = null,
  confirmTextLabel = null,
  children = null,
}) => {
  const cancelRef = useRef(null)
  const typedId = useId()
  const [typed, setTyped] = useState('')
  const needsTyping = confirmText !== null && confirmText !== undefined && String(confirmText) !== ''
  const typedMatches = !needsTyping || typed.trim() === String(confirmText)

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      role="alertdialog"
      closeLabel={closeLabel}
      dismissible={!busy}
      initialFocusRef={cancelRef}
      footer={(
        <>
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="ui-btn ui-btn-secondary ui-btn-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !typedMatches}
            className={`ui-btn ui-btn-sm ${tone === 'danger' ? 'ui-btn-danger' : 'ui-btn-primary'}`}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </>
      )}
    >
      {description ? <p className="text-body text-muted">{description}</p> : null}
      {children}
      {needsTyping ? (
        <div className="mt-4">
          <label htmlFor={typedId} className="ui-label">
            {confirmTextLabel || `Type ${confirmText} to confirm`}
          </label>
          <input
            id={typedId}
            type="text"
            className="ui-field"
            value={typed}
            autoComplete="off"
            inputMode={/^\d+$/.test(String(confirmText)) ? 'numeric' : undefined}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && typedMatches && !busy) onConfirm?.()
            }}
          />
        </div>
      ) : null}
    </Dialog>
  )
}

export default ConfirmDialog
