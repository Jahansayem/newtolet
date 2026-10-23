'use client'

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiBarChart2, FiEdit2, FiEye, FiMapPin, FiPlus, FiPower, FiStar, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { buildEditPropertyHref, buildListDetailsHref } from '../../lib/routePaths'
import { deleteProperty, getUserProperties } from '../../services/propertyService'
import { getPropertyAnalytics, pinPropertyFor24h, updatePropertyPanelState } from '../../services/userPanelService'
import UserPanelShell from '../../components/user-panel/UserPanelShell.jsx'
import { EmptyState, formatPanelDate, PanelCard, PanelCardHeader } from '../../components/user-panel/UserPanelPrimitives.jsx'
import { PropertyThumbnailImage } from '../../components/PropertyCardMedia.jsx'
import Dialog from '../../components/ui/Dialog'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatPinnedUntil, PIN_PROPERTY_COST } from '../../utils/propertyPinning'
import { getPropertyIdNumber } from '../../utils/propertyDisplaySerial'
import { useLanguage } from '../../i18n/useLanguage'

const STATUS_FILTERS = [
  { value: 'All', labelKey: 'dashboard.myProperties.filters.all' },
  { value: 'Active', labelKey: 'dashboard.myProperties.filters.active' },
  { value: 'Deactivated', labelKey: 'dashboard.myProperties.filters.deactivated' },
]

const PropertyAnalyticsModal = ({ property, onClose }) => {
  const { t, tv } = useLanguage()
  const { data: stats, isLoading: loading, isRefreshing } = useCachedPanelResource({
    userId: 'global',
    resourceKey: property?.id ? `property-analytics:${property.id}` : null,
    loader: () => getPropertyAnalytics(property.id),
    enabled: Boolean(property?.id),
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('dashboard.myProperties.analyticsTitle')}
      description={t('dashboard.myProperties.analyticsSubtitle', {
        category: tv('categories', property.category),
        location: [property.location?.area, property.location?.state_district].filter(Boolean).join(', '),
      })}
      closeLabel={t('common.close')}
      footer={(
        <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm">
          {t('common.close')}
        </button>
      )}
    >
      {isRefreshing ? <p className="mb-3 text-caption font-medium text-muted">{t('dashboard.common.refreshing')}</p> : null}
      {loading ? (
        <p className="text-body text-muted" role="status">{t('dashboard.myProperties.loadingAnalytics')}</p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-canvas p-4">
            <dt className="text-caption text-muted">{t('dashboard.myProperties.viewCount')}</dt>
            <dd className="ui-price mt-1 text-3xl">{stats.recentViewCount}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-4">
            <dt className="text-caption text-muted">{t('dashboard.myProperties.unlocks')}</dt>
            <dd className="ui-price mt-1 text-3xl">{stats.contactUnlocks}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-4">
            <dt className="text-caption text-muted">{t('dashboard.myProperties.creditsSpent')}</dt>
            <dd className="ui-price mt-1 text-3xl">{stats.totalCreditsSpent}</dd>
          </div>
        </dl>
      )}
    </Dialog>
  )
}

