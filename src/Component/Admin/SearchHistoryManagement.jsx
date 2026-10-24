'use client'

import React, { useMemo } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { listSearchHistory } from '../../services/admin/content'
import { useShellHeader } from '../../components/panel/PanelShellContext'
import { useAdminList } from '../../components/admin-panel/hooks/useAdminList'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Pagination from '../../components/ui/Pagination'

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

const formatLocation = (location) => {
  if (!location) return 'Any location'
  if (typeof location === 'string') return location
  return [location.upazilla, location.district, location.division].filter(Boolean).join(', ') || 'Any location'
}

const SearchHistoryManagement = () => {
  const list = useAdminList({ domain: 'search-history', fetcher: listSearchHistory, initialFilters: { anonymous: '' } })

  const headerActions = useMemo(
    () => (
      <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => list.refresh()} busy={list.isRefreshing} busyLabel="Refreshing…">
        Refresh
      </Button>
    ),
    [list]
  )
  useShellHeader({ actions: headerActions })

  const columns = useMemo(
    () => [
      {
        key: 'search_query',
        header: 'Search',
        render: (entry) => (
          <div className="min-w-0">
            <p className="font-medium text-ink">{entry.search_query || 'Filter-only search'}</p>
            <p className="text-caption text-muted">{[entry.selected_category, entry.selected_price_range].filter(Boolean).join(' · ') || 'Default filters'}</p>
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Visitor',
        render: (entry) =>
          entry.users ? (
            <div className="min-w-0">
              <p className="font-medium text-ink">{entry.users.name || entry.users.email}</p>
              <p className="truncate text-caption text-muted">{[entry.users.email, entry.users.phone].filter(Boolean).join(' · ')}</p>
            </div>
          ) : (
            <Badge variant="neutral">Anonymous</Badge>
          ),
      },
      { key: 'location', header: 'Location', hideBelow: 'lg', render: (entry) => formatLocation(entry.selected_location) },
      { key: 'result_count', header: 'Results', sortable: true, align: 'right', render: (entry) => entry.result_count ?? 0 },
      { key: 'page_path', header: 'Page', hideBelow: 'lg', render: (entry) => <span className="break-all font-mono text-xs">{entry.page_path || '/'}</span> },
      { key: 'created_at', header: 'Logged', sortable: true, render: (entry) => formatDateTime(entry.created_at) },
    ],
    []
  )

  return (
    <div className="space-y-4">
      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search history', placeholder: 'Query, location, category or page…' }}
        filters={[{ key: 'anonymous', label: 'Visitor', type: 'select', value: list.filters.anonymous, onChange: (value) => list.setFilter('anonymous', value), options: [{ value: 'anonymous', label: 'Anonymous only' }], placeholder: 'Everyone' }]}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="searches"
      />

      <DataTable
        caption="Visitor search history"
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
        onRetry={list.retry}
        empty={<EmptyState title="No searches logged" description="Searches appear here as visitors use the site." />}
        sort={{ key: list.sort.column, direction: list.sort.dir }}
        onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
        getRowLabel={(entry) => entry.search_query || 'search'}
      />

      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />
    </div>
  )
}

export default SearchHistoryManagement
