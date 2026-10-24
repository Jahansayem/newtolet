// CSV export helpers (RFC 4180 quoting, UTF-8 BOM for Excel, formula-injection
// defusing). Pure module, safe for node --test; downloadCsv is a no-op on the server.

const needsQuotes = (text, delimiter) => text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r')

/** Prefixes cells that a spreadsheet would evaluate as a formula. */
export const csvSafeCell = (value) => {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return text
}

/**
 * toCsv(rows, columns, options)
 * columns: [{ key, label, format?(value, row) }]
 */
export const toCsv = (rows = [], columns = [], { delimiter = ',', bom = true, eol = '\r\n' } = {}) => {
  const quote = (value) => {
    const text = csvSafeCell(value)
    return needsQuotes(text, delimiter) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = columns.map((column) => quote(column.label || column.key)).join(delimiter)
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const raw = typeof column.key === 'function' ? column.key(row) : row?.[column.key]
        return quote(column.format ? column.format(raw, row) : raw)
      })
      .join(delimiter)
  )
  return `${bom ? '﻿' : ''}${[header, ...body].join(eol)}${eol}`
}

export const downloadCsv = (filename, csv) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export const csvFilename = (prefix) => `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`
