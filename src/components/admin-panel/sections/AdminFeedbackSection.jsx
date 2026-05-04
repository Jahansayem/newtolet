'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { MdCancel, MdCheckCircle, MdDelete } from 'react-icons/md'
import {
  approveFeedback,
  deleteFeedback,
  getAllFeedback,
  rejectFeedback,
  updateFeedbackStatus,
} from '../../../services/adminService'

const AdminFeedbackSection = ({ searchQuery = '' }) => {
  const [loading, setLoading] = useState(true)
  const [feedbacks, setFeedbacks] = useState([])
  const [message, setMessage] = useState({ type: '', text: '' })

  const showMessage = (type, text) => {
    setMessage({ type, text })
    window.setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const fetchFeedback = async () => {
    setLoading(true)
    const { data, error } = await getAllFeedback()

    if (error) {
      const localFeedback = JSON.parse(localStorage.getItem('userFeedback') || '[]')
      setFeedbacks(
        localFeedback.map((feedback, index) => ({
          id: index + 1,
          name: feedback.name,
          email: feedback.email,
          feedback: feedback.feedback,
          created_at: feedback.timestamp,
          is_resolved: false,
          status: 'pending',
        }))
      )
    } else {
      setFeedbacks(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    void fetchFeedback()
  }, [])

  const filteredFeedback = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return feedbacks
    }

    return feedbacks.filter((feedback) =>
      [feedback?.name, feedback?.email, feedback?.feedback]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    )
  }, [feedbacks, searchQuery])

  const handleDeleteFeedback = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return
    }

    const { error } = await deleteFeedback(feedbackId)
    if (error) {
      showMessage('error', 'Failed to delete feedback')
      return
    }

    showMessage('success', 'Feedback deleted successfully')
    await fetchFeedback()
  }

  const handleToggleFeedbackStatus = async (feedbackId, currentStatus) => {
    const { error } = await updateFeedbackStatus(feedbackId, !currentStatus)
    if (error) {
      showMessage('error', 'Failed to update feedback status')
      return
    }

    showMessage('success', 'Feedback status updated successfully')
    await fetchFeedback()
  }

  const handleApproveFeedback = async (feedbackId) => {
    const userId = JSON.parse(localStorage.getItem('user'))?.id
    const { error } = await approveFeedback(feedbackId, userId)
    if (error) {
      showMessage('error', 'Failed to approve feedback')
      return
    }

    showMessage('success', 'Feedback approved and will show on homepage')
    await fetchFeedback()
  }

  const handleRejectFeedback = async (feedbackId) => {
    const userId = JSON.parse(localStorage.getItem('user'))?.id
    const { error } = await rejectFeedback(feedbackId, userId)
    if (error) {
      showMessage('error', 'Failed to reject feedback')
      return
    }

    showMessage('success', 'Feedback rejected and hidden from homepage')
    await fetchFeedback()
  }

  return (
    <div className="space-y-6">
      {message.text ? (
        <div
          className={`rounded-[24px] border px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Loading feedback...
        </div>
      ) : filteredFeedback.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          No feedback found for the current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredFeedback.map((feedback) => (
            <div key={feedback.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{feedback.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{feedback.email}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(feedback.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      feedback.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : feedback.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {feedback.status === 'approved'
                      ? 'Approved'
                      : feedback.status === 'rejected'
                        ? 'Rejected'
                        : 'Pending'}
                  </span>
                  {feedback.is_resolved ? (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      Resolved
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-700">{feedback.feedback}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {feedback.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApproveFeedback(feedback.id)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-100"
                    >
                      <MdCheckCircle />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectFeedback(feedback.id)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      <MdCancel />
                      Reject
                    </button>
                  </>
                ) : null}
                {feedback.status === 'approved' ? (
                  <button
                    type="button"
                    onClick={() => handleRejectFeedback(feedback.id)}
                    className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Reject & Hide
                  </button>
                ) : null}
                {feedback.status === 'rejected' ? (
                  <button
                    type="button"
                    onClick={() => handleApproveFeedback(feedback.id)}
                    className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-100"
                  >
                    Approve & Show
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleToggleFeedbackStatus(feedback.id, feedback.is_resolved)}
                  className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  {feedback.is_resolved ? 'Unresolve' : 'Mark Resolved'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFeedback(feedback.id)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <MdDelete />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminFeedbackSection
