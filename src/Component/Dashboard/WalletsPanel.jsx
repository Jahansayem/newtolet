import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowDownLeft, FiArrowUpRight, FiClock, FiEdit2, FiPlus, FiStar, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { buildPageHref } from '../../lib/routePaths'
import { getWalletPanelData } from '../../services/userPanelService'
import {
  deleteWallet,
  saveWallet,
  setDefaultWallet,
} from '../../services/referralService'
import { useLanguage } from '../../i18n/useLanguage'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const EMPTY_FORM = {
  id: null,
  banking_type: 'bKash',
  bank_name: '',
  account_number: '',
  account_name: '',
  is_default: false,
}

const PAYMENT_STATUS_STYLES = {
  awaiting_admin_approval: 'bg-yellow-100 text-yellow-800',
  credited: 'bg-green-100 text-green-800',
  pending: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
  refunded: 'bg-purple-100 text-purple-800',
}

const CREDIT_TRANSACTION_LABELS = {
  credit_purchase: 'Credits Added',
  referral_bonus: 'Referral Bonus',
  property_listing: 'Property Listing',
  contact_view: 'Contact Unlock',
  contact_view_refund: 'Contact Unlock Refund',
  photo_view: 'Photo Unlock',
}

const normalizeCreditHistoryEntry = (record) => {
  const rawChange =
    record?.transaction_type === 'credit_purchase'
      ? Number(record?.credits_amount ?? Math.abs(Number(record?.credits_deducted ?? 0)))
      : Number(record?.credits_deducted ?? 0) * -1

  return {
    id: `credit-${record.id}`,
    source: 'credit',
    created_at: record?.created_at || null,
    transaction_id: record?.payment_transaction_id || record?.id,
    invoice_id: record?.metadata?.invoice_id || null,
    status: rawChange >= 0 ? 'credited' : 'completed',
    amount: 0,
    credits_change: rawChange,
    payment_method: null,
    title:
      CREDIT_TRANSACTION_LABELS[record?.transaction_type] ||
      String(record?.transaction_type || 'Credit Activity')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    description: record?.reference_type ? `Reference: ${record.reference_type}` : null,
    balance_after: Number(record?.balance_after ?? 0),
  }
}

const normalizePaymentHistoryEntry = (record) => ({
  id: `payment-${record.id}`,
  source: 'payment',
  created_at: record?.created_at || null,
  transaction_id: record?.transaction_id || record?.id,
  invoice_id: record?.invoice_id || null,
  status: record?.status || 'pending',
  amount: Number(record?.amount ?? 0),
  credits_change: Number(record?.credits_to_add ?? 0),
  payment_method: record?.payment_method || null,
  title: record?.description || 'Credit Purchase',
  description: null,
  balance_after: null,
})

const getHistoryType = (entry) => {
  if (entry.source === 'payment') {
    if (entry.status === 'credited') return 'added'
    if (entry.status === 'awaiting_admin_approval' || entry.status === 'pending') return 'pending'
    return 'failed'
  }

  return entry.credits_change >= 0 ? 'added' : 'spent'
}

const getStatusLabel = (entry, tv) => {
  if (entry.source === 'payment') {
    const raw = String(entry.status || 'pending')
    const translated = tv('status', raw)
    return translated === raw ? raw.replace(/_/g, ' ') : translated
  }

  return tv('status', entry.credits_change >= 0 ? 'completed' : 'spent')
}

