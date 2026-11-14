'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiBell, FiSearch, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../i18n/useLanguage'
import {
  deleteSavedSearch,
  getNewMatchCounts,
  listSavedSearches,
  markSavedSearchSeen,
} from '../../services/savedSearchService'
import { buildSearchHref, getActiveSearchChips, getSearchChipLabel, getSearchRouteContext } from '../../Component/Home/propertySearch'
import { EmptyState, formatPanelDate, PanelCard, PanelCardHeader } from './UserPanelPrimitives'

const LISTING_CONTEXT = getSearchRouteContext('/bd/property-listing')

/** Saved searches with in-site "new listings since you last looked" counts. */
const SavedSearchesPanel = () => {
  const { t, tv, language } = useLanguage()
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [searches, setSearches] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data, error: loadError } = await listSavedSearches(user.id)
    setSearches(data)
    setError(loadError ? loadError.message || 'error' : '')
    setLoading(false)
    setCounts(await getNewMatchCounts(data))
  }, [user?.id])

  useEffect(() => {
    if (!isLoading) void load()
  }, [isLoading, load])

  const openSearch = async (search) => {
    await markSavedSearchSeen(search.id)
    navigate(buildSearchHref(search.filters || {}, LISTING_CONTEXT))
  }

  const removeSearch = async (search) => {
    await deleteSavedSearch(search.id)
    setSearches((current) => current.filter((entry) => entry.id !== search.id))
  }

  if (isLoading || loading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500" role="status">{t('common.loading')}</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard>
      <PanelCardHeader title={t('dashboard.savedSearches.title')} subtitle={t('dashboard.savedSearches.subtitle')} />
      <div className="px-6 py-6">
        {error ? <p className="ui-note ui-note-danger mb-4" role="alert">{t('dashboard.savedSearches.loadError')}</p> : null}
        {searches.length === 0 ? (
          <EmptyState title={t('dashboard.savedSearches.emptyTitle')} description={t('dashboard.savedSearches.emptyDescription')} />
        ) : (
          <ul className="space-y-3">
            {searches.map((search) => {
              const newCount = counts[search.id] || 0
              const chips = getActiveSearchChips(search.filters || {})
              return (
                <li key={search.id} className="ui-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {search.label}
                      {newCount > 0 ? (
                        <span className="ui-badge ui-badge-brand inline-flex items-center gap-1">
                          <FiBell aria-hidden="true" />
                          {t('dashboard.savedSearches.newCount', { count: newCount })}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-caption text-muted">
                      {chips.map((chip) => getSearchChipLabel(chip, t, tv)).join(' · ') || t('dashboard.savedSearches.allListings')}
                    </p>
                    <p className="mt-0.5 text-caption text-muted">
                      {t('dashboard.savedSearches.lastChecked', { date: formatPanelDate(search.last_seen_at, true, language) })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => void openSearch(search)}>
                      <FiSearch aria-hidden="true" />
                      {t('dashboard.savedSearches.open')}
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn-danger-outline ui-btn-sm"
                      onClick={() => void removeSearch(search)}
                      aria-label={t('dashboard.savedSearches.deleteLabel', { label: search.label })}
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PanelCard>
  )
}

export default SavedSearchesPanel
