'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BiImage,
  BiPackage,
  BiUser,
} from 'react-icons/bi'
import { GiHouse } from 'react-icons/gi'
import {
  MdAdd,
  MdDashboard,
  MdFeedback,
  MdSettings,
} from 'react-icons/md'
import {
  getDashboardStats,
  getDailyListingReport,
  getDailySubmitterWiseListingReport,
} from '../../../services/adminService'
import { getCoverPhotos } from '../../../services/coverPhotoService'

const REPORT_FILTER_PRESETS = {
  last7: 'last7',
  month: 'month',
  custom: 'custom',
}

const EMPTY_SUBMITTER_LISTING_REPORT = {
  days: 7,
  submitters: [],
  dailyRows: [],
  todayCountsBySubmitterId: {},
  todayTotal: 0,
  totalsBySubmitterId: {},
  grandTotal: 0,
}

const DAY_IN_MS = 86400000
const MAX_LISTING_REPORT_DAYS = 90

const formatInputDateValue = (value) => {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const createLast7Range = () => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 6)

  return {
    startDate: formatInputDateValue(startDate),
    endDate: formatInputDateValue(endDate),
  }
}

const createCurrentMonthRange = () => {
  const endDate = new Date()
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

  return {
    startDate: formatInputDateValue(startDate),
    endDate: formatInputDateValue(endDate),
  }
}

const parseReportInputDate = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const getInclusiveReportDays = (startDate, endDate) => {
  const start = parseReportInputDate(startDate)
  const end = parseReportInputDate(endDate)

  if (!start || !end || start.getTime() > end.getTime()) {
    return 0
  }

  return Math.floor((end.getTime() - start.getTime()) / DAY_IN_MS) + 1
}

const buildReportFilterRange = (filter) => {
  if (filter?.preset === REPORT_FILTER_PRESETS.month) {
    return createCurrentMonthRange()
  }

  if (filter?.preset === REPORT_FILTER_PRESETS.custom) {
    return {
      startDate: filter.startDate || '',
      endDate: filter.endDate || '',
    }
  }

  return createLast7Range()
}

const formatRangeDateLabel = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const buildReportRangeLabel = (filter, startDate, endDate) => {
  if (filter?.preset === REPORT_FILTER_PRESETS.month) {
    return 'This Month'
  }

  if (filter?.preset === REPORT_FILTER_PRESETS.custom) {
    const startLabel = formatRangeDateLabel(startDate)
    const endLabel = formatRangeDateLabel(endDate)

    if (!startLabel || !endLabel) {
      return 'Custom Range'
    }

    return `${startLabel} - ${endLabel}`
  }

  return 'Last 7 Days'
}