const MyProperties = () => {
  const { t, tv, language } = useLanguage()
  const { user, isLoading, updateUserInContext } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [analyticsProperty, setAnalyticsProperty] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pinningPropertyId, setPinningPropertyId] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const {
    data: properties = [],
    isLoading: propertiesLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'my-properties',
    loader: () => getUserProperties(user.id),
    enabled: !isLoading && Boolean(user?.id),
    refreshKey,
  })

  const propertyList = useMemo(() => (Array.isArray(properties) ? properties : []), [properties])

  const filteredProperties = useMemo(() => {
    return propertyList.filter((property) => {
      const statusMatch =
        statusFilter === 'All' ||
        (statusFilter === 'Active' ? property.is_active !== false : property.is_active === false)

      const searchValue = search.trim().toLowerCase()
      const searchMatch =
        !searchValue ||
        [
          property.property_id_number,
          property.category,
          property.location?.area,
          property.location?.state_district,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(searchValue)

      return statusMatch && searchMatch
    })
  }, [propertyList, search, statusFilter])

  const handleDeactivateToggle = async (property) => {
    const nextIsActive = property.is_active === false
    const { error } = await updatePropertyPanelState(property.id, {
      is_active: nextIsActive,
      deactivated_at: nextIsActive ? null : new Date().toISOString(),
    })

    if (error) {
      setMessageType('error')
      setMessage(error.message || t('dashboard.myProperties.statusUpdateError'))
      return
    }

    setMessageType('success')
    setMessage(nextIsActive ? t('dashboard.myProperties.postActivated') : t('dashboard.myProperties.postDeactivated'))
    setRefreshKey((current) => current + 1)
  }

  const handlePinProperty = async (property) => {
    if (property.user_id && property.user_id !== user?.id) {
      setMessageType('error')
      setMessage(t('dashboard.myProperties.ownPinOnly'))
      return
    }

    if (Number(user?.credits || 0) < PIN_PROPERTY_COST) {
      setMessageType('error')
      setMessage(t('dashboard.myProperties.needCredits', { cost: PIN_PROPERTY_COST }))
      return
    }

    setPinningPropertyId(property.id)
    const { data, error } = await pinPropertyFor24h(property.id, user?.id)
    setPinningPropertyId(null)

    if (error) {
      setMessageType('error')
      setMessage(error.message || t('dashboard.myProperties.pinError'))
      return
    }

    if (Number.isFinite(Number(data?.remainingCredits))) {
      updateUserInContext({ credits: Number(data.remainingCredits) })
    }

    setMessageType('success')
    setMessage(t('dashboard.myProperties.pinnedFor24h'))
    setRefreshKey((current) => current + 1)
  }

  const handleDelete = (propertyId) => {
    setPendingDeleteId(propertyId)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) {
      return
    }

    setDeleting(true)
    try {
      await deleteProperty(pendingDeleteId)
      setMessageType('success')
      setMessage(t('dashboard.myProperties.deleted'))
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setMessageType('error')
      setMessage(error?.message || t('dashboard.myProperties.pinError'))
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  return (
    <UserPanelShell activeKey="myproperties">
      <PanelCard>
        <PanelCardHeader
          title={t('dashboard.myProperties.title')}
          subtitle={t('dashboard.myProperties.subtitle')}
          status={isRefreshing ? t('dashboard.common.refreshing') : null}
          action={
            <Link
              to="/addproperty"
              className="ui-btn ui-btn-primary ui-btn-sm"
            >
              <FiPlus />
              {t('dashboard.myProperties.submitProperty')}
            </Link>
          }
        />

        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-col gap-4 rounded-3xl bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  aria-pressed={statusFilter === filter.value}
                  className="ui-chip min-h-9 text-sm"
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('dashboard.myProperties.searchPlaceholder')}
              aria-label={t('dashboard.myProperties.searchPlaceholder')}
              className="ui-field max-w-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {t('dashboard.myProperties.country')}
            </span>
          </div>

          {message ? (
            <p role={messageType === 'error' ? 'alert' : 'status'} className={`ui-note ${messageType === 'error' ? 'ui-note-danger text-danger' : 'ui-note-success text-success'}`}>
              {message}
            </p>
          ) : null}

          {isLoading || propertiesLoading ? (
            <p className="text-slate-500">{t('dashboard.myProperties.loading')}</p>
          ) : filteredProperties.length === 0 ? (
            <EmptyState
              title={t('dashboard.myProperties.emptyTitle')}
              description={t('dashboard.myProperties.emptyDescription')}
            />
          ) : (
            <div className="space-y-4">
              {filteredProperties.map((property) => (
                <div
                  key={property.id}
                  className="rounded-3xl border border-slate-200 p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                    <div className="relative h-28 w-32 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      <PropertyThumbnailImage
                        src={property.primary_image}
                        alt={tv('categories', property.category)}
                        propertyType={property.property_type}
                        category={property.category}
                        pricing={property.pricing}
                      />
                      {property.is_pinned ? (
                        <span className="ui-badge ui-badge-promoted absolute left-2 top-2">
                          {t('dashboard.myProperties.pinned')}
                        </span>
                      ) : null}
                    </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="ui-id-ticket">
                            {t('listing.card.idLabel', { id: getPropertyIdNumber(property) })}
                          </span>
                          <span
                            className={`ui-badge ${property.is_active === false ? 'ui-badge-danger' : 'ui-badge-success'}`}
                          >
                            {property.is_active === false ? t('dashboard.myProperties.deactivated') : t('dashboard.myProperties.active')}
                          </span>
                          {property.is_pinned ? (
                            <span className="ui-badge ui-badge-promoted">
                              {t('dashboard.myProperties.pinned')}
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-3 text-lg font-semibold text-slate-900">
                          {tv('categories', property.category)}
                        </p>
                        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                          <FiMapPin className="shrink-0" />
                          <span>
                            {[property.location?.area, property.location?.state_district]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {t('dashboard.myProperties.created', {
                            date: formatPanelDate(property.created_at, true, language),
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
                      <Link
                        to={buildListDetailsHref(property.id)}
                        className="ui-btn ui-btn-primary ui-btn-sm"
                      >
                        <FiEye />
                        {t('dashboard.myProperties.showPost')}
                      </Link>
                      <Link
                        to={buildEditPropertyHref(property.id)}
                        className="ui-btn ui-btn-secondary ui-btn-sm"
                      >
                        <FiEdit2 />
                        {t('dashboard.myProperties.editPost')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeactivateToggle(property)}
                        className="ui-btn ui-btn-secondary ui-btn-sm"
                      >
                        <FiPower />
                        {property.is_active === false ? t('dashboard.myProperties.activatePost') : t('dashboard.myProperties.deactivatePost')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsProperty(property)}
                        className="ui-btn ui-btn-secondary ui-btn-sm"
                      >
                        <FiBarChart2 />
                        {t('dashboard.myProperties.analytics')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePinProperty(property)}
                        disabled={property.is_pinned || pinningPropertyId === property.id}
                        className="ui-btn ui-btn-secondary ui-btn-sm"
                      >
                        <FiStar />
                        {property.is_pinned
                          ? t('dashboard.myProperties.pinnedUntil', {
                              time:
                                formatPinnedUntil(property.pinned_until) ||
                                t('dashboard.myProperties.pinnedUntilFallback'),
                            })
                          : pinningPropertyId === property.id
                            ? t('dashboard.myProperties.pinning')
                            : t('dashboard.myProperties.pinFor24h', { cost: PIN_PROPERTY_COST })}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(property.id)}
                        className="ui-btn ui-btn-danger-outline ui-btn-sm"
                      >
                        <FiTrash2 />
                        {t('dashboard.myProperties.deletePost')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PanelCard>

      {analyticsProperty ? (
        <PropertyAnalyticsModal
          property={analyticsProperty}
          onClose={() => setAnalyticsProperty(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        title={t('dashboard.myProperties.deletePost')}
        description={t('dashboard.myProperties.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        closeLabel={t('common.close')}
        busy={deleting}
        busyLabel={t('dashboard.common.saving')}
      />
    </UserPanelShell>
  )
}

export default MyProperties
