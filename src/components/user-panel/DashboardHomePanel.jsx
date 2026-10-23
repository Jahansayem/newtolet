'use client'

import React from 'react'
import { Link } from 'react-router-dom'
import {
  FiBriefcase,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiLayers,
  FiMapPin,
  FiPackage,
  FiUsers,
} from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { buildDashboardHref, buildPageHref } from '../../lib/routePaths'
import { getDashboardSummary } from '../../services/userPanelService'
import { useLanguage } from '../../i18n/useLanguage'
import { PanelCard } from './UserPanelPrimitives'

const SUMMARY_ITEMS = [
  {
    key: 'credits',
    labelKey: 'dashboard.home.summary.credits',
    hintKey: 'dashboard.home.summary.creditsHint',
    href: buildPageHref('book-buy-credits'),
    icon: FiCreditCard,
  },
  {
    key: 'propertyCount',
    labelKey: 'dashboard.home.summary.propertyCount',
    hintKey: 'dashboard.home.summary.propertyCountHint',
    href: '/my-properties',
    icon: FiMapPin,
  },
  {
    key: 'orderCount',
    labelKey: 'dashboard.home.summary.orderCount',
    hintKey: 'dashboard.home.summary.orderCountHint',
    href: '/my-orders',
    icon: FiPackage,
  },
  {
    key: 'referralCount',
    labelKey: 'dashboard.home.summary.referralCount',
    href: buildDashboardHref('referrals'),
    icon: FiUsers,
  },
  {
    key: 'jobParticipationCount',
    labelKey: 'dashboard.home.summary.jobParticipationCount',
    href: buildDashboardHref('job-history'),
    icon: FiBriefcase,
  },
  {
    key: 'totalEarn',
    labelKey: 'dashboard.home.summary.totalEarn',
    href: buildDashboardHref('earnings'),
    icon: FiDollarSign,
    currency: true,
  },
  {
    key: 'withdrawableBalance',
    labelKey: 'dashboard.home.summary.withdrawableBalance',
    href: buildDashboardHref('withdrawals'),
    icon: FiLayers,
    currency: true,
  },
  {
    key: 'walletCount',
    labelKey: 'dashboard.home.summary.walletCount',
    href: buildDashboardHref('wallets'),
    icon: FiCreditCard,
  },
  {
    key: 'totalWithdrawal',
    labelKey: 'dashboard.home.summary.totalWithdrawal',
    href: buildDashboardHref('invoice-history'),
    icon: FiFileText,
    currency: true,
  },
]

const DashboardHomePanel = () => {
  const { t } = useLanguage()
  const { user, isLoading } = useAuth()
  const { data: summary, isLoading: panelLoading, isRefreshing } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'dashboard',
    loader: () => getDashboardSummary(user.id),
    enabled: !isLoading && Boolean(user?.id),
  })

  if (isLoading || panelLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">{t('dashboard.home.loading')}</p>
      </PanelCard>
    )
  }

  if (!summary) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">{t('dashboard.home.loadError')}</p>
      </PanelCard>
    )
  }

  return (
    <div className="space-y-6">
      <PanelCard className="bg-gradient-to-br from-slate-950 via-[#16324c] to-brand p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-100">{t('dashboard.home.eyebrow')}</p>
        <h2 className="mt-3 text-3xl font-bold">{summary.user.name}</h2>
        <p className="mt-2 text-sm text-sky-100">{summary.user.phone || summary.user.email}</p>
        {isRefreshing ? <p className="mt-3 text-xs font-medium text-sky-100/80">{t('dashboard.common.refreshing')}</p> : null}
      </PanelCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SUMMARY_ITEMS.map((item) => {
          const Icon = item.icon
          const value = item.currency
            ? `৳${Number(summary[item.key] || 0).toLocaleString('en-BD')}`
            : summary[item.key] || 0

          return (
            <Link key={item.key} to={item.href}>
              <PanelCard className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{t(item.labelKey)}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
                    {item.hintKey ? <p className="mt-2 text-xs text-slate-400">{t(item.hintKey)}</p> : null}
                  </div>
                  <div className="rounded-2xl bg-sky-50 p-3 text-brand">
                    <Icon className="text-xl" />
                  </div>
                </div>
              </PanelCard>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default DashboardHomePanel
