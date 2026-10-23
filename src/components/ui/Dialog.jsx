'use client'

import React, { useCallback, useEffect, useId, useRef } from 'react'
import ReactDOM from 'react-dom'
import { RxCross2 } from 'react-icons/rx'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal dialog: portal, role="dialog", labelled title, Escape + backdrop close,
 * initial focus, Tab trap and focus return. Labels come in as props so admin (English) and
 * user-facing callers (t()) can both use it.
 *
 * Props: open, onClose, title, description?, children, footer?, size ('sm'|'md'|'lg'),
 * closeLabel, dismissible (false while a request is running), initialFocusRef?
 */
const SIZE_CLASS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

const Dialog = ({
  open,
  onClose,
  title,
  description = null,
  children,
  footer = null,
  size = 'md',
  closeLabel = 'Close',
  dismissible = true,
  initialFocusRef = null,
  className = '',
}) => {
  const panelRef = useRef(null)
  const previouslyFocusedRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  const requestClose = useCallback(() => {
    if (dismissible) {
      onClose?.()
    }
  }, [dismissible, onClose])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    previouslyFocusedRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const frame = requestAnimationFrame(() => {
      const target = initialFocusRef?.current
        || panelRef.current?.querySelector('[data-autofocus]')
        || panelRef.current?.querySelector(FOCUSABLE_SELECTOR)
        || panelRef.current
      target?.focus?.()
    })

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      const previous = previouslyFocusedRef.current
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus()
      }
    }
  }, [initialFocusRef, open])

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      requestClose()
      return
    }

    if (event.key !== 'Tab' || !panelRef.current) {
      return
    }

    const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (element) => element.offsetParent !== null
    )

    if (focusable.length === 0) {
      event.preventDefault()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, [requestClose])

  if (!open || typeof document === 'undefined') {
    return null
  }

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-ink/55 p-4"
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
        className={`ui-panel flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden shadow-overlay outline-none ${SIZE_CLASS[size] || SIZE_CLASS.md} ${className}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold leading-6 text-ink">{title}</h2>
            {description ? <p id={descriptionId} className="mt-1 text-caption text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={!dismissible}
            aria-label={closeLabel}
            className="ui-btn ui-btn-ghost ui-btn-icon -mr-2 -mt-1 shrink-0 text-muted"
          >
            <RxCross2 className="text-xl" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}

export default Dialog