const WalletsPanel = () => {
  const { t, tv, fdt } = useLanguage()
  const { user, isLoading } = useAuth()

  const formatDate = (value) =>
    fdt(value, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) || t('common.na')
  const [wallets, setWallets] = useState([])
  const [creditBalance, setCreditBalance] = useState(0)
  const [creditHistory, setCreditHistory] = useState([])
  const [paymentHistory, setPaymentHistory] = useState([])
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const hasDefaultWallet = useMemo(
    () => wallets.some((wallet) => wallet.is_default),
    [wallets]
  )

  const historyEntries = useMemo(() => {
    const paymentTransactionIds = new Set(
      paymentHistory
        .filter((payment) => payment.status === 'credited')
        .map((payment) => payment.transaction_id)
        .filter(Boolean)
    )

    const normalizedCreditEntries = creditHistory
      .filter((entry) => !paymentTransactionIds.has(entry.payment_transaction_id))
      .map(normalizeCreditHistoryEntry)

    const normalizedPaymentEntries = paymentHistory.map(normalizePaymentHistoryEntry)

    return [...normalizedPaymentEntries, ...normalizedCreditEntries].sort((left, right) => {
      const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
      const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
      return rightTime - leftTime
    })
  }, [creditHistory, paymentHistory])

  const {
    data: panelData,
    isLoading: panelLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'wallet-panel',
    loader: () => getWalletPanelData(user.id),
    enabled: !isLoading && Boolean(user?.id),
  })

  const hydrateFromPanelData = useCallback((nextData) => {
    setWallets(nextData?.wallets || [])
    setCreditBalance(Number(nextData?.creditBalance || 0))
    setCreditHistory(nextData?.creditHistory || [])
    setPaymentHistory(nextData?.paymentHistory || [])
  }, [])

  useEffect(() => {
    hydrateFromPanelData(panelData)
  }, [hydrateFromPanelData, panelData])

  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
      is_default: !hasDefaultWallet,
    })
  }

  useEffect(() => {
    if (!hasDefaultWallet && !formData.id) {
      setFormData((current) => ({ ...current, is_default: true }))
    }
  }, [hasDefaultWallet, formData.id])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    setError('')

    const { error: saveError } = await saveWallet(user?.id, formData)
    setSaving(false)

    if (saveError) {
      setError(saveError.message || t('dashboard.wallets.saveError'))
      return
    }

    setNotice(formData.id ? t('dashboard.wallets.updated') : t('dashboard.wallets.added'))
    resetForm()
    hydrateFromPanelData(await getWalletPanelData(user.id))
  }

  const handleEdit = (wallet) => {
    setFormData({
      id: wallet.id,
      banking_type: wallet.banking_type,
      bank_name: wallet.bank_name,
      account_number: wallet.account_number,
      account_name: wallet.account_name,
      is_default: wallet.is_default,
    })
    setNotice('')
    setError('')
  }

  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = (walletId) => {
    setPendingDeleteId(walletId)
  }

  const confirmDelete = async () => {
    const walletId = pendingDeleteId
    if (!walletId) {
      return
    }
    setDeleting(true)
    try {
      await performDelete(walletId)
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const performDelete = async (walletId) => {
    const { error: deleteError } = await deleteWallet(user?.id, walletId)
    if (deleteError) {
      setError(deleteError.message || t('dashboard.wallets.deleteError'))
      return
    }

    setNotice(t('dashboard.wallets.removed'))
    if (formData.id === walletId) {
      resetForm()
    }
    hydrateFromPanelData(await getWalletPanelData(user.id))
  }

  const handleSetDefault = async (walletId) => {
    const { error: defaultError } = await setDefaultWallet(user?.id, walletId)
    if (defaultError) {
      setError(defaultError.message || t('dashboard.wallets.defaultError'))
      return
    }

    setNotice(t('dashboard.wallets.defaultUpdated'))
    hydrateFromPanelData(await getWalletPanelData(user.id))
  }

  if (isLoading || panelLoading) {
    return (
      <div className="rounded-xl bg-white p-8 shadow">
        <p className="text-gray-500">{t('dashboard.wallets.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.wallets.creditTitle')}</h2>
            {isRefreshing ? <p className="mt-2 text-xs font-medium text-gray-400">{t('dashboard.common.refreshing')}</p> : null}
            <p className="mt-2 text-sm text-gray-600">
              {t('dashboard.wallets.creditDescription')}
            </p>
            <Link
              to={buildPageHref('book-buy-credits')}
              className="mt-4 inline-flex items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
            >
              {t('dashboard.wallets.addPoints')}
            </Link>
          </div>
          <div className="rounded-xl bg-blue-50 px-5 py-4 text-right">
            <p className="text-sm text-gray-600">{t('dashboard.wallets.currentBalance')}</p>
            <p className="mt-1 text-3xl font-bold text-brand">{creditBalance}</p>
            <p className="text-xs text-gray-500">{t('dashboard.wallets.creditsUnit')}</p>
          </div>
        </div>

        {historyEntries.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-lg font-semibold text-gray-900">{t('dashboard.wallets.historyEmptyTitle')}</p>
            <p className="mt-2 text-sm text-gray-600">
              {t('dashboard.wallets.historyEmptyDescription')}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 font-medium">{t('common.date')}</th>
                  <th className="pb-3 font-medium">{t('dashboard.wallets.columns.credits')}</th>
                  <th className="pb-3 font-medium">{t('common.amount')}</th>
                  <th className="pb-3 font-medium">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {historyEntries.map((entry) => {
                  const entryType = getHistoryType(entry)
                  const isPositive = entry.credits_change >= 0
                  const statusStyle =
                    PAYMENT_STATUS_STYLES[entry.status] ||
                    (entryType === 'spent'
                      ? 'bg-red-100 text-red-700'
                      : entryType === 'added'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700')

                  return (
                    <tr key={entry.id} className="border-b border-gray-100">
                      <td className="py-4 text-gray-600">{formatDate(entry.created_at)}</td>
                      <td className="py-4">
                        <span
                          className={`inline-flex font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}
                        >
                          {isPositive ? '+' : ''}
                          {entry.credits_change}
                        </span>
                      </td>
                      <td className="py-4 text-gray-900">
                        {entry.amount > 0
                          ? t('dashboard.wallets.amountTk', { amount: Number(entry.amount).toFixed(2) })
                          : t('common.na')}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle}`}>
                          {entryType === 'pending' ? <FiClock size={12} /> : null}
                          {getStatusLabel(entry, tv)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.wallets.payoutTitle')}</h2>
              <p className="mt-2 text-sm text-gray-600">
                {t('dashboard.wallets.payoutDescription')}
              </p>
            </div>
          </div>

          {wallets.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-lg font-semibold text-gray-900">{t('dashboard.wallets.payoutEmptyTitle')}</p>
              <p className="mt-2 text-sm text-gray-600">
                {t('dashboard.wallets.payoutEmptyDescription')}
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {wallet.banking_type} · {wallet.bank_name}
                        </p>
                        {wallet.is_default ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                            {t('dashboard.wallets.default')}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{wallet.account_name}</p>
                      <p className="text-sm text-gray-500">{wallet.account_number}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!wallet.is_default ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(wallet.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          <FiStar />
                          {t('dashboard.wallets.makeDefault')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleEdit(wallet)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        <FiEdit2 />
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(wallet.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <FiTrash2 />
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <FiPlus className="text-brand" />
            <h3 className="text-lg font-semibold text-gray-900">
              {formData.id ? t('dashboard.wallets.editWalletTitle') : t('dashboard.wallets.addWalletTitle')}
            </h3>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="wallet-banking-type" className="ui-label">{t('dashboard.wallets.bankingType')}</label>
              <select
                id="wallet-banking-type"
                value={formData.banking_type}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, banking_type: event.target.value }))
                }
                className="ui-field"
              >
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Rocket">Rocket</option>
                <option value="Bank">{t('dashboard.wallets.bankOption')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="wallet-name" className="ui-label">{t('dashboard.wallets.walletName')}</label>
              <input
                id="wallet-name"
                type="text"
                value={formData.bank_name}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, bank_name: event.target.value }))
                }
                className="ui-field"
                placeholder={t('dashboard.wallets.walletNamePlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="wallet-account-number" className="ui-label">{t('dashboard.wallets.accountNumber')}</label>
              <input
                id="wallet-account-number"
                type="text"
                inputMode="numeric"
                value={formData.account_number}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, account_number: event.target.value }))
                }
                className="ui-field"
                placeholder={t('dashboard.wallets.accountNumberPlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="wallet-account-name" className="ui-label">{t('dashboard.wallets.accountName')}</label>
              <input
                id="wallet-account-name"
                type="text"
                value={formData.account_name}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, account_name: event.target.value }))
                }
                className="ui-field"
                placeholder={t('dashboard.wallets.accountNamePlaceholder')}
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-body text-ink">
              <input
                className="h-4 w-4 accent-brand"
                type="checkbox"
                checked={formData.is_default}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, is_default: event.target.checked }))
                }
              />
              {t('dashboard.wallets.setDefault')}
            </label>

            {error ? <p role="alert" className="ui-error">{error}</p> : null}
            {notice ? <p role="status" className="text-caption font-medium text-success">{notice}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="ui-btn ui-btn-primary ui-btn-sm"
              >
                {saving
                  ? t('dashboard.common.saving')
                  : formData.id
                    ? t('dashboard.wallets.updateWallet')
                    : t('dashboard.wallets.addWallet')}
              </button>
              {formData.id ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="ui-btn ui-btn-secondary ui-btn-sm"
                >
                  {t('dashboard.wallets.cancelEdit')}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        title={t('common.delete')}
        description={t('dashboard.wallets.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        closeLabel={t('common.close')}
        busy={deleting}
      />
    </div>
  )
}

export default WalletsPanel
