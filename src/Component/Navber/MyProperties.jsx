'use client'

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiBarChart2, FiEdit2, FiEye, FiMapPin, FiPlus, FiPower, FiStar, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { buildEditPropertyHref, buildListDetailsHref } from '../../lib/routePaths'
import { deleteProperty, getUserProperties } from '../../services/propertyService'
import { getPropertyAnalytics, updatePropertyPanelState } from '../../services/userPanelService'
import UserPanelShell from '../../components/user-panel/UserPanelShell.jsx'
import { EmptyState, formatPanelDate, PanelCard, PanelCardHeader } from '../../components/user-panel/UserPanelPrimitives.jsx'
import { PropertyThumbnailImage } from '../../components/PropertyCardMedia.jsx'

const STATUS_FILTERS = ['All', 'Active', 'Deactivated']

const PropertyAnalyticsModal = ({ property, onClose }) => {
  const { data: stats, isLoading: loading, isRefreshing } = useCachedPanelResource({
    userId: 'global',
    resourceKey: property?.id ? `property-analytics:${property.id}` : null,
    loader: () => getPropertyAnalytics(property.id),
    enabled: Boolean(property?.id),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-3xl bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-6 py-5">
          <h3 className="text-xl font-bold text-slate-900">Analytics</h3>
          <p className="mt-1 text-sm text-slate-500">
            {property.category} in {[property.location?.area, property.location?.state_district].filter(Boolean).join(', ')}
          </p>
          {isRefreshing ? <p className="mt-2 text-xs font-medium text-slate-400">Refreshing...</p> : null}
        </div>

        <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
          {loading ? (
            <p className="text-slate-500">Loading analytics...</p>
          ) : (
            <>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">View count</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.recentViewCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total views</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.recentViewCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Unlocks</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.contactUnlocks}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Credits spent</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalCreditsSpent}</p>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const MyProperties = () => {
  const { user, isLoading } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [message, setMessage] = useState('')
  const [analyticsProperty, setAnalyticsProperty] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
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
      setMessage(error.message || 'Unable to update property status.')
      return
    }

    setMessage(nextIsActive ? 'Post activated successfully.' : 'Post deactivated successfully.')
    setRefreshKey((current) => current + 1)
  }

  const handlePinToggle = async (property) => {
    const nextPinned = !property.is_pinned
    const { error } = await updatePropertyPanelState(property.id, {
      is_pinned: nextPinned,
      pinned_at: nextPinned ? new Date().toISOString() : null,
    })

    if (error) {
      setMessage(error.message || 'Unable to update pin status.')
      return
    }

    setMessage(nextPinned ? 'Post pinned successfully.' : 'Post unpinned successfully.')
    setRefreshKey((current) => current + 1)
  }

  const handleDelete = async (propertyId) => {
    const confirmed = window.confirm('Delete this property permanently?')

    if (!confirmed) {
      return
    }

    await deleteProperty(propertyId)
    setMessage('Property deleted successfully.')
    setRefreshKey((current) => current + 1)
  }

  return (
    <UserPanelShell activeKey="myproperties">
      <PanelCard>
        <PanelCardHeader
          title="Posts"
          subtitle="Search, filter, pin, and manage the properties you have submitted."
          status={isRefreshing ? 'Refreshing...' : null}
          action={
            <Link
              to="/addproperty"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#1E73B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f]"
            >
              <FiPlus />
              Submit Property
            </Link>
          }
        />

        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-col gap-4 rounded-3xl bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    statusFilter === filter
                      ? 'bg-[#1E73B8] text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts"
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Country: Bangladesh
            </span>
          </div>

          {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}

          {isLoading || propertiesLoading ? (
            <p className="text-slate-500">Loading posts...</p>
          ) : filteredProperties.length === 0 ? (
            <EmptyState
              title="No posts found"
              description="Try a different filter, or submit a new property to populate this list."
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
                      <div className="h-28 w-32 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                        <PropertyThumbnailImage
                          src={property.primary_image}
                          alt={property.category}
                          propertyType={property.property_type}
                          category={property.category}
                          pricing={property.pricing}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {property.property_id_number ? (
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#1E73B8]">
                              Property ID: {property.property_id_number}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              property.is_active === false
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {property.is_active === false ? 'Deactivated' : 'Active'}
                          </span>
                          {property.is_pinned ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              Pinned
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-3 text-lg font-semibold text-slate-900">
                          {property.category}
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
                          Created : {formatPanelDate(property.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
                      <Link
                        to={buildListDetailsHref(property.id)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#1E73B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f]"
                      >
                        <FiEye />
                        Show Post
                      </Link>
                      <Link
                        to={buildEditPropertyHref(property.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiEdit2 />
                        Edit Post
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeactivateToggle(property)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiPower />
                        {property.is_active === false ? 'Activate Post' : 'Deactivate Post'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsProperty(property)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiBarChart2 />
                        Analytics
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePinToggle(property)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiStar />
                        {property.is_pinned ? 'Unpin Post' : 'Pin Post'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(property.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <FiTrash2 />
                        Delete Post
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
    </UserPanelShell>
  )
}

export default MyProperties
