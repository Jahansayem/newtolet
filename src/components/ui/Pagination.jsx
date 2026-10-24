import React, { useId } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import Button from './Button'

const DEFAULT_LABELS = {
  pagination: 'Pagination',
  previous: 'Previous',
  next: 'Next',
  rowsPerPage: 'Rows per page',
  showing: (from, to, total) => `Showing ${from}–${to} of ${total}`,
  empty: 'No results',
}

/** Server-side pagination controls with a polite result-count announcement. */
export default function Pagination({
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
  onPageSizeChange = null,
  pageSizeOptions = [20, 50, 100],
  labels = {},
  className = '',
}) {
  const l = { ...DEFAULT_LABELS, ...labels }
  const selectId = useId()
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(total, current * pageSize)

  return (
    <nav aria-label={l.pagination} className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}>
      <p className="text-caption text-muted" role="status" aria-live="polite">
        {total === 0 ? l.empty : l.showing(from, to, total)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-caption text-muted" htmlFor={selectId}>
            {l.rowsPerPage}
            <select id={selectId} className="ui-field h-9 min-h-0 w-auto py-1 text-sm" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<FiChevronLeft />} disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
            {l.previous}
          </Button>
          <span className="text-caption tabular-nums text-muted" aria-current="page">
            {current} / {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={current >= totalPages} onClick={() => onPageChange(current + 1)}>
            {l.next}
            <FiChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
