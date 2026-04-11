'use client'

import React from 'react'
import { Link } from 'react-router-dom'
import { FiMapPin, FiPlus } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { getUserOrders } from '../../services/orderService'
import { formatOrderNeedFrom, formatOrderPreferencesSummary } from '../../utils/orderPreferences'
import { EmptyState, PanelCard, PanelCardHeader, formatPanelDate } from './UserPanelPrimitives'

const OrdersHistoryPanel = () => {
  const { user, isLoading } = useAuth()
  const {
    data: orders = [],
    isLoading: ordersLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'orders',
    loader: async () => {
      const result = await getUserOrders(user.id)
      return result?.data || []
    },
    enabled: !isLoading && Boolean(user?.id),
  })

  if (isLoading || ordersLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">Loading orders...</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard>
      <PanelCardHeader
        title="Orders"
        subtitle="Your property search requests and their current progress."
        status={isRefreshing ? 'Refreshing...' : null}
        action={
          <Link
            to="/orderhome"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#1E73B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f]"
          >
            <FiPlus />
            Create Order
          </Link>
        }
      />

      <div className="px-6 py-6">
        {orders.length === 0 ? (
          <EmptyState
            title="You Don't Place Any Order Yet"
            description="Your order history will appear here. Place a new order and the team can start searching based on your requirements."
            action={
              <Link
                to="/orderhome"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1E73B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f]"
              >
                <FiPlus />
                Create Order
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-3xl border border-slate-200 p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#1E73B8]">
                        {order.category}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          order.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : order.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {order.status || 'pending_payment'}
                      </span>
                    </div>

                    <p className="mt-3 text-lg font-semibold text-slate-900">
                      {order.rooms} Room For {order.category}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <FiMapPin className="shrink-0" />
                      <span>{[order.area, order.district, order.division].filter(Boolean).join(', ')}</span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                      {order.max_budget ? (
                        <span>Budget: ৳{Number(order.max_budget).toLocaleString('en-BD')}</span>
                      ) : null}
                      {order.property_need_from ? (
                        <span>From: {formatOrderNeedFrom(order.property_need_from)}</span>
                      ) : null}
                      <span>Created: {formatPanelDate(order.created_at)}</span>
                    </div>

                    {order.additional_preferences ? (
                      <p className="mt-3 text-sm text-slate-500">
                        {formatOrderPreferencesSummary(order.additional_preferences)}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Package</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {order.package === '7_days' ? '7 Days Package' : order.package}
                    </p>
                    <p className="mt-2 text-xl font-bold text-slate-900">
                      ৳{Number(order.cost || 0).toLocaleString('en-BD')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelCard>
  )
}

export default OrdersHistoryPanel
