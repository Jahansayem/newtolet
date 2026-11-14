'use client'

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiBell } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../i18n/useLanguage'
import { buildDashboardHref } from '../../lib/routePaths'
import { getNewMatchCounts, listSavedSearches, SAVED_SEARCHES_CHANGED_EVENT } from '../../services/savedSearchService'

const REFRESH_MS = 10 * 60 * 1000

/**
 * Header bell for signed-in users: total new listings across their saved searches (in-site alerts,
 * no email). Hidden when there is nothing new.
 */
const SavedSearchBell = ({ className = '' }) => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!user?.id) {
      setTotal(0)
      return undefined
    }

    let active = true
    const refresh = async () => {
      const { data } = await listSavedSearches(user.id)
      if (!active || !data.length) {
        if (active) setTotal(0)
        return
      }
      const counts = await getNewMatchCounts(data)
      if (active) setTotal(Object.values(counts).reduce((sum, count) => sum + count, 0))
    }

    void refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    window.addEventListener(SAVED_SEARCHES_CHANGED_EVENT, refresh)

    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener(SAVED_SEARCHES_CHANGED_EVENT, refresh)
    }
  }, [user?.id])

  if (!user?.id || total <= 0) {
    return null
  }

  const label = t('nav.savedSearchAlerts', { count: total })

  return (
    <Link
      to={buildDashboardHref('saved-searches')}
      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-brand-soft ${className}`}
      aria-label={label}
      title={label}
    >
      <FiBell className="text-lg" aria-hidden="true" />
      <span className="absolute right-1 top-1 min-w-5 rounded-full bg-danger px-1 text-center text-[11px] font-bold leading-5 text-white">
        {total > 99 ? '99+' : total}
      </span>
    </Link>
  )
}

export default SavedSearchBell
