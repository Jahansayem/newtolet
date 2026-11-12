'use client'

import { useEffect, useRef } from 'react'
import { isActivationTarget, isTypingTarget, pickHotkey } from '../../../lib/hotkeys'

const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"]'

// A dialog or menu that is actually open: closed ones may stay in the document
// (the shell's navigation drawer does, marked inert).
const isOverlayOpen = () =>
  Array.from(document.querySelectorAll(OVERLAY_SELECTOR)).some((element) => !element.closest('[inert]') && element.getClientRects().length > 0)

/**
 * Page-level keyboard shortcuts.
 * bindings: [{ combo, run(event), allowInInput?, allowInDialog? }]
 *
 * Single-key shortcuts never fire while the user is typing in a field, while a
 * dialog or menu is open, or (for Enter) while a button or link has focus.
 * Give a binding `allowInInput` / `allowInDialog` to opt out of that.
 */
export const useHotkeys = (bindings = [], { enabled = true } = {}) => {
  const bindingsRef = useRef(bindings)
  useEffect(() => {
    bindingsRef.current = bindings
  })

  useEffect(() => {
    if (!enabled) return undefined
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing) return
      const binding = pickHotkey(event, bindingsRef.current, {
        typing: isTypingTarget(event.target),
        overlayOpen: isOverlayOpen(),
        activation: isActivationTarget(event.target),
      })
      if (!binding) return
      event.preventDefault()
      binding.run(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}

export default useHotkeys
