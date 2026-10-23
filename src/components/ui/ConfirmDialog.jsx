'use client'

import React, { useRef } from 'react'
import Dialog from './Dialog'

/**
 * Confirmation step for destructive or irreversible actions. All copy comes in as props.
 * `tone='danger'` renders a red confirm button; use 'primary' for approvals.
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
}) => {
  const cancelRef = useRef(null)

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
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
            disabled={busy}
            className={`ui-btn ui-btn-sm ${tone === 'danger' ? 'ui-btn-danger' : 'ui-btn-primary'}`}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </>
      )}
    >
      {description ? <p className="text-body text-muted">{description}</p> : null}
    </Dialog>
  )
}

export default ConfirmDialog
