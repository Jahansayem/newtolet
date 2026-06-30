'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RxCross2 } from 'react-icons/rx'
import { MdDelete, MdEdit } from 'react-icons/md'
import {
  deleteOrder,
  getAllOrders,
  updateOrderJobFeed,
  updateOrderStatus,
} from '../../../services/adminService'
import {
  formatOrderNeedFrom,
  formatOrderPreferencesSummary,
} from '../../../utils/orderPreferences'

const formatOrderJobFeedLocation = (order) =>
  [order?.sub_area, order?.area, order?.district, order?.division]
    .filter(Boolean)
    .join(', ')

const buildOrderJobFeedFallbackTitle = (order) => {
  const category = order?.category || 'Home'
  const location = formatOrderJobFeedLocation(order)
  return location ? `${category} needed in ${location}` : `${category} requirement posted`
}

const buildOrderJobFeedFallbackDescription = (order) => {
  const summary = formatOrderPreferencesSummary(order?.additional_preferences)

  if (summary) {
    return summary
  }

  const parts = []
  if (order?.rooms) {
    parts.push(`${order.rooms} room requirement`)
  }
  if (order?.max_budget) {
    parts.push(`Budget up to BDT ${Number(order.max_budget).toLocaleString()}`)
  }
  if (order?.property_need_from) {
    parts.push(`Need from ${formatOrderNeedFrom(order.property_need_from)}`)
  }

  return parts.join(' | ') || 'No public description added yet.'
}

const canOrderBePostedToJobFeed = (order) => order?.status === 'confirmed'

