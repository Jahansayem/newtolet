'use client'

import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { buildListDetailsHref } from '../../lib/routePaths'
import { getJobHistory } from '../../services/userPanelService'
import { EmptyState, formatPanelDate, PanelCard, PanelCardHeader } from './UserPanelPrimitives'

const JobHistoryPanel = () => {
  const { user, isLoading } = useAuth()
  const {
    data: items = [],
    isLoading: historyLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'job-history',
    loader: () => getJobHistory(user.id),
    enabled: !isLoading && Boolean(user?.id),
  })

  if (isLoading || historyLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">Loading job history...</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard>
      <PanelCardHeader
        title="Job History"
        subtitle="Submitted job responses and their current review status."
        status={isRefreshing ? 'Refreshing...' : null}
      />

      <div className="px-6 py-6">
        {items.length === 0 ? (
          <EmptyState
            title="No job history yet"
            description="Once you submit details from the job feed, they will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 font-semibold">Job</th>
                  <th className="pb-3 font-semibold">Specific address</th>
                  <th className="pb-3 font-semibold">Contact details</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Submit Time</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="py-4 text-slate-800">
                      <p className="font-semibold">ID : {item.order?.id?.slice?.(0, 8) || item.order_id}</p>
                      <p className="text-xs text-slate-500">{item.order?.category || 'Job'}</p>
                    </td>
                    <td className="py-4 text-slate-600">{item.specific_address}</td>
                    <td className="py-4 text-slate-600">{item.contact_details}</td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.status || 'pending'}
                      </span>
                    </td>
                    <td className="py-4 text-slate-500">{formatPanelDate(item.created_at)}</td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        {item.property?.id ? (
                          <Link
                            to={buildListDetailsHref(item.property.id)}
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            View Property
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          View Job
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PanelCard>
  )
}

export default JobHistoryPanel