const MetricCard = ({ label, value, meta, icon: Icon, tone }) => (
  <div className={`rounded-[28px] border p-6 shadow-sm ${tone}`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white/80">{label}</p>
        <p className="mt-3 text-4xl font-bold tracking-tight text-white">{value}</p>
        <p className="mt-2 text-xs font-medium text-white/70">{meta}</p>
      </div>
      <div className="rounded-2xl bg-white/15 p-3 text-3xl text-white">
        <Icon />
      </div>
    </div>
  </div>
)

const AdminDashboardSection = ({ onQuickAction }) => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalProperties: 0,
    pendingProperties: 0,
    totalOrders: 0,
    totalFeedback: 0,
  })
  const [coverPhotoCount, setCoverPhotoCount] = useState(0)
  const [todaysListingCount, setTodaysListingCount] = useState(0)
  const [listingReport, setListingReport] = useState({
    days: 7,
    dailyCounts: [],
    totalNewListings: 0,
    todaysNewListings: 0,
  })
  const [submitterListingReport, setSubmitterListingReport] = useState(EMPTY_SUBMITTER_LISTING_REPORT)
  const [reportFilter, setReportFilter] = useState(() => ({
    preset: REPORT_FILTER_PRESETS.last7,
    ...createLast7Range(),
  }))
  const [reportErrorMessage, setReportErrorMessage] = useState('')
  const isMountedRef = useRef(true)

  const activeReportRange = useMemo(() => buildReportFilterRange(reportFilter), [reportFilter])
  const reportRangeLabel = useMemo(
    () =>
      buildReportRangeLabel(
        reportFilter,
        listingReport.startDate || activeReportRange.startDate,
        listingReport.endDate || activeReportRange.endDate
      ),
    [activeReportRange.endDate, activeReportRange.startDate, listingReport.endDate, listingReport.startDate, reportFilter]
  )
  const reportRangeDescription = useMemo(() => {
    const startLabel = formatRangeDateLabel(listingReport.startDate || activeReportRange.startDate)
    const endLabel = formatRangeDateLabel(listingReport.endDate || activeReportRange.endDate)

    if (!startLabel || !endLabel) {
      return 'New property listings for the selected range'
    }

    return `New property listings created from ${startLabel} to ${endLabel}`
  }, [activeReportRange.endDate, activeReportRange.startDate, listingReport.endDate, listingReport.startDate])

  const dashboardSubmitters = useMemo(() => {
    return [...(submitterListingReport.submitters || [])].sort((left, right) => {
      const rightTodayCount = submitterListingReport.todayCountsBySubmitterId?.[right.id] || 0
      const leftTodayCount = submitterListingReport.todayCountsBySubmitterId?.[left.id] || 0

      if (rightTodayCount !== leftTodayCount) {
        return rightTodayCount - leftTodayCount
      }

      return (left.name || '').localeCompare(right.name || '')
    })
  }, [submitterListingReport])

  const submittersWithListingsToday = dashboardSubmitters.filter(
    (submitter) => (submitterListingReport.todayCountsBySubmitterId?.[submitter.id] || 0) > 0
  )

  const loadDashboardStats = useCallback(async (rangeOverride = buildReportFilterRange(reportFilter)) => {
    setLoading(true)

    const [
      { data, error },
      { data: todayReportData, error: todayReportError },
      { data: reportData, error: reportError },
      { data: submitterReportData, error: submitterReportError },
      coverPhotosResult,
    ] = await Promise.all([
      getDashboardStats(),
      getDailyListingReport(1),
      getDailyListingReport(rangeOverride),
      getDailySubmitterWiseListingReport(rangeOverride),
      getCoverPhotos(),
    ])

    if (!isMountedRef.current) {
      return
    }

    if (!error && data) {
      setStats(data)
    }

    if (!todayReportError && todayReportData) {
      setTodaysListingCount(todayReportData.todaysNewListings || 0)
    }

    if (!reportError && reportData) {
      setListingReport(reportData)
    }

    if (!submitterReportError && submitterReportData) {
      setSubmitterListingReport(submitterReportData)
    }

    if (!coverPhotosResult.error) {
      setCoverPhotoCount((coverPhotosResult.data || []).length)
    }

    const reportErrors = [todayReportError, reportError, submitterReportError].filter(Boolean)
    setReportErrorMessage(
      reportErrors.length > 0
        ? 'Listing report could not be loaded. Check admin access and try again.'
        : ''
    )
    setLoading(false)
  }, [reportFilter])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (reportFilter.preset !== REPORT_FILTER_PRESETS.custom) {
      void loadDashboardStats(buildReportFilterRange(reportFilter))
    }
  }, [loadDashboardStats, reportFilter])

  const handleReportPresetChange = (preset) => {
    if (preset === REPORT_FILTER_PRESETS.month) {
      setReportFilter({
        preset,
        ...createCurrentMonthRange(),
      })
      return
    }

    if (preset === REPORT_FILTER_PRESETS.custom) {
      setReportFilter((current) => ({
        preset,
        startDate: current.startDate || createCurrentMonthRange().startDate,
        endDate: current.endDate || formatInputDateValue(new Date()),
      }))
      return
    }

    setReportFilter({
      preset: REPORT_FILTER_PRESETS.last7,
      ...createLast7Range(),
    })
  }

  const handleApplyCustomReportRange = () => {
    const nextRange = buildReportFilterRange({
      ...reportFilter,
      preset: REPORT_FILTER_PRESETS.custom,
    })

    if (!nextRange.startDate || !nextRange.endDate) {
      setReportErrorMessage('Select both start and end dates to view a custom report range.')
      return
    }

    if (nextRange.startDate > nextRange.endDate) {
      setReportErrorMessage('Start date cannot be after end date.')
      return
    }

    if (getInclusiveReportDays(nextRange.startDate, nextRange.endDate) > MAX_LISTING_REPORT_DAYS) {
      setReportErrorMessage(`Listing reports can be filtered up to ${MAX_LISTING_REPORT_DAYS} days.`)
      return
    }

    void loadDashboardStats(nextRange)
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Loading dashboard...
        </div>
      ) : null}

      <div className={loading ? 'hidden' : 'space-y-6'}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
          <MetricCard
            label="Total Admin Users"
            value={stats.totalUsers}
            meta={`${stats.activeUsers} active`}
            icon={BiUser}
            tone="border-blue-200 bg-gradient-to-br from-[#465fff] to-[#6d7cff]"
          />
          <MetricCard
            label="Total Properties"
            value={stats.totalProperties}
            meta={`${stats.pendingProperties} pending`}
            icon={GiHouse}
            tone="border-emerald-200 bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
          <MetricCard
            label="Total Orders"
            value={stats.totalOrders}
            meta="All time"
            icon={BiPackage}
            tone="border-violet-200 bg-gradient-to-br from-violet-500 to-violet-600"
          />
          <MetricCard
            label={reportRangeLabel}
            value={listingReport.totalNewListings}
            meta="New listings in range"
            icon={MdDashboard}
            tone="border-cyan-200 bg-gradient-to-br from-cyan-500 to-sky-600"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Report Filters</h2>
                  <p className="text-sm text-slate-500">
                    Choose a preset or apply a custom date range up to 90 days.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.values(REPORT_FILTER_PRESETS).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleReportPresetChange(preset)}
                      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                        reportFilter.preset === preset
                          ? 'bg-[#465fff] text-white'
                          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset === REPORT_FILTER_PRESETS.last7
                        ? 'Last 7 Days'
                        : preset === REPORT_FILTER_PRESETS.month
                          ? 'This Month'
                          : 'Custom Range'}
                    </button>
                  ))}
                </div>
              </div>

              {reportFilter.preset === REPORT_FILTER_PRESETS.custom ? (
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">From</label>
                    <input
                      type="date"
                      value={reportFilter.startDate}
                      max={reportFilter.endDate || undefined}
                      onChange={(event) =>
                        setReportFilter((current) => ({
                          ...current,
                          preset: REPORT_FILTER_PRESETS.custom,
                          startDate: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#465fff]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
                    <input
                      type="date"
                      value={reportFilter.endDate}
                      min={reportFilter.startDate || undefined}
                      onChange={(event) =>
                        setReportFilter((current) => ({
                          ...current,
                          preset: REPORT_FILTER_PRESETS.custom,
                          endDate: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#465fff]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomReportRange}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Apply
                  </button>
                </div>
              ) : null}

              {reportErrorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {reportErrorMessage}
                </div>
              ) : null}
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Listing Report</h3>
                <p className="text-sm text-slate-500">{reportRangeDescription}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                Total: <span className="font-semibold text-slate-900">{listingReport.totalNewListings}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {(listingReport.dailyCounts || []).map((day) => {
                const maxCount = Math.max(...(listingReport.dailyCounts || []).map((item) => item.count), 1)
                const width = `${Math.max((day.count / maxCount) * 100, day.count > 0 ? 12 : 0)}%`

                return (
                  <div key={day.date} className="grid grid-cols-[80px_1fr_40px] items-center gap-3">
                    <span className="text-sm font-medium text-slate-600">{day.label}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#465fff] to-cyan-500" style={{ width }} />
                    </div>
                    <span className="text-right text-sm font-semibold text-slate-900">{day.count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Today&apos;s Listings</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{todaysListingCount}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">Fresh property submissions today</p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Cover Photos</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{coverPhotoCount}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">Homepage cover assets</p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Pending Review</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.pendingProperties}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">Properties awaiting moderation</p>
              </div>
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Feedback</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalFeedback}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">Customer reviews and comments</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
              <div className="mt-4 grid grid-cols-1 gap-3">
                {[
                  ['users', 'Manage users', BiUser],
                  ['properties', 'Review properties', GiHouse],
                  ['orders', 'Update orders', BiPackage],
                  ['feedback', 'Moderate feedback', MdFeedback],
                  ['pricing', 'Adjust credits', MdSettings],
                  ['cover-photos', 'Refresh banners', BiImage],
                  ['inquiries', 'Review inquiries', MdAdd],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onQuickAction(key)}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-[#465fff] hover:bg-[#eef2ff]"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#465fff] shadow-sm">
                      <Icon />
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Daily User-Wise Listing</h3>
              <p className="text-sm text-slate-500">
                See how many listings each submitter created today and across {reportRangeLabel.toLowerCase()}.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
              Total: <span className="font-semibold text-slate-900">{submitterListingReport.grandTotal || 0}</span>
            </div>
          </div>

          {dashboardSubmitters.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-base font-semibold text-slate-800">No user-wise listings found</p>
              <p className="mt-2 text-sm text-slate-500">
                No users have submitted any property listings in {reportRangeLabel.toLowerCase()}.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="rounded-[24px] border border-cyan-100 bg-cyan-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">Today User-Wise Listing</h4>
                    <p className="text-sm text-slate-600">Submitters with new listings today.</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                    Today Total: <span className="font-semibold text-slate-900">{submitterListingReport.todayTotal || 0}</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {(submittersWithListingsToday.length > 0 ? submittersWithListingsToday : dashboardSubmitters).map((submitter) => (
                    <div key={submitter.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-cyan-100">
                      <p className="text-sm font-medium text-slate-600">{submitter.name}</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {submitterListingReport.todayCountsBySubmitterId?.[submitter.id] || 0}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Listings created today</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Day
                      </th>
                      {dashboardSubmitters.map((submitter) => (
                        <th
                          key={submitter.id}
                          className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {submitter.name}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {submitterListingReport.dailyRows.map((day) => (
                      <tr key={day.date}>
                        <td className="sticky left-0 border-t border-slate-100 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                          {day.label}
                        </td>
                        {dashboardSubmitters.map((submitter) => (
                          <td
                            key={`${day.date}-${submitter.id}`}
                            className="border-t border-slate-100 px-4 py-3 text-right text-sm text-slate-700"
                          >
                            {day.countsBySubmitterId?.[submitter.id] || 0}
                          </td>
                        ))}
                        <td className="border-t border-slate-100 px-4 py-3 text-right text-sm font-semibold text-slate-900">
                          {day.total || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="sticky left-0 border-t-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                        Total
                      </td>
                      {dashboardSubmitters.map((submitter) => (
                        <td
                          key={`total-${submitter.id}`}
                          className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-semibold text-slate-900"
                        >
                          {submitterListingReport.totalsBySubmitterId?.[submitter.id] || 0}
                        </td>
                      ))}
                      <td className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        {submitterListingReport.grandTotal || 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboardSection
