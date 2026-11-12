'use client'

import React, { useId } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'
import Button from './Button'

/**
 * Search + filter controls for list pages. Every control has a visible or
 * sr-only label; active filters are shown as removable chips.
 *
 * search:   { value, onChange, label, placeholder }
 * filters:  [{ key, label, type: 'select'|'date', options?: [{value,label}], value, onChange, placeholder? }]
 * chips:    [{ key, label, onRemove }]
 * footerActions: node shown at the start of the bottom row (e.g. a "More filters" toggle)
 */
export default function FilterBar({ search = null, filters = [], chips = [], onClearAll = null, actions = null, footerActions = null, resultCount = null, resultLabel = 'results', className = '' }) {
  const baseId = useId()
  return (
    <form role="search" onSubmit={(event) => event.preventDefault()} className={`ui-card flex flex-col gap-3 p-4 ${className}`.trim()}>
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {search ? (
          <label className="relative block min-w-0 flex-1 lg:min-w-[14rem]">
            <span className="ui-label">{search.label || 'Search'}</span>
            <FiSearch className="pointer-events-none absolute bottom-3 left-3.5 text-subtle" aria-hidden="true" />
            <input
              type="search"
              className="ui-field pl-10"
              value={search.value || ''}
              placeholder={search.placeholder || ''}
              onChange={(event) => search.onChange?.(event.target.value)}
            />
          </label>
        ) : null}
        {filters.map((filter) => {
          const id = `${baseId}-${filter.key}`
          return (
            <label key={filter.key} className="block min-w-0 sm:w-auto lg:w-48" htmlFor={id}>
              <span className="ui-label">{filter.label}</span>
              {filter.type === 'date' ? (
                <input id={id} type="date" className="ui-field" value={filter.value || ''} onChange={(event) => filter.onChange?.(event.target.value)} />
              ) : (
                <select id={id} className="ui-field" value={filter.value ?? ''} onChange={(event) => filter.onChange?.(event.target.value)}>
                  {filter.placeholder !== undefined ? <option value="">{filter.placeholder || 'All'}</option> : null}
                  {(filter.options || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )
        })}
        {actions ? <div className="flex flex-wrap gap-2 lg:ml-auto">{actions}</div> : null}
      </div>
      {chips.length > 0 || resultCount !== null || footerActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {footerActions}
          {chips.map((chip) => (
            <span key={chip.key} className="ui-chip min-h-9 py-1 pr-1">
              {chip.label}
              <button type="button" className="ui-btn ui-btn-ghost ml-1 h-7 w-7 min-h-0 rounded-full p-0" aria-label={`Remove filter: ${chip.label}`} onClick={chip.onRemove}>
                <FiX aria-hidden="true" />
              </button>
            </span>
          ))}
          {chips.length > 0 && onClearAll ? (
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear all
            </Button>
          ) : null}
          {resultCount !== null ? (
            <span className="ml-auto text-caption text-muted" role="status" aria-live="polite">
              {resultCount} {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
