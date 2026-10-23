'use client'

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiEye, FiHeart, FiMapPin, FiUnlock } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { buildListDetailsHref } from '../../lib/routePaths'
import {
  createContactUnlockRefundRequest,
  getRecentlyViewedProperties,
  getSavedProperties,
  getUnlockedProperties,
} from '../../services/userPanelService'
import { PropertyThumbnailImage } from '../PropertyCardMedia'
import RentDisplay from '../RentDisplay'
import { useLanguage } from '../../i18n/useLanguage'
import { EmptyState, formatPanelDate, PanelCard, PanelCardHeader } from './UserPanelPrimitives'
import { getPropertyIdNumber } from '../../utils/propertyDisplaySerial'

const REFUND_REASON_OPTIONS = [
  ['rented_out', 'dashboard.collections.refundReasons.rented_out'],
  ['unreachable', 'dashboard.collections.refundReasons.unreachable'],
  ['wrong_location', 'dashboard.collections.refundReasons.wrong_location'],
  ['other', 'dashboard.collections.refundReasons.other'],
]

const REFUND_STATUS_STYLES = {
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
}

const PANEL_BY_TYPE = {
  saved: {
    titleKey: 'dashboard.collections.saved.title',
    subtitleKey: 'dashboard.collections.saved.subtitle',
    emptyTitleKey: 'dashboard.collections.saved.emptyTitle',
    emptyDescriptionKey: 'dashboard.collections.saved.emptyDescription',
    loadingKey: 'dashboard.collections.saved.loading',
    icon: FiHeart,
    loader: getSavedProperties,
    metadata: () => null,
  },
  unlocked: {
    titleKey: 'dashboard.collections.unlocked.title',
    subtitleKey: 'dashboard.collections.unlocked.subtitle',
    emptyTitleKey: 'dashboard.collections.unlocked.emptyTitle',
    emptyDescriptionKey: 'dashboard.collections.unlocked.emptyDescription',
    loadingKey: 'dashboard.collections.unlocked.loading',
    icon: FiUnlock,
    loader: getUnlockedProperties,
    metadata: (entry, { t, language }) =>
      entry.unlocked_at
        ? t('dashboard.collections.unlockedAt', {
            date: formatPanelDate(entry.unlocked_at, true, language),
          })
        : null,
  },
  viewed: {
    titleKey: 'dashboard.collections.viewed.title',
    subtitleKey: 'dashboard.collections.viewed.subtitle',
    emptyTitleKey: 'dashboard.collections.viewed.emptyTitle',
    emptyDescriptionKey: 'dashboard.collections.viewed.emptyDescription',
    loadingKey: 'dashboard.collections.viewed.loading',
    icon: FiEye,
    loader: getRecentlyViewedProperties,
    metadata: (entry, { t, language }) =>
      t('dashboard.collections.viewedMeta', {
        count: entry.view_count || 0,
        date: formatPanelDate(entry.last_viewed_at, true, language),
      }),
  },
}

