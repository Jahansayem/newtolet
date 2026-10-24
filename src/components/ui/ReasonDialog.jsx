'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import FormDialog from './FormDialog'

/**
 * Approve / reject style decision with a reason (required for rejections by
 * default) and an optional internal note that is never shown to the user.
 *
 * onConfirm({ reason, note })
 */
export default function ReasonDialog({
  open,
  onClose,
  onConfirm,
  decision = 'reject',
  title,
  description = null,
  subject = null,
  reasonRequired = decision === 'reject',
  reasonLabel = 'Reason',
  reasonHelp = 'Shown to the user in their dashboard and notifications.',
  reasonOptions = null,
  minReasonLength = 5,
  showNote = true,
  noteLabel = 'Internal note',
  noteHelp = 'Only visible to admins.',
  confirmLabel = null,
  busy = false,
  error = null,
}) {
  const reasonId = useId()
  const noteId = useId()
  const reasonRef = useRef(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setReason('')
      setNote('')
      setTouched(false)
    }
  }, [open])

  const trimmed = reason.trim()
  const reasonInvalid = reasonRequired && trimmed.length < minReasonLength
  const resolvedConfirm = confirmLabel || (decision === 'approve' ? 'Approve' : decision === 'reject' ? 'Reject' : 'Confirm')

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      submitLabel={resolvedConfirm}
      submitVariant={decision === 'reject' ? 'danger' : 'primary'}
      busy={busy}
      busyLabel="Working…"
      error={error}
      initialFocusRef={reasonRef}
      onSubmit={() => {
        setTouched(true)
        if (reasonInvalid) {
          reasonRef.current?.focus()
          return
        }
        onConfirm?.({ reason: trimmed || null, note: note.trim() || null })
      }}
    >
      {subject ? <div className="rounded-[var(--radius-card)] border border-line bg-canvas p-3 text-sm text-ink">{subject}</div> : null}

      <div>
        <label htmlFor={reasonId} className="ui-label">
          {reasonLabel}
          {reasonRequired ? <span className="ui-required" aria-hidden="true">*</span> : null}
        </label>
        {reasonOptions ? (
          <select
            id={`${reasonId}-preset`}
            className="ui-field mb-2"
            aria-label={`${reasonLabel} presets`}
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) setReason(event.target.value)
            }}
          >
            <option value="">Choose a preset…</option>
            {reasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
        <textarea
          ref={reasonRef}
          id={reasonId}
          className="ui-field"
          rows={3}
          value={reason}
          required={reasonRequired}
          aria-required={reasonRequired}
          aria-invalid={touched && reasonInvalid ? 'true' : undefined}
          aria-describedby={`${reasonId}-help ${touched && reasonInvalid ? `${reasonId}-error` : ''}`.trim()}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setTouched(true)}
        />
        <p id={`${reasonId}-help`} className="ui-help">
          {reasonHelp}
        </p>
        {touched && reasonInvalid ? (
          <p id={`${reasonId}-error`} className="ui-error" role="alert">
            Please give a reason of at least {minReasonLength} characters.
          </p>
        ) : null}
      </div>

      {showNote ? (
        <div>
          <label htmlFor={noteId} className="ui-label">
            {noteLabel}
          </label>
          <textarea id={noteId} className="ui-field" rows={2} value={note} aria-describedby={`${noteId}-help`} onChange={(event) => setNote(event.target.value)} />
          <p id={`${noteId}-help`} className="ui-help">
            {noteHelp}
          </p>
        </div>
      ) : null}
    </FormDialog>
  )
}
