'use client'

import React from 'react'
import { FiAlertTriangle, FiCheck, FiTrash2, FiX } from 'react-icons/fi'
import { useHotkeys } from '../hooks/useHotkeys'
import Button from '../../ui/Button'

/**
 * Sticky bar under the admin edit form: every save and moderation action for
 * the listing, plus the warnings that do not block saving.
 *
 * Moving on approves: "Save, approve & next" saves the listing, approves it
 * (with the Undo toast) and opens the next pending listing. When approving is
 * not possible here (already approved, or no moderation permission) the same
 * button saves and moves on without approving.
 *
 * Keyboard: S saves, Shift+S saves, approves and moves on; with Ctrl (or Cmd)
 * both also work while typing in a field.
 */
export default function EditorActionBar({ submit, isSubmitting, isLoaded, submitMode, warnings = [], canModerate = false, status = '', hasListing = false, removed = false, onReject, onRemove }) {
  const disabled = isSubmitting || !isLoaded
  const canApprove = canModerate && hasListing && status !== 'approved'
  const nextMode = canApprove ? 'approve' : 'next'
  const nextLabel = canApprove ? 'Save, approve & next' : 'Save & next'

  useHotkeys(
    [
      { combo: 's', run: () => submit('update') },
      { combo: 'shift+s', run: () => submit(nextMode) },
      { combo: 'mod+s', allowInInput: true, run: () => submit('update') },
      { combo: 'mod+shift+s', allowInInput: true, run: () => submit(nextMode) },
    ],
    { enabled: !disabled }
  )

  return (
    <div className="ui-card sticky bottom-0 z-30 p-3 shadow-raised" role="toolbar" aria-label="Listing actions" data-testid="editor-action-bar">
      {warnings.length > 0 ? (
        <p className="mb-2 flex items-start gap-2 text-sm text-ink" role="status" data-testid="editor-warnings">
          <FiAlertTriangle className="mt-0.5 shrink-0 text-marigold-700" aria-hidden="true" />
          <span>
            <strong>Check before saving:</strong> {warnings.join(' · ')}. You can still save.
          </span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={disabled} busy={isSubmitting && submitMode === 'update'} busyLabel="Saving…" aria-keyshortcuts="S Control+S" title="Save (S)" onClick={() => submit('update')}>
          Save
        </Button>
        <Button
          variant="primary"
          icon={canApprove ? <FiCheck /> : null}
          disabled={disabled}
          busy={isSubmitting && submitMode === nextMode}
          busyLabel="Saving…"
          aria-keyshortcuts="Shift+S Control+Shift+S"
          title={`${nextLabel} (Shift+S)`}
          onClick={() => submit(nextMode)}
        >
          {nextLabel}
        </Button>
        {canModerate && hasListing && status !== 'rejected' ? (
          <Button variant="danger-outline" icon={<FiX />} disabled={isSubmitting} onClick={onReject}>
            Reject
          </Button>
        ) : null}
        {canModerate && hasListing && !removed ? (
          <Button variant="danger-outline" icon={<FiTrash2 />} disabled={isSubmitting} onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  )
}
