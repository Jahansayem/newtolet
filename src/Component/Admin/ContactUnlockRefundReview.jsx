'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiRefreshCw } from 'react-icons/fi'
import { buildListDetailsHref } from '../../lib/routePaths'
import {
  getAdminContactUnlockRefundRequests,
  reviewContactUnlockRefundRequest,
} from '../../services/adminService'

const STATUS_STYLES = {
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
}

const REASON_LABELS = {
  rented_out: 'Already rented out',
  unreachable: 'Phone unreachable',
  wrong_location: 'Wrong location',
  other: 'Other',
}

const formatDate = (value) => {
  if (!value) {
    return 'N/A'
  }

  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ContactUnlockRefundReview = () => {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [adminNotes, setAdminNotes] = useState({})

  const loadRequests = useCallback(async () => {
    setLoading(true)
    const data = await getAdminContactUnlockRefundRequests()
    setRequests(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const pendingCount = useMemo(
    () => requests.filter((entry) => entry.status === 'requested').length,
    [requests]
  )

  const handleReview = async (requestId, status) => {
    setBusyId(requestId)
    setFeedback({ type: '', text: '' })

    const { error } = await reviewContactUnlockRefundRequest(
      requestId,
      status,
      adminNotes[requestId] || ''
    )

    setBusyId(null)

    if (error) {
      setFeedback({ type: 'error', text: error.message || 'Unable to update refund request.' })
      return
    }

    setFeedback({
      type: 'success',
      text:
        status === 'approved'
          ? 'Refund approved and credits restored.'
          : 'Refund request rejected.',
    })
    await loadRequests()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Total Requests</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{requests.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-sm text-slate-500">Pending Review</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{pendingCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Actions</p>
              <p className="mt-2 text-sm text-slate-700">Refresh the unlock refund queue.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadRequests()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <FiRefreshCw />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {feedback.text ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Unlock Refund Requests</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review requests, open the property, and decide whether credits should be restored.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading refund requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-500">No refund requests found.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[request.status] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {String(request.status || 'requested').replace(/_/g, ' ')}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {REASON_LABELS[request.reason_code] || request.reason_code}
                      </span>
                    </div>

                    <p className="text-lg font-semibold text-slate-900">
                      {request.property?.category || 'Property'}
                    </p>
                    <p className="text-sm text-slate-500">
                      Property ID: {request.property?.property_id_number || request.property_id}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[request.property?.area, request.property?.state_district].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sm text-slate-500">
                      User: {request.user?.name || 'Unknown'} {request.user?.email ? ` - ${request.user.email}` : ''}
                    </p>
                    <p className="text-sm text-slate-500">
                      Phone: {request.user?.phone || 'N/A'}
                    </p>
                    <p className="text-sm text-slate-500">
                      Unlocked: {formatDate(request.contact_view?.viewed_at)}
                    </p>
                    <p className="text-sm text-slate-500">
                      Credits spent: {Number(request.contact_view?.credits_spent || 0)}
                    </p>
                    <p className="text-sm text-slate-500">
                      Requested: {formatDate(request.requested_at)}
                    </p>
                    {request.details ? (
                      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {request.details}
                      </p>
                    ) : null}
                    {request.admin_note ? (
                      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        Admin note: {request.admin_note}
                      </p>
                    ) : null}
                  </div>

                  <div className="w-full max-w-md space-y-3">
                    <Link
                      to={buildListDetailsHref(request.property?.id || request.property_id)}
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-[#1E73B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f]"
                    >
                      Open Property
                    </Link>

                    <textarea
                      value={adminNotes[request.id] || ''}
                      onChange={(event) =>
                        setAdminNotes((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Admin note"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
                    />

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleReview(request.id, 'approved')}
                        disabled={busyId === request.id || request.status !== 'requested'}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve & Restore Credits
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReview(request.id, 'rejected')}
                        disabled={busyId === request.id || request.status !== 'requested'}
                        className="inline-flex flex-1 items-center justify-center rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
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
  )
}

export default ContactUnlockRefundReview
