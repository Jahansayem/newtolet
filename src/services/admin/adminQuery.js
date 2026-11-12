// Server-side list query builder for admin tables: pagination (range),
// whitelisted sorting, typed filters and ilike search, all in one request
// with an exact count. Never select('*') in list views: callers pass the
// exact column list they render.

import { supabase } from '../supabaseClient'
import { buildIlikeOrFilter } from '../../lib/postgrestSearch'
import { emptyList, fail, normalizeSupabaseError, ok, withHttpStatus } from './adminResult'

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max)

/**
 * @param {object} options
 * @param {string} options.table
 * @param {string} options.columns  exact select string (may include embeds)
 * @param {number} [options.page=1]
 * @param {number} [options.pageSize=20]  1..100
 * @param {{column:string, dir:'asc'|'desc'}} [options.sort]
 * @param {string[]} [options.sortable]  whitelist of sortable columns
 * @param {object} [options.filters]     { key: value }
 * @param {object} [options.filterSpec]  { key: { op: 'eq'|'in'|'is'|'ilike'|'range', column?, values?(v) } }
 * @param {string} [options.search]
 * @param {string[]} [options.searchColumns]
 * @param {(q:any)=>any} [options.apply]  escape hatch applied last
 * @param {(row:any)=>any} [options.map]
 * @param {AbortSignal} [options.signal]
 * @param {'exact'|'planned'|'estimated'} [options.count='exact']
 */
export const runAdminListQuery = async ({
  table,
  columns,
  page = 1,
  pageSize = 20,
  sort = { column: 'created_at', dir: 'desc' },
  sortable = ['created_at'],
  filters = {},
  filterSpec = {},
  search = '',
  searchColumns = [],
  apply = null,
  map = null,
  signal = null,
  count = 'exact',
}) => {
  const safePage = clamp(page, 1, 100000)
  const safePageSize = clamp(pageSize, 1, 100)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1
  const paging = { page: safePage, pageSize: safePageSize }

  try {
    let query = supabase.from(table).select(columns, { count })

    for (const [key, rawValue] of Object.entries(filters || {})) {
      if (rawValue === undefined || rawValue === null || rawValue === '' || rawValue === 'all') continue
      const spec = filterSpec[key] || { op: 'eq' }
      const column = spec.column || key
      const value = spec.values ? spec.values(rawValue) : rawValue
      switch (spec.op) {
        case 'in': {
          const list = Array.isArray(value) ? value : [value]
          if (list.length > 0) query = query.in(column, list)
          break
        }
        case 'is':
          query = query.is(column, value === 'null' ? null : value)
          break
        case 'ilike':
          query = query.ilike(column, `%${value}%`)
          break
        case 'range':
          if (value?.gte) query = query.gte(column, value.gte)
          if (value?.lte) query = query.lte(column, value.lte)
          break
        case 'gte':
          query = query.gte(column, value)
          break
        case 'lte':
          query = query.lte(column, value)
          break
        case 'eq':
        default:
          query = query.eq(column, value)
      }
    }

    const orFilter = buildIlikeOrFilter(search, searchColumns)
    if (orFilter) query = query.or(orFilter)

    const sortColumn = sortable.includes(sort?.column) ? sort.column : sortable[0] || 'created_at'
    const ascending = sort?.dir === 'asc'
    query = query.order(sortColumn, { ascending, nullsFirst: false })
    if (sortColumn !== 'id') query = query.order('id', { ascending: true })

    if (apply) query = apply(query) || query
    query = query.range(from, to)
    if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal)

    const { data, error, count: total, status } = await query
    if (error) return fail(withHttpStatus(error, status), { paging })
    const rows = (data || []).map((row) => (map ? map(row) : row))
    const totalCount = typeof total === 'number' ? total : from + rows.length
    if (rows.length === 0 && totalCount === 0) return emptyList(safePage, safePageSize)
    return ok(rows, { ...paging, totalCount, hasMore: from + rows.length < totalCount })
  } catch (error) {
    return fail(error, { paging })
  }
}

/** Fetches every page of a list (for CSV export); stops at maxRows. */
export const fetchAllPages = async (listFn, params = {}, { maxRows = 5000, pageSize = 500 } = {}) => {
  const rows = []
  let page = 1
  let truncated = false
  for (;;) {
    const result = await listFn({ ...params, page, pageSize })
    if (result.error) return { ...result, data: rows, truncated }
    rows.push(...(result.data || []))
    if (!result.hasMore) break
    if (rows.length >= maxRows) {
      truncated = true
      break
    }
    page += 1
  }
  return { ...ok(rows), totalCount: rows.length, truncated }
}

/** Convenience for a single row by id with a precise column list. */
export const fetchAdminRow = async ({ table, columns, id, map = null, signal = null }) => {
  try {
    let query = supabase.from(table).select(columns).eq('id', id).maybeSingle()
    if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal)
    const { data, error, status } = await query
    if (error) return fail(withHttpStatus(error, status))
    if (!data) return fail({ code: 'PGRST116', message: 'Row not found' })
    return ok(map ? map(data) : data)
  } catch (error) {
    return { data: null, error: normalizeSupabaseError(error), auditId: null }
  }
}
