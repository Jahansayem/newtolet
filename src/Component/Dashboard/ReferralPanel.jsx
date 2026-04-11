import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiCopy, FiGift, FiLink, FiUsers } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import {
  buildReferralLink,
  claimReferralUsername,
  getReferralSummary,
  validateReferralUsername,
} from '../../services/referralService'
import { buildPageHref } from '../../lib/routePaths'

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

  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const SummaryCard = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
      <div className="rounded-full bg-blue-50 p-3 text-[#1E73B8]">
        <Icon className="text-xl" />
      </div>
    </div>
  </div>
)

const ReferralPanel = () => {
  const { user, isLoading, updateUserInContext } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  const {
    data: summary,
    isLoading: summaryLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'referral-summary-full',
    loader: () => getReferralSummary(user.id),
    enabled: !isLoading && Boolean(user?.id),
    refreshKey,
  })

  const referralLink = useMemo(
    () => buildReferralLink(summary?.profile?.referral_username),
    [summary?.profile?.referral_username]
  )

  const handleCreateUsername = async (event) => {
    event.preventDefault()
    setFormError('')
    setNotice('')

    const validation = validateReferralUsername(usernameInput)
    if (!validation.valid) {
      setFormError(validation.error)
      return
    }

    setCreating(true)
    const { data, error } = await claimReferralUsername(validation.normalized)
    setCreating(false)

    if (error) {
      setFormError(error.message || 'Unable to create referral username.')
      return
    }

    updateUserInContext?.({
      referral_username: data?.referral_username || validation.normalized,
      referral_code: data?.referral_code || summary?.profile?.referral_code || '',
    })
    setUsernameInput('')
    setNotice('Referral username created successfully.')
    setRefreshKey((current) => current + 1)
  }

  const handleCopy = async (value, successMessage) => {
    if (!value) {
      return
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      }
      setNotice(successMessage)
    } catch (error) {
      console.error('Copy failed:', error)
      setNotice(value)
    }
  }

  if (isLoading || summaryLoading) {
    return (
      <div className="rounded-xl bg-white p-8 shadow">
        <p className="text-gray-500">Loading referral dashboard...</p>
      </div>
    )
  }

  if (!user?.id) {
    return (
      <div className="rounded-xl bg-white p-8 shadow">
        <p className="text-gray-600">Please log in to view your referral dashboard.</p>
      </div>
    )
  }

  const profile = summary?.profile
  const referrals = summary?.referrals || []
  const totals = summary?.totals || {
    totalReferrals: 0,
    totalEarned: 0,
    pendingWithdrawalAmount: 0,
    withdrawableBalance: 0,
  }
  const settings = summary?.settings || {}
  const hasReferralUsername = Boolean(profile?.referral_username)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1E73B8]">
              Refer & Earn
            </p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">My Referrals</h2>
            {isRefreshing ? <p className="mt-2 text-xs font-medium text-gray-400">Refreshing...</p> : null}
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Earn {settings.referral_commission_value}% cash commission when referred users buy
              credits. Referred users receive {settings.referral_bonus_percent}% extra credits on
              paid purchases, and you can request withdrawals once your balance reaches{' '}
              {formatCurrency(settings.min_withdrawal_amount)}.
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-white/90 p-4 text-sm text-gray-600 shadow-sm">
            <p className="font-semibold text-gray-900">Referral status</p>
            <p className="mt-2">
              {hasReferralUsername
                ? `Referral username: @${profile.referral_username}`
                : 'Create your referral username to start sharing.'}
            </p>
            {profile?.referral_code ? (
              <p className="mt-1 text-xs text-gray-500">Legacy code: {profile.referral_code}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={FiUsers}
          label="Total Referrals"
          value={totals.totalReferrals}
          hint="Users linked to your referral account"
        />
        <SummaryCard
          icon={FiGift}
          label="Total Earned"
          value={formatCurrency(totals.totalEarned)}
          hint="All referral commissions"
        />
        <SummaryCard
          icon={FiLink}
          label="Withdrawable"
          value={formatCurrency(totals.withdrawableBalance)}
          hint="Available for withdrawal"
        />
        <SummaryCard
          icon={FiGift}
          label="Pending Withdrawal"
          value={formatCurrency(totals.pendingWithdrawalAmount)}
          hint="Requested or approved payouts"
        />
      </div>

      {!hasReferralUsername ? (
        <div className="rounded-xl border border-dashed border-blue-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Create Referral Username</h3>
          <p className="mt-2 text-sm text-gray-600">
            This username becomes your permanent referral identity. Choose it carefully because it
            cannot be changed later.
          </p>

          <form className="mt-5 max-w-xl space-y-3" onSubmit={handleCreateUsername}>
            <input
              type="text"
              value={usernameInput}
              onChange={(event) => setUsernameInput(event.target.value)}
              placeholder="e.g. jahan_refers"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#1E73B8]"
              disabled={creating}
            />
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            {notice ? <p className="text-sm text-green-600">{notice}</p> : null}
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-[#1E73B8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1665a0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Creating...' : 'Create Referral Username'}
            </button>
          </form>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Share your referral link</h3>
            <p className="mt-2 text-sm text-gray-600">
              Send this link to new users. Once they sign up and buy credits, your commission will
              appear automatically.
            </p>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Referral link</p>
              <p className="mt-2 break-all text-sm font-medium text-gray-800">{referralLink}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleCopy(referralLink, 'Referral link copied.')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1E73B8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1665a0]"
              >
                <FiCopy />
                Copy Link
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCopy(`@${profile.referral_username}`, 'Referral username copied.')
                }
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <FiUsers />
                Copy Username
              </button>
              {notice ? <span className="self-center text-sm text-green-600">{notice}</span> : null}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Next step</h3>
            <p className="mt-2 text-sm text-gray-600">
              Referral income is generated when the referred user completes a paid credit purchase.
            </p>
            <div className="mt-5 space-y-3">
              <Link
                to={buildPageHref('book-buy-credits')}
                className="block rounded-lg bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Buy Credits
              </Link>
              <Link
                to={buildPageHref('dashboard', { tab: 'withdrawals' })}
                className="block rounded-lg border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Request Withdrawal
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Referral List</h3>
            <p className="mt-1 text-sm text-gray-500">
              Users who registered through your referral link or username.
            </p>
          </div>
        </div>

        {referrals.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <h4 className="text-xl font-semibold text-gray-900">No Referral Earnings Yet</h4>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Share your referral link to start earning cash commission. Once referred users buy
              credits, their purchases will appear here and your balance will update automatically.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 font-medium">Refer Date</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Contact</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Commission</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id} className="border-b border-gray-100 align-top">
                    <td className="py-4 text-gray-600">{formatDate(referral.created_at)}</td>
                    <td className="py-4">
                      <p className="font-medium text-gray-900">{referral.name || 'Unknown User'}</p>
                      {referral.latestPurchaseAt ? (
                        <p className="text-xs text-gray-500">
                          Last purchase: {formatDate(referral.latestPurchaseAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-4 text-gray-600">{referral.phone || referral.email || 'N/A'}</td>
                    <td className="py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          referral.status === 'Converted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {referral.status}
                      </span>
                    </td>
                    <td className="py-4 text-right font-semibold text-gray-900">
                      {formatCurrency(referral.totalCommission)}
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

export default ReferralPanel
