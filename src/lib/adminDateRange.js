// Pure date-range helpers for the admin analytics views. Works on local
// calendar days and never imports the Supabase client, so `node --test` can
// load it directly.

const pad = (value) => String(value).padStart(2, '0')
const DAY_MS = 86400000

export const MAX_RANGE_DAYS = 366

export const RANGE_PRESETS = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
]

/** 'YYYY-MM-DD' in local time, or null for an invalid date. */
export const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight for a 'YYYY-MM-DD' key, or null when malformed. */
export const parseDateKey = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''))
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(match[3])) return null
  return date
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

/**
 * buildRange(preset, { start, end, now }) -> { preset, startKey, endKey, startDate, endDate, days }
 * Custom ranges are normalised (swapped when reversed, capped at MAX_RANGE_DAYS,
 * missing ends default to the last 7 days); unknown presets fall back to '7d'.
 */
export const buildRange = (preset = '7d', { start = null, end = null, now = new Date() } = {}) => {
  const today = startOfDay(now)
  let startDate
  let endDate = today
  let key = preset

  if (preset === '30d') {
    startDate = addDays(today, -29)
  } else if (preset === 'month') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1)
  } else if (preset === 'custom') {
    let from = parseDateKey(start) || addDays(today, -6)
    let to = parseDateKey(end) || today
    if (from > to) [from, to] = [to, from]
    const earliest = addDays(to, -(MAX_RANGE_DAYS - 1))
    if (from < earliest) from = earliest
    startDate = from
    endDate = to
  } else {
    key = '7d'
    startDate = addDays(today, -6)
  }

  return {
    preset: key,
    startKey: toDateKey(startDate),
    endKey: toDateKey(endDate),
    startDate: startOfDay(startDate),
    endDate: endOfDay(endDate),
    days: Math.round((startOfDay(endDate) - startOfDay(startDate)) / DAY_MS) + 1,
  }
}

/** Every date key from startKey to endKey inclusive (capped at MAX_RANGE_DAYS). */
export const eachDateKey = (startKey, endKey) => {
  const from = parseDateKey(startKey)
  const to = parseDateKey(endKey)
  if (!from || !to || from > to) return []
  const keys = []
  for (let cursor = from; cursor <= to && keys.length < MAX_RANGE_DAYS; cursor = addDays(cursor, 1)) {
    keys.push(toDateKey(cursor))
  }
  return keys
}

/** Count rows per local day across the range; days without rows are kept as 0. */
export const bucketByDay = (rows = [], getDate = (row) => row?.created_at, startKey, endKey) => {
  const counts = new Map(eachDateKey(startKey, endKey).map((key) => [key, 0]))
  for (const row of rows) {
    const key = toDateKey(getDate(row))
    if (key && counts.has(key)) counts.set(key, counts.get(key) + 1)
  }
  return Array.from(counts, ([date, count]) => ({ date, count }))
}

export const formatDateKey = (key) => {
  const date = parseDateKey(key)
  return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : String(key || '')
}

export const formatRangeLabel = (range) =>
  range.startKey === range.endKey ? formatDateKey(range.startKey) : `${formatDateKey(range.startKey)} – ${formatDateKey(range.endKey)}`
