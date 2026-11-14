'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PropertyListingCard from '../../components/PropertyListingCard'
import ListingCardSkeleton from '../../components/ListingCardSkeleton'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../i18n/useLanguage'
import {
  getGuestSavedProperties,
  getSavedProperties,
  SAVED_PROPERTIES_BROWSER_EVENT,
} from '../../services/userPanelService'

/**
 * Saved properties for everyone. Guests' saves live on this device (and move into the account at
 * login); signed-in users see their account favourites. The audit found guest saves had no page.
 */
const SavedPage = () => {
  const { t } = useLanguage()
  const { user, isLoading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const properties = user?.id ? await getSavedProperties(user.id) : await getGuestSavedProperties()
      setItems(Array.isArray(properties) ? properties : [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (authLoading) return undefined
    void load()
    const refresh = () => void load()
    window.addEventListener(SAVED_PROPERTIES_BROWSER_EVENT, refresh)
    return () => window.removeEventListener(SAVED_PROPERTIES_BROWSER_EVENT, refresh)
  }, [authLoading, load])

  return (
    <div className="site-shell min-h-[60vh] py-8">
      <h1 className="text-2xl font-bold text-ink md:text-3xl">{t('savedPage.title')}</h1>
      <p className="mt-1 text-body text-muted">{user?.id ? t('savedPage.subtitleAccount') : t('savedPage.subtitleGuest')}</p>

      {!user?.id && !authLoading ? (
        <p className="ui-note mt-4">
          {t('savedPage.guestHint')}{' '}
          <Link to="/login" state={{ from: '/saved' }} className="font-semibold text-brand underline-offset-2 hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      ) : null}

      <div className="mt-6">
        {loading || authLoading ? (
          <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => <ListingCardSkeleton key={index} />)}
          </div>
        ) : failed ? (
          <EmptyState
            role="alert"
            title={t('savedPage.error')}
            action={<button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => void load()}>{t('common.retry')}</button>}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title={t('savedPage.emptyTitle')}
            description={t('savedPage.emptyDescription')}
            action={<Link to="/bd/property-listing" className="ui-btn ui-btn-primary ui-btn-sm">{t('savedPage.browse')}</Link>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => <PropertyListingCard key={item.id} item={item} index={index} />)}
          </div>
        )}
      </div>
    </div>
  )
}

export default SavedPage
