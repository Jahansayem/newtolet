import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { getWithdrawalsPanelData } from '../../services/userPanelService'
import { createWithdrawalRequest } from '../../services/referralService'

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

const WithdrawalsPanel = () => {
  const { user, isLoading } = useAuth()
  const [settings, setSettings] = useState(null)
  const [wallets, setWallets] = useState([])
  const [requests, setRequests] = useState([])
  const [withdrawableBalance, setWithdrawableBalance] = useState(0)
  const [amount, setAmount] = useState('')
  const [walletId, setWalletId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const {
    data: panelData,
    isLoading: panelLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'withdrawals-panel',
    loader: () => getWithdrawalsPanelData(user.id),
    enabled: !isLoading && Boolean(user?.id),
  })

  useEffect(() => {
    setSettings(panelData?.settings || null)
    setWallets(panelData?.wallets || [])
    setRequests(panelData?.withdrawals || [])
    setWithdrawableBalance(Number(panelData?.withdrawableBalance || 0))

    const nextWallets = panelData?.wallets || []
    const defaultWallet = nextWallets.find((wallet) => wallet.is_default) || nextWallets[0]
    setWalletId((current) => current || defaultWallet?.id || '')
  }, [panelData])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setNotice('')
    setError('')

    const { error: requestError } = await createWithdrawalRequest(user?.id, walletId, amount)
    setSubmitting(false)

    if (requestError) {
      setError(requestError.message || 'Unable to create withdrawal request.')
      return
    }

    setAmount('')
    setNotice('Withdrawal request submitted successfully.')
    const refreshed = await getWithdrawalsPanelData(user.id)
    setSettings(refreshed?.settings || null)
    setWallets(refreshed?.wallets || [])
    setRequests(refreshed?.withdrawals || [])
    setWithdrawableBalance(Number(refreshed?.withdrawableBalance || 0))
  }

  if (isLoading || panelLoading) {
    return (
      <div className="rounded-xl bg-white p-8 shadow">
        <p className="text-gray-500">Loading withdrawal history...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">Withdraw Balance</h2>
          {isRefreshing ? <p className="mt-2 text-xs font-medium text-gray-400">Refreshing...</p> : null}
          <p className="mt-2 text-sm text-gray-600">
            Request a payout to one of your saved wallets. Minimum withdrawal amount is{' '}
            {formatCurrency(settings?.min_withdrawal_amount || 0)}.
          </p>

          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-gray-500">Withdrawable balance</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {formatCurrency(withdrawableBalance)}
            </p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Wallet</label>
              <select
                value={walletId}
                onChange={(event) => setWalletId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
              >
                <option value="">Select a wallet</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.banking_type} · {wallet.bank_name} · {wallet.account_number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Amount (BDT)</label>
              <input
                type="number"
                min={settings?.min_withdrawal_amount || 0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
                placeholder="100"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {notice ? <p className="text-sm text-green-600">{notice}</p> : null}

            <button
              type="submit"
              disabled={submitting || !wallets.length}
              className="rounded-lg bg-[#1E73B8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1665a0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Request Withdrawal'}
            </button>

            {!wallets.length ? (
              <p className="text-sm text-amber-600">
                Add a wallet first from the Wallets tab before requesting a withdrawal.
              </p>
            ) : null}
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Withdrawal Policy</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
            <li>Only approved referral earnings are withdrawable.</li>
            <li>Requested amounts are reserved immediately until admin review is complete.</li>
            <li>Withdrawal requests move through requested, approved, and paid statuses.</li>
            <li>Rejected requests return to your available balance automatically.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Withdrawal History</h3>

        {requests.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-lg font-semibold text-gray-900">No withdrawals made yet</p>
            <p className="mt-2 text-sm text-gray-600">
              Your requests will appear here once you submit one.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-3 font-medium">Requested At</th>
                  <th className="pb-3 font-medium">Wallet</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Completed At</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b border-gray-100">
                    <td className="py-4 text-gray-600">{formatDate(request.requested_at)}</td>
                    <td className="py-4">
                      <p className="font-medium text-gray-900">
                        {request.wallet?.banking_type || 'Wallet'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {request.wallet?.account_number || 'No account number'}
                      </p>
                    </td>
                    <td className="py-4 font-semibold text-gray-900">
                      {formatCurrency(request.amount)}
                    </td>
                    <td className="py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          request.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : request.status === 'approved'
                              ? 'bg-blue-100 text-blue-700'
                              : request.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="py-4 text-gray-600">{formatDate(request.completed_at)}</td>
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

export default WithdrawalsPanel
