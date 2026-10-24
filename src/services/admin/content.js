// Content & operations lists that do not have their own module yet.

import { runAdminListQuery } from './adminQuery'

export const SEARCH_HISTORY_COLUMNS = `
  id, user_id, search_query, selected_location, selected_category, selected_price_range, result_count, page_path, created_at,
  users(id, name, email, phone)
`

export const listSearchHistory = ({ page = 1, pageSize = 20, sort, filters = {}, search = '' } = {}, { signal } = {}) =>
  runAdminListQuery({
    table: 'customer_search_history',
    columns: SEARCH_HISTORY_COLUMNS,
    page,
    pageSize,
    sort: sort || { column: 'created_at', dir: 'desc' },
    sortable: ['created_at', 'result_count'],
    filters: { user_id: filters.anonymous },
    filterSpec: { user_id: { op: 'is', values: () => null } },
    search,
    searchColumns: ['search_query', 'selected_location', 'selected_category', 'page_path'],
    signal,
  })
