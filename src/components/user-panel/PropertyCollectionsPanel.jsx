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
import { EmptyState, formatPanelDate, PanelCard, PanelCardHeader } from './UserPanelPrimitives'

const REFUND_REASON_OPTIONS = [
  ['rented_out', 'Already Rented Out'],
  ['unreachable', 'Phone Unreachable'],
  ['wrong_location', 'Wrong Location'],
  ['other', 'Other'],
]

const REFUND_STATUS_STYLES = {
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
}

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
    subtitle: 'Properties whose protected contact details were unlocked with points.',
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
    () => Object.fromEntries(REFUND_REASON_OPTIONS),
    []
  )

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
      setRefundNotice(error.message || 'Unable to create refund request.')
      return
    }

    setRefundNotice('Refund request submitted for review.')
    resetRefundModal()
    setRefreshKey((current) => current + 1)
  }

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
        {refundNotice ? (
          <p className="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            {refundNotice}
          </p>
        ) : null}

        {items.length === 0 ? (
          <EmptyState title={config.emptyTitle} description={config.emptyDescription} />
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
                        alt={item.category}
                        propertyType={item.property_type}
                        category={item.category}
                        pricing={item.pricing}
                      />
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
                      {isUnlockedPanel ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            Spent: {Number(item.credits_spent || 0)} points
                          </span>
                          {item.refund_status ? (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                REFUND_STATUS_STYLES[item.refund_status] ||
                                'bg-slate-100 text-slate-700'
                              }`}
                            >
                              Refund {String(item.refund_status).replace(/_/g, ' ')}
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
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Rent</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        <RentDisplay pricing={item.pricing} prefix="৳" />
                      </p>
                    </div>
                    <Link
                      to={buildListDetailsHref(item.id)}
                      className="inline-flex items-center justify-center rounded-2xl bg-[#1E73B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f]"
                    >
                      View Property
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
                        Claim Refund
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
            className="w-full max-w-lg rounded-3xl bg-white p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-900">Claim Refund</h3>
            <p className="mt-2 text-sm text-slate-600">
              Submit a review request for this unlock within the refund policy window.
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {selectedRefundEntry.property_type || selectedRefundEntry.category}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Unlocked: {formatPanelDate(selectedRefundEntry.unlocked_at)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Points spent: {Number(selectedRefundEntry.credits_spent || 0)}
              </p>
            </div>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Reason
            </label>
            <select
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
            >
              {REFUND_REASON_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Details
            </label>
            <textarea
              value={refundDetails}
              onChange={(event) => setRefundDetails(event.target.value)}
              rows={4}
              placeholder="Optional details for review"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
            />

            <Link to="/refund" className="mt-4 inline-flex text-sm font-semibold text-[#1E73B8] hover:underline">
              Read Refund Policy
            </Link>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={resetRefundModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitRefundRequest}
                disabled={submittingRefund}
                className="rounded-2xl bg-[#1E73B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submittingRefund ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PanelCard>
  )
}

export default PropertyCollectionsPanel
