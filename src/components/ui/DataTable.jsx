'use client'

import React, { useEffect, useId, useRef } from 'react'
import { FiArrowDown, FiArrowUp, FiCode } from 'react-icons/fi'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { SkeletonRows } from './Skeleton'
import InlineAlert from './InlineAlert'

/**
 * Data table with one data path and two render branches:
 *  - md and up: semantic <table> with caption, scope, aria-sort, sticky header
 *  - below md: a list of cards built from the same columns (dt/dd pairs)
 *
 * columns: [{ key, header, render?(row), sortable?, align?: 'left'|'right', hideBelow?: 'lg', hideOnCard?, cardLabel?, width? }]
 * sort: { key, direction: 'asc'|'desc' }, onSortChange(nextSort)
 * selection: selectable, selectedKeys (Set), onSelectionChange(Set), getRowLabel(row)
 * states: loading, error ({message, retryable}), onRetry, empty (node)
 * stickyActions: keeps the actions column in view while the table scrolls sideways
 */
export default function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  caption,
  sort = null,
  onSortChange = null,
  loading = false,
  skeletonRows = 8,
  empty = null,
  error = null,
  onRetry = null,
  selectable = false,
  selectedKeys = null,
  onSelectionChange = null,
  getRowLabel = (row) => row?.name || row?.title || row?.id,
  rowActions = null,
  density = 'comfortable',
  stickyActions = false,
  className = '',
}) {
  const actionsCellClass = stickyActions ? 'sticky right-0 z-[1] bg-surface shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.18)]' : ''
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const captionId = useId()
  const selectAllRef = useRef(null)
  const keyOf = (row) => (typeof rowKey === 'function' ? rowKey(row) : row?.[rowKey])
  const selected = selectedKeys || new Set()
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(keyOf(row)))
  const someSelected = rows.some((row) => selected.has(keyOf(row)))

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected && !allSelected
  }, [someSelected, allSelected])

  const toggleAll = () => {
    if (!onSelectionChange) return
    const next = new Set(selected)
    if (allSelected) rows.forEach((row) => next.delete(keyOf(row)))
    else rows.forEach((row) => next.add(keyOf(row)))
    onSelectionChange(next)
  }

  const toggleOne = (row) => {
    if (!onSelectionChange) return
    const next = new Set(selected)
    const key = keyOf(row)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectionChange(next)
  }

  const requestSort = (column) => {
    if (!column.sortable || !onSortChange) return
    const direction = sort?.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc'
    onSortChange({ key: column.key, direction })
  }

  const renderCell = (column, row) => (column.render ? column.render(row) : row?.[column.key] ?? '—')

  const stateBlock = (() => {
    if (loading) return <div className="p-4" aria-hidden="true"><SkeletonRows rows={skeletonRows} cols={Math.min(columns.length || 3, 5)} /></div>
    if (error) {
      return (
        <div className="p-4">
          <InlineAlert variant={error.permissionDenied ? 'permission' : 'danger'} action={onRetry && error.retryable !== false && !error.permissionDenied ? { label: 'Try again', onClick: onRetry } : null}>
            {error.message}
          </InlineAlert>
        </div>
      )
    }
    if (rows.length === 0) return <div className="p-6 text-center text-sm text-muted">{empty || 'Nothing to show.'}</div>
    return null
  })()

  const sortControl = onSortChange && columns.some((column) => column.sortable) ? (
    <label className="flex items-center gap-2 text-caption text-muted">
      Sort by
      <select
        className="ui-field h-9 min-h-0 w-auto py-1 text-sm"
        value={sort ? `${sort.key}:${sort.direction}` : ''}
        onChange={(event) => {
          const [key, direction] = event.target.value.split(':')
          if (key) onSortChange({ key, direction })
        }}
      >
        <option value="">Default</option>
        {columns
          .filter((column) => column.sortable)
          .flatMap((column) => [
            <option key={`${column.key}:asc`} value={`${column.key}:asc`}>{column.header} ↑</option>,
            <option key={`${column.key}:desc`} value={`${column.key}:desc`}>{column.header} ↓</option>,
          ])}
      </select>
    </label>
  ) : null

  if (!isDesktop) {
    return (
      <div className={`space-y-3 ${className}`.trim()} aria-busy={loading || undefined} aria-describedby={captionId}>
        <p id={captionId} className="sr-only">{caption}</p>
        {(selectable && onSelectionChange) || sortControl ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {selectable && onSelectionChange ? (
              <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input ref={selectAllRef} type="checkbox" className="h-5 w-5 accent-brand" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                Select all
              </label>
            ) : null}
            {sortControl}
          </div>
        ) : null}
        {stateBlock || (
          <ul className="space-y-3">
            {rows.map((row) => {
              const key = keyOf(row)
              return (
                <li key={key} className={`ui-card p-4 ${selected.has(key) ? 'ring-2 ring-brand' : ''}`}>
                  {(selectable && onSelectionChange) || rowActions ? (
                    <div className="mb-3 flex items-center justify-between gap-3">
                      {selectable && onSelectionChange ? (
                        <label className="flex min-h-11 items-center gap-2 text-sm">
                          <input type="checkbox" className="h-5 w-5 accent-brand" checked={selected.has(key)} onChange={() => toggleOne(row)} aria-label={`Select ${getRowLabel(row)}`} />
                          <span className="sr-only">Select</span>
                        </label>
                      ) : <span />}
                      {rowActions ? <div className="flex flex-wrap justify-end gap-2">{rowActions(row)}</div> : null}
                    </div>
                  ) : null}
                  <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-3 gap-y-1.5 text-sm">
                    {columns.filter((column) => !column.hideOnCard).map((column) => (
                      <React.Fragment key={column.key}>
                        <dt className="text-caption font-semibold uppercase tracking-wide text-muted">{column.cardLabel || column.header}</dt>
                        <dd className="min-w-0 break-words text-ink">{renderCell(column, row)}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className={`ui-card overflow-hidden ${className}`.trim()} aria-busy={loading || undefined}>
      <div className="overflow-x-auto">
        <table className={`ui-table ${density === 'compact' ? 'ui-table-compact' : density === 'dense' ? 'ui-table-dense' : ''}`}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && onSelectionChange ? (
                <th scope="col" className="w-12">
                  <input ref={selectAllRef} type="checkbox" className="h-5 w-5 accent-brand" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                </th>
              ) : null}
              {columns.map((column) => {
                const active = sort?.key === column.key
                const ariaSort = column.sortable ? (active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    style={column.width ? { width: column.width } : undefined}
                    className={`${column.align === 'right' ? 'text-right' : ''} ${column.hideBelow === 'lg' ? 'hidden lg:table-cell' : ''}`}
                  >
                    {column.sortable && onSortChange ? (
                      <button type="button" onClick={() => requestSort(column)} className="inline-flex items-center gap-1 uppercase hover:text-ink" aria-label={`Sort by ${column.header}`}>
                        {column.header}
                        {active ? (sort.direction === 'asc' ? <FiArrowUp aria-hidden="true" /> : <FiArrowDown aria-hidden="true" />) : <FiCode className="rotate-90 opacity-40" aria-hidden="true" />}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
              {rowActions ? <th scope="col" className={`text-right ${actionsCellClass}`.trim()}><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          {stateBlock ? null : (
            <tbody>
              {rows.map((row) => {
                const key = keyOf(row)
                return (
                  <tr key={key} className={selected.has(key) ? 'bg-brand-soft/40' : ''}>
                    {selectable && onSelectionChange ? (
                      <td>
                        <input type="checkbox" className="h-5 w-5 accent-brand" checked={selected.has(key)} onChange={() => toggleOne(row)} aria-label={`Select ${getRowLabel(row)}`} />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={column.key} className={`${column.align === 'right' ? 'text-right tabular-nums' : ''} ${column.hideBelow === 'lg' ? 'hidden lg:table-cell' : ''}`}>
                        {renderCell(column, row)}
                      </td>
                    ))}
                    {rowActions ? <td className={`text-right ${actionsCellClass}`.trim()}><div className="flex flex-wrap justify-end gap-2">{rowActions(row)}</div></td> : null}
                  </tr>
                )
              })}
            </tbody>
          )}
        </table>
      </div>
      {stateBlock}
    </div>
  )
}
