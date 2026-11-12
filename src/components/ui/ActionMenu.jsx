'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { FiMoreHorizontal } from 'react-icons/fi'
import Button from './Button'

/**
 * Button that opens a small menu of actions (WAI-ARIA menu button).
 * items: [{ key, label, onSelect, icon?, tone?: 'danger', disabled? }]
 * Arrow keys move between items, Escape closes and returns focus to the button.
 */
export default function ActionMenu({ label = 'More actions', items = [], align = 'right', variant = 'secondary', size = 'md', icon = <FiMoreHorizontal />, iconOnly = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()
  const visible = items.filter(Boolean)

  const focusItem = (index) => {
    const nodes = menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])')
    if (!nodes?.length) return
    nodes[(index + nodes.length) % nodes.length].focus()
  }

  useEffect(() => {
    if (!open) return undefined
    focusItem(0)
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  const onMenuKeyDown = (event) => {
    const nodes = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])
    const current = nodes.indexOf(document.activeElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem(current + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusItem(current - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusItem(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusItem(nodes.length - 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  if (visible.length === 0) return null

  return (
    <div ref={rootRef} className="relative inline-block">
      <Button
        ref={buttonRef}
        variant={variant}
        size={size}
        icon={icon}
        iconOnly={iconOnly}
        aria-label={iconOnly ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        {label}
      </Button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={`ui-card absolute z-40 mt-2 min-w-56 p-1 shadow-raised ${align === 'right' ? 'right-0' : 'left-0'}`}
          onKeyDown={onMenuKeyDown}
        >
          {visible.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-chip)] px-3 py-2 text-left text-sm hover:bg-canvas focus-visible:bg-canvas disabled:opacity-50 ${item.tone === 'danger' ? 'text-danger' : 'text-ink'}`}
              onClick={() => {
                close()
                item.onSelect?.()
              }}
            >
              {item.icon ? <span aria-hidden="true" className="inline-flex shrink-0">{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
