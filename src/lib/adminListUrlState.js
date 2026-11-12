// The admin Properties list keeps its tab, filters, search, sort and page in
// the URL, so a reload, a shared link or coming back from another screen lands
// on the same view. Pure module: safe for node --test.

export const LIST_TABS = Object.freeze(['pending', 'approved', 'rejected', '', 'duplicates'])
export const LIST_SORT_COLUMNS = Object.freeze(['created_at', 'rent_amount_bdt', 'status', 'updated_at'])
export const LIST_PAGE_SIZES = Object.freeze([20, 50, 100])

export const LIST_FILTER_DEFAULTS = Object.freeze({
  featured: '',
  archived: '',
  phoneKey: '',
  category: '',
  district: '',
  source: '',
  photos: '',
  incomplete: '',
  from: '',
  to: '',
})

export const LIST_STATE_DEFAULTS = Object.freeze({
  tab: 'pending',
  page: 1,
  pageSize: 20,
  sort: Object.freeze({ column: 'created_at', dir: 'desc' }),
  search: '',
  ...LIST_FILTER_DEFAULTS,
})

// state key -> query parameter
const FILTER_PARAMS = Object.freeze({
  featured: 'featured',
  archived: 'show',
  phoneKey: 'phone',
  category: 'cat',
  district: 'district',
  source: 'by',
  photos: 'photos',
  incomplete: 'incomplete',
  from: 'from',
  to: 'to',
})

const ALLOWED = Object.freeze({
  featured: ['true'],
  archived: ['archived'],
  source: ['ai', 'users'],
  photos: ['yes', 'no'],
  incomplete: ['1'],
})

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)

const cleanFilter = (key, raw) => {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  if (ALLOWED[key]) return ALLOWED[key].includes(value) ? value : ''
  if (key === 'from' || key === 'to') return isDate(value) ? value : ''
  if (key === 'phoneKey') return value.replace(/\D/g, '')
  return value.slice(0, 80)
}

const get = (params, name) => (typeof params?.get === 'function' ? params.get(name) : null)

/** Reads the list state from query parameters; anything invalid falls back to its default. */
export const parseListUrlState = (params) => {
  const status = get(params, 'status')
  const tab = status === 'all' ? '' : LIST_TABS.includes(status) && status !== '' ? status : LIST_STATE_DEFAULTS.tab

  const page = Number.parseInt(get(params, 'page') || '', 10)
  const size = Number.parseInt(get(params, 'size') || '', 10)
  const [column, dir] = String(get(params, 'sort') || '').split('.')

  const state = {
    tab,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: LIST_PAGE_SIZES.includes(size) ? size : LIST_STATE_DEFAULTS.pageSize,
    sort: LIST_SORT_COLUMNS.includes(column) ? { column, dir: dir === 'asc' ? 'asc' : 'desc' } : { ...LIST_STATE_DEFAULTS.sort },
    search: String(get(params, 'q') || '').slice(0, 120),
  }
  for (const [key, name] of Object.entries(FILTER_PARAMS)) state[key] = cleanFilter(key, get(params, name))
  return state
}

/**
 * Writes the list state into `params` (a URLSearchParams), leaving every other
 * parameter alone. Defaults are removed so the plain view has a plain URL.
 */
export const applyListUrlState = (params, state = {}) => {
  const set = (name, value) => {
    if (value === '' || value === null || value === undefined) params.delete(name)
    else params.set(name, String(value))
  }
  const tab = state.tab ?? LIST_STATE_DEFAULTS.tab
  set('status', tab === LIST_STATE_DEFAULTS.tab ? '' : tab === '' ? 'all' : tab)
  set('page', state.page > 1 ? state.page : '')
  set('size', state.pageSize && state.pageSize !== LIST_STATE_DEFAULTS.pageSize ? state.pageSize : '')
  const sort = state.sort || LIST_STATE_DEFAULTS.sort
  const isDefaultSort = sort.column === LIST_STATE_DEFAULTS.sort.column && sort.dir === LIST_STATE_DEFAULTS.sort.dir
  set('sort', isDefaultSort ? '' : `${sort.column}.${sort.dir === 'asc' ? 'asc' : 'desc'}`)
  set('q', String(state.search || '').trim())
  for (const [key, name] of Object.entries(FILTER_PARAMS)) set(name, cleanFilter(key, state[key]))
  return params
}
