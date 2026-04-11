import React from 'react'
import { FiDollarSign, FiShoppingCart, FiZap } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { getEarningsPanelData } from '../../services/userPanelService'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const formatDate = (value) => {
  if (!value) {
    return 'N/A'
  }

  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const StatCard = ({ title, value, hint, icon: Icon }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      </div>
      <div className="rounded-full bg-green-50 p-3 text-green-600">
        <Icon className="text-xl" />
      </div>
    </div>
  </div>
)

const EarningsPanel = () => {
  const { user, isLoading } = useAuth()
  const {
    data: panelData,
    isLoading: panelLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'earnings-panel',
    loader: () => getEarningsPanelData(user.id),
    enabled: !isLoading && Boolean(user?.id),
  })
  const earnings = panelData?.summary?.earnings || []
  const settings = panelData?.settings || panelData?.summary?.settings || null
  const withdrawableBalance = Number(panelData?.summary?.totals?.withdrawableBalance || 0)

  const totalCommission = earnings
    .filter((earning) => earning.status !== 'reversed')
    .reduce((sum, earning) => sum + earning.commission_amount, 0)

  const totalBonusCredits = earnings.reduce(
    (sum, earning) => sum + earning.bonus_credits_awarded,
    0
  )

  if (isLoading || panelLoading) {
    return (
      <div className="rounded-xl bg-white p-8 shadow">
        <p className="text-gray-500">Loading earnings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900">Referral Earnings</h2>
        {isRefreshing ? <p className="mt-2 text-xs font-medium text-gray-400">Refreshing...</p> : null}
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Every successful referred credit purchase adds a commission to your wallet. The referred
          user also receives {settings?.referral_bonus_percent || 0}% extra credits on each paid
          purchase.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Total Commission"
          value={formatCurrency(totalCommission)}
          hint="All completed referral earnings"
          icon={FiDollarSign}
        />
        <StatCard
          title="Withdrawable Balance"
          value={formatCurrency(withdrawableBalance)}
          hint="Available after subtracting withdrawal requests"
          icon={FiShoppingCart}
        />
        <StatCard
          title="Bonus Credits Triggered"
          value={totalBonusCredits}
          hint="Extra credits granted to referred buyers"
          icon={FiZap}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Commission History</h3>
            <p className="mt-1 text-sm text-gray-500">
              Each row represents one referred paid credit purchase.
            </p>
          </div>
        </div>

        {earnings.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-lg font-semibold text-gray-900">No referral earnings yet</p>
            <p className="mt-2 text-sm text-gray-600">
              Once referred users buy credits, the commission and bonus details will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Buyer</th>
                  <th className="pb-3 font-medium">Purchase</th>
                  <th className="pb-3 font-medium">Commission</th>
                  <th className="pb-3 font-medium">Bonus Credits</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((earning) => (
                  <tr key={earning.id} className="border-b border-gray-100 align-top">
                    <td className="py-4 text-gray-600">{formatDate(earning.created_at)}</td>
                    <td className="py-4">
                      <p className="font-medium text-gray-900">
                        {earning.referred_user?.name || 'Unknown User'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {earning.referred_user?.phone || earning.referred_user?.email || 'N/A'}
                      </p>
                    </td>
                    <td className="py-4 text-gray-600">
                      {formatCurrency(earning.purchase_amount_bdt)}
                    </td>
                    <td className="py-4 font-semibold text-gray-900">
                      {formatCurrency(earning.commission_amount)}
                    </td>
                    <td className="py-4 text-gray-600">{earning.bonus_credits_awarded}</td>
                    <td className="py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          earning.status === 'available'
                            ? 'bg-green-100 text-green-700'
                            : earning.status === 'withdrawn'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {earning.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default EarningsPanel
