'use client'

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiMapPin, FiPlus } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { getUserOrders } from '../../services/orderService'
import { createOrderPaymentCheckout } from '../../services/paymentService'
import { isOrderAwaitingPayment } from '../../lib/orderPricing'
import { formatOrderNeedFrom, formatOrderPreferencesSummary } from '../../utils/orderPreferences'
import { useLanguage } from '../../i18n/useLanguage'
import { EmptyState, PanelCard, PanelCardHeader, formatPanelDate } from './UserPanelPrimitives'

const OrdersHistoryPanel = () => {
  const { t, tv, language } = useLanguage()
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
  const [payingOrderId, setPayingOrderId] = useState(null)
  const [payError, setPayError] = useState(null)

  const handlePayNow = async (orderId) => {
    setPayingOrderId(orderId)
    setPayError(null)

    const { data: checkout, error } = await createOrderPaymentCheckout(orderId)

    if (error || !checkout?.payment_url) {
      setPayingOrderId(null)
      setPayError(orderId)
      return
    }

    // Leave the button disabled while the browser goes to the gateway.
    window.location.assign(checkout.payment_url)
  }

  if (isLoading || ordersLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">{t('dashboard.orders.loading')}</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard>
      <PanelCardHeader
        title={t('dashboard.orders.title')}
        subtitle={t('dashboard.orders.subtitle')}
        status={isRefreshing ? t('dashboard.common.refreshing') : null}
        action={
          <Link
            to="/orderhome"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
          >
            <FiPlus />
            {t('dashboard.orders.createOrder')}
          </Link>
        }
      />

      <div className="px-6 py-6">
        {orders.length === 0 ? (
          <EmptyState
            title={t('dashboard.orders.emptyTitle')}
            description={t('dashboard.orders.emptyDescription')}
            action={
              <Link
                to="/orderhome"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
              >
                <FiPlus />
                {t('dashboard.orders.createOrder')}
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
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-brand">
                        {tv('categories', order.category)}
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
                        {tv('status', order.status || 'pending_payment')}
                      </span>
                    </div>

                    <p className="mt-3 text-lg font-semibold text-slate-900">
                      {t('dashboard.orders.roomsFor', {
                        rooms: order.rooms,
                        category: tv('categories', order.category),
                      })}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <FiMapPin className="shrink-0" />
                      <span>{[order.area, order.district, order.division].filter(Boolean).join(', ')}</span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                      {order.max_budget ? (
                        <span>
                          {t('dashboard.orders.budget', {
                            amount: Number(order.max_budget).toLocaleString('en-BD'),
                          })}
                        </span>
                      ) : null}
                      {order.property_need_from ? (
                        <span>
                          {t('dashboard.orders.from', {
                            date: formatOrderNeedFrom(order.property_need_from),
                          })}
                        </span>
                      ) : null}
                      <span>
                        {t('dashboard.orders.created', {
                          date: formatPanelDate(order.created_at, true, language),
                        })}
                      </span>
                    </div>

                    {order.additional_preferences ? (
                      <p className="mt-3 text-sm text-slate-500">
                        {formatOrderPreferencesSummary(order.additional_preferences)}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('dashboard.orders.package')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {order.package === '7_days' ? t('dashboard.orders.sevenDaysPackage') : order.package}
                    </p>
                    <p className="mt-2 text-xl font-bold text-slate-900">
                      ৳{Number(order.cost || 0).toLocaleString('en-BD')}
                    </p>
                    {isOrderAwaitingPayment(order) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePayNow(order.id)}
                          disabled={payingOrderId !== null}
                          className="mt-3 inline-flex w-full justify-center rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {payingOrderId === order.id
                            ? t('dashboard.orders.paying')
                            : t('dashboard.orders.payNow')}
                        </button>
                        {payError === order.id ? (
                          <p className="mt-2 max-w-[14rem] text-left text-xs text-red-600" role="alert">
                            {t('dashboard.orders.payFailed')}
                          </p>
                        ) : null}
                      </>
                    ) : null}
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