const PropertyCollectionsPanel = ({ type }) => {
  const { t, tv, language } = useLanguage()
  const { user, isLoading } = useAuth()
  const [selectedRefundEntry, setSelectedRefundEntry] = useState(null)
  const [refundReason, setRefundReason] = useState(REFUND_REASON_OPTIONS[0][0])
  const [refundDetails, setRefundDetails] = useState('')
  const [refundNotice, setRefundNotice] = useState('')
  const [submittingRefund, setSubmittingRefund] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
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
    refreshKey,
  })

  const isUnlockedPanel = type === 'unlocked'
  const refundReasonLabel = useMemo(
    () => Object.fromEntries(REFUND_REASON_OPTIONS.map(([value, labelKey]) => [value, t(labelKey)])),
    [t]
  )

  const getRefundStatusLabel = (status) => {
    const raw = String(status)
    const translated = tv('refundStatus', raw)
    return translated === raw ? raw.replace(/_/g, ' ') : translated
  }

  const resetRefundModal = () => {
    setSelectedRefundEntry(null)
    setRefundReason(REFUND_REASON_OPTIONS[0][0])
    setRefundDetails('')
  }

  const handleSubmitRefundRequest = async () => {
    if (!selectedRefundEntry?.contact_view_id) {
      return
    }

    setSubmittingRefund(true)
    setRefundNotice('')

    const { error } = await createContactUnlockRefundRequest(
      selectedRefundEntry.contact_view_id,
      refundReason,
      refundDetails
    )

    setSubmittingRefund(false)

    if (error) {
      setRefundNotice(error.message || t('dashboard.collections.refundError'))
      return
    }

    setRefundNotice(t('dashboard.collections.refundSubmitted'))
    resetRefundModal()
    setRefreshKey((current) => current + 1)
  }

  if (!config) {
    return null
  }

  if (isLoading || itemsLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">{t(config.loadingKey)}</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard>
      <PanelCardHeader
        title={t(config.titleKey)}
        subtitle={t(config.subtitleKey)}
        status={isRefreshing ? t('dashboard.common.refreshing') : null}
      />

      <div className="px-6 py-6">
        {refundNotice ? (
          <p className="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            {refundNotice}
          </p>
        ) : null}

        {items.length === 0 ? (
          <EmptyState title={t(config.emptyTitleKey)} description={t(config.emptyDescriptionKey)} />
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-3xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="h-24 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      <PropertyThumbnailImage
                        src={item.primary_image}
                        alt={tv('categories', item.category)}
                        propertyType={item.property_type}
                        category={item.category}
                        pricing={item.pricing}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-brand">
                          {tv('categories', item.category)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {t('listing.card.idLabel', { id: getPropertyIdNumber(item) })}
                        </span>
                      </div>

                      <p className="mt-3 text-lg font-semibold text-slate-900">
                        {item.property_type ? tv('propertyTypes', item.property_type) : tv('categories', item.category)}
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
                        {config.metadata(item, { t, language }) ||
                          t('dashboard.collections.createdAt', {
                            date: formatPanelDate(item.created_at, true, language),
                          })}
                      </p>
                      {isUnlockedPanel ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {t('dashboard.collections.spentPoints', { count: Number(item.credits_spent || 0) })}
                          </span>
                          {item.refund_status ? (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                REFUND_STATUS_STYLES[item.refund_status] ||
                                'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {t('dashboard.collections.refundBadge', {
                                status: getRefundStatusLabel(item.refund_status),
                              })}
                            </span>
                          ) : null}
                          {item.refund_reason_code ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {refundReasonLabel[item.refund_reason_code] || item.refund_reason_code}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('dashboard.collections.rent')}</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        <RentDisplay pricing={item.pricing} prefix="৳" />
                      </p>
                    </div>
                    <Link
                      to={buildListDetailsHref(item.id)}
                      className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
                    >
                      {t('dashboard.common.viewProperty')}
                    </Link>
                    {isUnlockedPanel && item.can_claim_refund ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRefundNotice('')
                          setSelectedRefundEntry(item)
                        }}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {t('dashboard.collections.claimRefund')}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedRefundEntry ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={resetRefundModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-modal-title"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="refund-modal-title" className="text-xl font-bold text-slate-900">{t('dashboard.collections.refundModal.title')}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {t('dashboard.collections.refundModal.description')}
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {selectedRefundEntry.property_type
                  ? tv('propertyTypes', selectedRefundEntry.property_type)
                  : tv('categories', selectedRefundEntry.category)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t('dashboard.collections.refundModal.unlockedAt', {
                  date: formatPanelDate(selectedRefundEntry.unlocked_at, true, language),
                })}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t('dashboard.collections.refundModal.pointsSpent', {
                  count: Number(selectedRefundEntry.credits_spent || 0),
                })}
              </p>
            </div>

            <label htmlFor="refund-reason" className="mt-4 block text-sm font-medium text-slate-700">
              {t('dashboard.collections.refundModal.reason')}
            </label>
            <select
              id="refund-reason"
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
            >
              {REFUND_REASON_OPTIONS.map(([value, labelKey]) => (
                <option key={value} value={value}>
                  {t(labelKey)}
                </option>
              ))}
            </select>

            <label htmlFor="refund-details" className="mt-4 block text-sm font-medium text-slate-700">
              {t('dashboard.collections.refundModal.details')}
            </label>
            <textarea
              id="refund-details"
              value={refundDetails}
              onChange={(event) => setRefundDetails(event.target.value)}
              rows={4}
              placeholder={t('dashboard.collections.refundModal.detailsPlaceholder')}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
            />

            <Link to="/refund" className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline">
              {t('dashboard.collections.refundModal.readPolicy')}
            </Link>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetRefundModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmitRefundRequest}
                disabled={submittingRefund}
                className="rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submittingRefund ? t('dashboard.common.submitting') : t('dashboard.collections.refundModal.submit')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PanelCard>
  )
}

export default PropertyCollectionsPanel
