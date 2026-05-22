'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MdDelete } from 'react-icons/md'
import {
  deleteInquiry,
  getAllPropertyInquiries,
  updateInquiryStatus,
} from '../../../services/adminService'

const AdminInquiriesSection = ({ searchQuery = '' }) => {
  const [loading, setLoading] = useState(true)
  const [inquiries, setInquiries] = useState([])
  const [message, setMessage] = useState({ type: '', text: '' })
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

  const fetchInquiries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await getAllPropertyInquiries()

    if (!isMountedRef.current) {
      return
    }

    if (error) {
      showMessage('error', 'Failed to load inquiries')
      setInquiries([])
    } else {
      setInquiries(data || [])
    }
    setLoading(false)
  }, [showMessage])

  useEffect(() => {
    isMountedRef.current = true
    void fetchInquiries()

    return () => {
      isMountedRef.current = false
      if (messageTimerRef.current) {
        window.clearTimeout(messageTimerRef.current)
      }
    }
  }, [fetchInquiries])

  const filteredInquiries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return inquiries
    }

    return inquiries.filter((inquiry) =>
      [
        inquiry?.name,
        inquiry?.email,
        inquiry?.phone,
        inquiry?.message,
        inquiry?.properties?.category,
        inquiry?.properties?.area,
        inquiry?.properties?.state_district,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    )
  }, [inquiries, searchQuery])

  const handleInquiryStatusChange = async (inquiryId, status) => {
    const { error } = await updateInquiryStatus(inquiryId, status)

    if (error) {
      showMessage('error', 'Failed to update inquiry status')
      return
    }

    showMessage('success', 'Inquiry status updated successfully')
    await fetchInquiries()
  }

  const handleDeleteInquiry = async (inquiryId) => {
    if (!window.confirm('Are you sure you want to delete this inquiry?')) {
      return
    }

    const { error } = await deleteInquiry(inquiryId)
    if (error) {
      showMessage('error', 'Failed to delete inquiry')
      return
    }

    showMessage('success', 'Inquiry deleted successfully')
    await fetchInquiries()
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
          Loading inquiries...
        </div>
      ) : filteredInquiries.length === 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          No inquiries found for the current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredInquiries.map((inquiry) => (
            <div key={inquiry.id} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{inquiry.name}</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {inquiry.status || 'pending'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{inquiry.email}</p>
                  <p className="mt-1 text-sm text-slate-600">{inquiry.phone}</p>
                  {inquiry.properties ? (
                    <p className="mt-3 text-sm text-slate-500">
                      {inquiry.properties.category} in {inquiry.properties.area}, {inquiry.properties.state_district}
                    </p>
                  ) : null}
                  <p className="mt-3 text-sm text-slate-700">{inquiry.message}</p>
                </div>
                <div className="w-full max-w-[12rem] space-y-2">
                  <select
                    value={inquiry.status || 'pending'}
                    onChange={(event) => handleInquiryStatusChange(inquiry.id, event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#465fff]"
                  >
                    <option value="pending">Pending</option>
                    <option value="contacted">Contacted</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleDeleteInquiry(inquiry.id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <MdDelete />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminInquiriesSection
