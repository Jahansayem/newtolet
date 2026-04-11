'use client';

import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiClock, FiCreditCard, FiRefreshCw, FiXCircle } from 'react-icons/fi';
import {
  getAdminWithdrawalRequests,
  getReferralAdminOverview,
  getReferralSettings,
  saveReferralSettings,
  updateWithdrawalRequestStatus,
} from '../../services/referralService';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const ReferralManagement = () => {
  const [settings, setSettings] = useState(null);
  const [overview, setOverview] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = async () => {
    setLoading(true);
    const [nextSettings, nextOverview, nextWithdrawals] = await Promise.all([
      getReferralSettings(),
      getReferralAdminOverview(),
      getAdminWithdrawalRequests(),
    ]);
    setSettings(nextSettings);
    setOverview(nextOverview);
    setWithdrawals(nextWithdrawals);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    const { error } = await saveReferralSettings(settings);

    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to save referral settings.' });
      return;
    }

    setMessage({ type: 'success', text: 'Referral settings saved successfully.' });
    await loadData();
  };

  const handleStatusUpdate = async (requestId, status) => {
    const { error } = await updateWithdrawalRequestStatus(requestId, status);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to update withdrawal status.' });
      return;
    }

    setMessage({ type: 'success', text: `Withdrawal marked as ${status}.` });
    await loadData();
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-8 shadow">
        <p className="text-gray-500">Loading referral management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Referral Management</h2>
          <p className="mt-1 text-sm text-gray-600">
            Configure referral rewards and review withdrawal requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <FiRefreshCw />
          Refresh
        </button>
      </div>

      {message.text ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Commissions</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatCurrency(overview?.totalCommissions)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Available Commissions</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatCurrency(overview?.availableCommissions)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Requested Withdrawals</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatCurrency(overview?.requestedWithdrawals)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Paid Withdrawals</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatCurrency(overview?.paidWithdrawals)}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <form className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" onSubmit={handleSave}>
          <h3 className="text-lg font-semibold text-gray-900">Referral Settings</h3>
          <div className="mt-5 space-y-4">
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(settings?.referral_enabled)}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    referral_enabled: event.target.checked,
                  }))
                }
              />
              Enable referral rewards
            </label>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Commission Type</label>
              <select
                value={settings?.referral_commission_type || 'percentage'}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    referral_commission_type: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Commission Value
              </label>
              <input
                type="number"
                value={settings?.referral_commission_value || 0}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    referral_commission_value: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Bonus Percent</label>
              <input
                type="number"
                value={settings?.referral_bonus_percent || 0}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    referral_bonus_percent: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Bonus Frequency
              </label>
              <select
                value={settings?.referral_bonus_frequency || 'every_purchase'}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    referral_bonus_frequency: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
              >
                <option value="every_purchase">Every Purchase</option>
                <option value="first_purchase">First Purchase Only</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Minimum Withdrawal Amount
              </label>
              <input
                type="number"
                value={settings?.min_withdrawal_amount || 0}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    min_withdrawal_amount: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-lg bg-[#1E73B8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1665a0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Referral Settings'}
          </button>
        </form>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Withdrawal Review Queue</h3>

          {withdrawals.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-lg font-semibold text-gray-900">No withdrawal requests yet</p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {withdrawals.map((request) => (
                <div key={request.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {request.user?.name || 'Unknown User'}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
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
                      </div>
                      <p className="mt-2 text-sm text-gray-600">
                        {request.user?.phone || request.user?.email || 'No contact'}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {request.wallet?.banking_type || 'Wallet'} ·{' '}
                        {request.wallet?.account_number || 'No account number'}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Requested: {new Date(request.requested_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(request.amount)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {request.status === 'requested' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(request.id, 'approved')}
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                            >
                              <FiClock />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(request.id, 'rejected')}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                            >
                              <FiXCircle />
                              Reject
                            </button>
                          </>
                        ) : null}
                        {request.status === 'approved' ? (
                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(request.id, 'paid')}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                          >
                            <FiCheckCircle />
                            Mark Paid
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate(request.id, request.status)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          <FiCreditCard />
                          Refresh Status
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralManagement;