const AdminOrdersSection = ({ searchQuery = '' }) => {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showJobFeedModal, setShowJobFeedModal] = useState(false)
  const [editingJobFeedOrder, setEditingJobFeedOrder] = useState(null)
  const [jobFeedDraft, setJobFeedDraft] = useState({
    title: '',
    description: '',
    isPosted: false,
  })
  const [jobFeedSaving, setJobFeedSaving] = useState(false)
  const isMountedRef = useRef(true)
  const messageTimerRef = useRef(null)

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text })
    if (messageTimerRef.current) {
      window.clearTimeout(messageTimerRef.current)
    }
    messageTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) {
        setMessage({ type: '', text: '' })
      }
    }, 3000)
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data, error } = await getAllOrders()

    if (!isMountedRef.current) {
      return
    }

    if (error) {
      showMessage('error', 'Failed to load orders')
      setOrders([])
    } else {
      setOrders(data || [])
    }

    setLoading(false)
  }, [showMessage])

  useEffect(() => {
    isMountedRef.current = true
    void fetchOrders()

    return () => {
      isMountedRef.current = false
      if (messageTimerRef.current) {
        window.clearTimeout(messageTimerRef.current)
      }
    }
  }, [fetchOrders])

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return orders
    }

    return orders.filter((order) =>
      [
        order?.name,
        order?.phone,
        order?.email,
        order?.category,
        order?.area,
        order?.district,
        order?.division,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    )
  }, [orders, searchQuery])

  const handleOrderStatusChange = async (orderId, status) => {
    const { error } = await updateOrderStatus(orderId, status)

    if (error) {
      showMessage('error', 'Failed to update order status')
      return
    }

    showMessage('success', 'Order status updated successfully')
    await fetchOrders()
  }

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order?')) {
      return
    }

    const { error } = await deleteOrder(orderId)
    if (error) {
      showMessage('error', 'Failed to delete order')
      return
    }

    showMessage('success', 'Order deleted successfully')
    await fetchOrders()
  }

  const handleOpenJobFeedModal = (order) => {
    setEditingJobFeedOrder(order)
    setJobFeedDraft({
      title: order.job_feed_title || '',
      description: order.job_feed_description || '',
      isPosted: Boolean(order.is_job_feed_posted),
    })
    setShowJobFeedModal(true)
  }

  const handleCloseJobFeedModal = () => {
    setShowJobFeedModal(false)
    setEditingJobFeedOrder(null)
    setJobFeedDraft({
      title: '',
      description: '',
      isPosted: false,
    })
  }

  const handleSaveOrderJobFeed = async (shouldPost = jobFeedDraft.isPosted) => {
    if (!editingJobFeedOrder) {
      return
    }

    if (shouldPost && !canOrderBePostedToJobFeed(editingJobFeedOrder)) {
      showMessage('error', 'Only confirmed orders can be posted to the homepage job feed')
      return
    }

    setJobFeedSaving(true)

    const nextPostedAt = shouldPost
      ? editingJobFeedOrder.job_feed_posted_at || new Date().toISOString()
      : null

    const { error } = await updateOrderJobFeed(editingJobFeedOrder.id, {
      job_feed_title: jobFeedDraft.title.trim() || null,
      job_feed_description: jobFeedDraft.description.trim() || null,
      is_job_feed_posted: shouldPost,
      job_feed_posted_at: nextPostedAt,
      updated_at: new Date().toISOString(),
    })

    if (isMountedRef.current) {
      setJobFeedSaving(false)
    }

    if (error) {
      showMessage('error', 'Failed to update homepage job feed')
      return
    }

    showMessage('success', shouldPost ? 'Homepage job updated successfully' : 'Job removed from homepage successfully')
    handleCloseJobFeedModal()
    await fetchOrders()
  }

  const handleToggleOrderJobFeed = async (order) => {
    if (!order.is_job_feed_posted && !canOrderBePostedToJobFeed(order)) {
      showMessage('error', 'Only confirmed orders can be posted to the homepage job feed')
      return
    }

    const nextPosted = !order.is_job_feed_posted
    const { error } = await updateOrderJobFeed(order.id, {
      is_job_feed_posted: nextPosted,
      job_feed_posted_at: nextPosted ? order.job_feed_posted_at || new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      showMessage('error', 'Failed to update homepage posting status')
      return
    }

    showMessage('success', nextPosted ? 'Job posted to homepage' : 'Job removed from homepage')
    await fetchOrders()
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
          Loading orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          No orders found for the current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredOrders.map((order) => (
            <div key={order.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{order.category || 'Order'}</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {order.status || 'pending'}
                    </span>
                    {order.is_job_feed_posted ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Posted to homepage
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {[order.area, order.district, order.division].filter(Boolean).join(', ') || 'Location not provided'}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {order.name || 'Unknown'} {order.phone ? `· ${order.phone}` : ''}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {buildOrderJobFeedFallbackDescription(order)}
                  </p>
                </div>

                <div className="w-full max-w-[14rem] space-y-2">
                  <select
                    value={order.status || 'pending'}
                    onChange={(event) => handleOrderStatusChange(order.id, event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#465fff]"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleToggleOrderJobFeed(order)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {order.is_job_feed_posted ? 'Unpost from homepage' : 'Quick post toggle'}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenJobFeedModal(order)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#465fff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3646d6]"
                >
                  <MdEdit />
                  Edit homepage job feed
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteOrder(order.id)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <MdDelete />
                  Delete order
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showJobFeedModal && editingJobFeedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">Edit Homepage Job Feed</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Control how this order appears in the public homepage job feed.
                </p>
              </div>
              <button type="button" onClick={handleCloseJobFeedModal} className="text-2xl text-slate-400 transition hover:text-slate-600">
                <RxCross2 />
              </button>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Source Order</p>
                <p className="mt-2 text-sm font-medium text-slate-800">{buildOrderJobFeedFallbackTitle(editingJobFeedOrder)}</p>
                <p className="mt-1 text-sm text-slate-600">{buildOrderJobFeedFallbackDescription(editingJobFeedOrder)}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Public Job Title</label>
                <input
                  type="text"
                  value={jobFeedDraft.title}
                  onChange={(event) => setJobFeedDraft({ ...jobFeedDraft, title: event.target.value })}
                  placeholder={buildOrderJobFeedFallbackTitle(editingJobFeedOrder)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#465fff]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Public Job Description</label>
                <textarea
                  rows="5"
                  value={jobFeedDraft.description}
                  onChange={(event) => setJobFeedDraft({ ...jobFeedDraft, description: event.target.value })}
                  placeholder={buildOrderJobFeedFallbackDescription(editingJobFeedOrder)}
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#465fff]"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={jobFeedDraft.isPosted}
                  onChange={(event) => setJobFeedDraft({ ...jobFeedDraft, isPosted: event.target.checked })}
                  disabled={!canOrderBePostedToJobFeed(editingJobFeedOrder) && !editingJobFeedOrder.is_job_feed_posted}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Post this job to homepage</p>
                  <p className="mt-1 text-xs text-slate-500">Posted jobs appear publicly above recently published properties.</p>
                </div>
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveOrderJobFeed(jobFeedDraft.isPosted)}
                  disabled={jobFeedSaving}
                  className="rounded-2xl bg-[#465fff] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3646d6] disabled:opacity-60"
                >
                  {jobFeedSaving ? 'Saving...' : 'Save Changes'}
                </button>
                {editingJobFeedOrder.is_job_feed_posted ? (
                  <button
                    type="button"
                    onClick={() => handleSaveOrderJobFeed(false)}
                    disabled={jobFeedSaving}
                    className="rounded-2xl bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    Unpost from homepage
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleCloseJobFeedModal}
                  disabled={jobFeedSaving}
                  className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default AdminOrdersSection
