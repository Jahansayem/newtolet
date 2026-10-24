'use client'

import React, { useId, useRef } from 'react'
import Badge from './Badge'

/**
 * WAI-ARIA tabs with automatic activation. Arrow Left/Right, Home and End
 * move focus and select. Render the active panel yourself with
 * `tabPanelProps(key)` so the panel is labelled by its tab.
 */
export default function Tabs({ tabs = [], value, onChange, ariaLabel, variant = 'underline', className = '' }) {
  const baseId = useId()
  const refs = useRef([])
  const enabled = tabs.filter((tab) => !tab.disabled)

  const focusTab = (index) => {
    const target = refs.current[index]
    if (target) target.focus()
  }

  const handleKeyDown = (event, currentIndex) => {
    const indices = tabs.map((tab, index) => (tab.disabled ? null : index)).filter((index) => index !== null)
    const position = indices.indexOf(currentIndex)
    let nextIndex = null
    if (event.key === 'ArrowRight') nextIndex = indices[(position + 1) % indices.length]
    if (event.key === 'ArrowLeft') nextIndex = indices[(position - 1 + indices.length) % indices.length]
    if (event.key === 'Home') nextIndex = indices[0]
    if (event.key === 'End') nextIndex = indices[indices.length - 1]
    if (nextIndex === null || nextIndex === undefined) return
    event.preventDefault()
    onChange(tabs[nextIndex].key)
    focusTab(nextIndex)
  }

  const activeKey = tabs.some((tab) => tab.key === value) ? value : enabled[0]?.key

  return (
    <div role="tablist" aria-label={ariaLabel} className={`ui-scroll-fade flex gap-1 overflow-x-auto ${variant === 'underline' ? 'border-b border-line' : ''} ${className}`.trim()}>
      {tabs.map((tab, index) => {
        const selected = tab.key === activeKey
        const base = 'inline-flex min-h-11 shrink-0 items-center gap-2 px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
        const styles =
          variant === 'pill'
            ? selected
              ? 'rounded-full bg-ink text-white'
              : 'rounded-full text-muted hover:bg-brand-soft hover:text-ink'
            : selected
              ? '-mb-px border-b-2 border-brand text-brand'
              : '-mb-px border-b-2 border-transparent text-muted hover:text-ink'
        return (
          <button
            key={tab.key}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.key}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${tab.key}`}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`${base} ${styles} ${tab.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {tab.label}
            {typeof tab.count === 'number' ? (
              <Badge variant={selected ? 'brand' : 'neutral'} aria-label={`${tab.count} items`}>
                {tab.count}
              </Badge>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Props for the panel element that belongs to `key` within a Tabs instance. */
export const useTabPanelProps = () => {
  const baseId = useId()
  return (key) => ({ role: 'tabpanel', id: `${baseId}-panel-${key}`, 'aria-labelledby': `${baseId}-tab-${key}`, tabIndex: 0 })
}
