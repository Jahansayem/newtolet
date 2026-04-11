'use client'

import React, { useMemo, useState } from 'react'
import { FiMapPin } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { createJobParticipation, getJobFeed } from '../../services/userPanelService'
import { EmptyState, PanelCard, PanelCardHeader } from './UserPanelPrimitives'

const getRelativeDeadline = (value) => {
  if (!value) {
    return 'No deadline'
  }

  const diffMs = new Date(value).getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes <= 0) {
    return 'Deadline passed'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minutes from now`
  }

  const diffHours = Math.round(diffMinutes / 60)
  return `${diffHours} hour${diffHours === 1 ? '' : 's'} from now`
}

const JobFeedPanel = () => {
  const { user, isLoading } = useAuth()
  const [selectedJob, setSelectedJob] = useState(null)
  const [form, setForm] = useState({ specificAddress: '', contactDetails: '' })
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const {
    data: jobs = [],
    isLoading: jobsLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: 'global',
    resourceKey: 'job-feed',
    loader: getJobFeed,
    enabled: !isLoading,
  })

  const formattedLocation = useMemo(
    () => [selectedJob?.area, selectedJob?.district, selectedJob?.division].filter(Boolean).join(', '),
    [selectedJob]
  )

  const submitParticipation = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setNotice('')
    setError('')

    const result = await createJobParticipation(user?.id, {
      orderId: selectedJob?.id,
      specificAddress: form.specificAddress,
      contactDetails: form.contactDetails,
    })

    setSubmitting(false)

    if (result.error) {
      setError(result.error.message || 'Unable to submit for this job.')
      return
    }

    setNotice('Job participation submitted successfully.')
    setForm({ specificAddress: '', contactDetails: '' })
  }

  if (isLoading || jobsLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">Loading job feed...</p>
      </PanelCard>
    )
  }

  return (
    <>
      <PanelCard>
        <PanelCardHeader
          title="Job"
          subtitle="Confirmed posted orders are available here for you to review and respond to."
          status={isRefreshing ? 'Refreshing...' : null}
        />

        <div className="px-6 py-6">
          {jobs.length === 0 ? (
            <EmptyState
              title="No jobs available right now"
              description="Once confirmed posted orders are available, they will appear here."
            />
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-3xl border border-slate-200 p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        ID : {job.id?.slice?.(0, 8) || job.id}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {job.rooms || 1} Room For {job.category}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                        <span>From : {job.property_need_from || 'Open'}</span>
                        <span>Deadline : {getRelativeDeadline(job.deadline)}</span>
                        <span className="inline-flex items-center gap-2">
                          <FiMapPin className="shrink-0" />
                          <span>
                            {[job.area, job.district, job.division].filter(Boolean).join(', ')}
                          </span>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJob(job)
                        setNotice('')
                        setError('')
                      }}
                      className="inline-flex items-center justify-center rounded-2xl bg-[#1E73B8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f]"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PanelCard>

      {selectedJob ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="text-xl font-bold text-slate-900">Job Details</h3>
              <p className="mt-1 text-sm text-slate-500">
                Submit your details for this job to track it in Job History.
              </p>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-lg font-semibold text-slate-900">
                  {selectedJob.rooms || 1} Room For {selectedJob.category}
                </p>
                <p className="mt-2 text-sm text-slate-500">{formattedLocation}</p>
                {selectedJob.additional_preferences ? (
                  <p className="mt-4 text-sm text-slate-500">{selectedJob.additional_preferences}</p>
                ) : null}
              </div>

              <form className="space-y-4" onSubmit={submitParticipation}>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Specific address
                  </label>
                  <input
                    type="text"
                    value={form.specificAddress}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, specificAddress: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
                    placeholder="e.g. House 12, Road 5"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Contact details
                  </label>
                  <textarea
                    value={form.contactDetails}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, contactDetails: event.target.value }))
                    }
                    className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1E73B8]"
                    placeholder="Explain how the property can be reached or contacted"
                  />
                </div>

                {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
                {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={submitting || !user?.id}
                    className="rounded-2xl bg-[#1E73B8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Submit Job'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default JobFeedPanel
