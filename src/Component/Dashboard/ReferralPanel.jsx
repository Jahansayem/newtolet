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
import { useLanguage } from '../../i18n/useLanguage'

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const SummaryCard = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
      <div className="rounded-full bg-blue-50 p-3 text-brand">
        <Icon className="text-xl" />
      </div>
    </div>
  </div>
)

const ReferralPanel = () => {
  const { t, tv, fd } = useLanguage()
  const { user, isLoading, updateUserInContext } = useAuth()

  const formatDate = (value) =>
    fd(value, { year: 'numeric', month: 'short', day: 'numeric' }) || t('common.na')
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
      setFormError(error.message || t('dashboard.referrals.createError'))
      return
    }

    updateUserInContext?.({
      referral_username: data?.referral_username || validation.normalized,
      referral_code: data?.referral_code || summary?.profile?.referral_code || '',
    })
    setUsernameInput('')
    setNotice(t('dashboard.referrals.created'))
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
        <p className="text-gray-500">{t('dashboard.referrals.loading')}</p>
      </div>
    )
  }

  if (!user?.id) {
    return (
      <div className="rounded-xl bg-white p-8 shadow">
        <p className="text-gray-600">{t('dashboard.referrals.loginRequired')}</p>
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
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
              {t('dashboard.referrals.eyebrow')}
            </p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">{t('dashboard.referrals.title')}</h2>
            {isRefreshing ? <p className="mt-2 text-xs font-medium text-gray-400">{t('dashboard.common.refreshing')}</p> : null}
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {t('dashboard.referrals.description', {
                commission: settings.referral_commission_value ?? '',
                bonus: settings.referral_bonus_percent ?? '',
                minAmount: formatCurrency(settings.min_withdrawal_amount),
              })}
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-white/90 p-4 text-sm text-gray-600 shadow-sm">
            <p className="font-semibold text-gray-900">{t('dashboard.referrals.statusTitle')}</p>
            <p className="mt-2">
              {hasReferralUsername
                ? t('dashboard.referrals.usernameLine', { username: profile.referral_username })
                : t('dashboard.referrals.createPrompt')}
            </p>
            {profile?.referral_code ? (
              <p className="mt-1 text-xs text-gray-500">
                {t('dashboard.referrals.legacyCode', { code: profile.referral_code })}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={FiUsers}
          label={t('dashboard.referrals.totalReferrals')}
          value={totals.totalReferrals}
          hint={t('dashboard.referrals.totalReferralsHint')}
        />
        <SummaryCard
          icon={FiGift}
          label={t('dashboard.referrals.totalEarned')}
          value={formatCurrency(totals.totalEarned)}
          hint={t('dashboard.referrals.totalEarnedHint')}
        />
        <SummaryCard
          icon={FiLink}
          label={t('dashboard.referrals.withdrawable')}
          value={formatCurrency(totals.withdrawableBalance)}
          hint={t('dashboard.referrals.withdrawableHint')}
        />
        <SummaryCard
          icon={FiGift}
          label={t('dashboard.referrals.pendingWithdrawal')}
          value={formatCurrency(totals.pendingWithdrawalAmount)}
          hint={t('dashboard.referrals.pendingWithdrawalHint')}
        />
      </div>

      {!hasReferralUsername ? (
        <div className="rounded-xl border border-dashed border-blue-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.referrals.createTitle')}</h3>
          <p className="mt-2 text-sm text-gray-600">
            {t('dashboard.referrals.createDescription')}
          </p>

          <form className="mt-5 max-w-xl space-y-3" onSubmit={handleCreateUsername}>
            <label htmlFor="referral-username" className="ui-label">{t('dashboard.referrals.usernamePlaceholder')}</label>
            <input
              id="referral-username"
              type="text"
              value={usernameInput}
              onChange={(event) => setUsernameInput(event.target.value)}
              placeholder={t('dashboard.referrals.usernamePlaceholder')}
              className="ui-field"
              disabled={creating}
            />
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            {notice ? <p className="text-sm text-green-600">{notice}</p> : null}
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? t('dashboard.referrals.creating') : t('dashboard.referrals.createButton')}
            </button>
          </form>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.referrals.shareTitle')}</h3>
            <p className="mt-2 text-sm text-gray-600">
              {t('dashboard.referrals.shareDescription')}
            </p>

            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">{t('dashboard.referrals.linkLabel')}</p>
              <p className="mt-2 break-all text-sm font-medium text-gray-800">{referralLink}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleCopy(referralLink, t('dashboard.referrals.linkCopied'))}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
              >
                <FiCopy />
                {t('dashboard.referrals.copyLink')}
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCopy(`@${profile.referral_username}`, t('dashboard.referrals.usernameCopied'))
                }
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <FiUsers />
                {t('dashboard.referrals.copyUsername')}
              </button>
              {notice ? <span className="self-center text-sm text-green-600">{notice}</span> : null}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.referrals.nextStepTitle')}</h3>
            <p className="mt-2 text-sm text-gray-600">
              {t('dashboard.referrals.nextStepDescription')}
            </p>
            <div className="mt-5 space-y-3">
              <Link
                to={buildPageHref('book-buy-credits')}
                className="ui-btn ui-btn-primary w-full"
              >
                {t('dashboard.referrals.buyCredits')}
              </Link>
              <Link
                to={buildPageHref('dashboard', { tab: 'withdrawals' })}
                className="block rounded-lg border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                {t('dashboard.referrals.requestWithdrawal')}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.referrals.listTitle')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('dashboard.referrals.listSubtitle')}
            </p>
          </div>
        </div>

        {referrals.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <h4 className="text-xl font-semibold text-gray-900">{t('dashboard.referrals.emptyTitle')}</h4>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              {t('dashboard.referrals.emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 font-medium">{t('dashboard.referrals.columns.referDate')}</th>
                  <th className="pb-3 font-medium">{t('dashboard.referrals.columns.name')}</th>
                  <th className="pb-3 font-medium">{t('dashboard.referrals.columns.contact')}</th>
                  <th className="pb-3 font-medium">{t('common.status')}</th>
                  <th className="pb-3 font-medium text-right">{t('dashboard.referrals.columns.commission')}</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id} className="border-b border-gray-100 align-top">
                    <td className="py-4 text-gray-600">{formatDate(referral.created_at)}</td>
                    <td className="py-4">
                      <p className="font-medium text-gray-900">{referral.name || t('dashboard.common.unknownUser')}</p>
                      {referral.latestPurchaseAt ? (
                        <p className="text-xs text-gray-500">
                          {t('dashboard.referrals.lastPurchase', { date: formatDate(referral.latestPurchaseAt) })}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-4 text-gray-600">{referral.phone || referral.email || t('common.na')}</td>
                    <td className="py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          referral.status === 'Converted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {tv('status', referral.status)}
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
