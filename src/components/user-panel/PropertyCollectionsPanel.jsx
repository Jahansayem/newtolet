'use client'

import React from 'react'
import { Link } from 'react-router-dom'
import { FiEye, FiHeart, FiMapPin, FiUnlock } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { buildListDetailsHref } from '../../lib/routePaths'
import {
  getRecentlyViewedProperties,
  getSavedProperties,
  getUnlockedProperties,
} from '../../services/userPanelService'
import { EmptyState, formatPanelDate, PanelCard, PanelCardHeader } from './UserPanelPrimitives'

const PANEL_BY_TYPE = {
  saved: {
    title: 'Property Saveds',
    subtitle: 'Listings you saved from across the site are collected here.',
    emptyTitle: 'No property saveds',
    emptyDescription: 'Save properties while browsing and they will appear here.',
    icon: FiHeart,
    loader: getSavedProperties,
    metadata: () => null,
  },
  unlocked: {
    title: 'Unlocked Listings',
    subtitle: 'Properties whose protected contact details were unlocked with credits.',
    emptyTitle: 'No unlocked listings',
    emptyDescription: 'Unlock a property contact to keep it listed here for quick access.',
    icon: FiUnlock,
    loader: getUnlockedProperties,
    metadata: (entry) =>
      entry.unlocked_at ? `Unlocked: ${formatPanelDate(entry.unlocked_at)}` : null,
  },
  viewed: {
    title: 'Recently Viewed',
    subtitle: 'Your latest authenticated property visits, ordered by the most recent view.',
    emptyTitle: 'No recently viewed listings',
    emptyDescription: 'Open property details while signed in and they will appear here.',
    icon: FiEye,
    loader: getRecentlyViewedProperties,
    metadata: (entry) =>
      `Total Views: ${entry.view_count || 0} • Last Viewed: ${formatPanelDate(entry.last_viewed_at)}`,
  },
}

const PropertyCollectionsPanel = ({ type }) => {
  const { user, isLoading } = useAuth()
  const config = PANEL_BY_TYPE[type]
  const resourceKeyByType = {
    saved: 'saved-properties',
    unlocked: 'unlocked-properties',
    viewed: 'recently-viewed',
  }
  const {
    data: items = [],
    isLoading: itemsLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: resourceKeyByType[type],
    loader: () => config.loader(user.id),
    enabled: !isLoading && Boolean(user?.id) && Boolean(config),
  })

  if (!config) {
    return null
  }

  if (isLoading || itemsLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">Loading {config.title.toLowerCase()}...</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard>
      <PanelCardHeader
        title={config.title}
        subtitle={config.subtitle}
        status={isRefreshing ? 'Refreshing...' : null}
      />

      <div className="px-6 py-6">
        {items.length === 0 ? (
          <EmptyState title={config.emptyTitle} description={config.emptyDescription} />
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const Icon = config.icon

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-3xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="h-24 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      {item.primary_image ? (
                        <img
                          src={item.primary_image}
                          alt={item.category}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#1E73B8]">
                          {item.category}
                        </span>
                        {item.property_id_number ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            ID: {item.property_id_number}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 text-lg font-semibold text-slate-900">
                        {item.property_type || item.category}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                        <FiMapPin className="shrink-0" />
                        <span>
                          {[item.location?.area, item.location?.state_district]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {config.metadata(item) || `Created: ${formatPanelDate(item.created_at)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Rent</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        ৳{Number(item.pricing?.rent_amount_bdt || 0).toLocaleString('en-BD')}
                      </p>
                    </div>
                    <Link
                      to={buildListDetailsHref(item.id)}
                      className="inline-flex items-center justify-center rounded-2xl bg-[#1E73B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f]"
                    >
                      View Property
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PanelCard>
  )
}

export default PropertyCollectionsPanel
