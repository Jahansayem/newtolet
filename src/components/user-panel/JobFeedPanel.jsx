'use client'

import React, { useMemo, useState } from 'react'
import { FiMapPin } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { createJobParticipation, getJobFeed } from '../../services/userPanelService'
import { useLanguage } from '../../i18n/useLanguage'
import { EmptyState, PanelCard, PanelCardHeader } from './UserPanelPrimitives'

const getRelativeDeadline = (value, t, tc) => {
  if (!value) {
    return t('dashboard.jobs.noDeadline')
  }

  const diffMs = new Date(value).getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes <= 0) {
    return t('dashboard.jobs.deadlinePassed')
  }

  if (diffMinutes < 60) {
    return t('dashboard.jobs.minutesFromNow', { count: diffMinutes })
  }

  const diffHours = Math.round(diffMinutes / 60)
  return tc('dashboard.jobs.hoursFromNow', diffHours)
}

const JobFeedPanel = () => {
  const { t, tv, tc } = useLanguage()
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
      setError(result.error.message || t('dashboard.jobs.submitError'))
      return
    }

    setNotice(t('dashboard.jobs.submitted'))
    setForm({ specificAddress: '', contactDetails: '' })
  }

  if (isLoading || jobsLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">{t('dashboard.jobs.loading')}</p>
      </PanelCard>
    )
  }

  return (
    <>
      <PanelCard>
        <PanelCardHeader
          title={t('dashboard.jobs.title')}
          subtitle={t('dashboard.jobs.subtitle')}
          status={isRefreshing ? t('dashboard.common.refreshing') : null}
        />

        <div className="px-6 py-6">
          {jobs.length === 0 ? (
            <EmptyState
              title={t('dashboard.jobs.emptyTitle')}
              description={t('dashboard.jobs.emptyDescription')}
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
                        {t('dashboard.jobs.idLabel', { id: job.id?.slice?.(0, 8) || job.id })}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {t('dashboard.jobs.roomsFor', {
                          rooms: job.rooms || 1,
                          category: tv('categories', job.category),
                        })}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                        <span>
                          {t('dashboard.jobs.from', {
                            value: job.property_need_from || t('dashboard.jobs.open'),
                          })}
                        </span>
                        <span>
                          {t('dashboard.jobs.deadline', {
                            value: getRelativeDeadline(job.deadline, t, tc),
                          })}
                        </span>
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
                      className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
                    >
                      {t('dashboard.jobs.viewDetails')}
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
              <h3 className="text-xl font-bold text-slate-900">{t('dashboard.jobs.detailsTitle')}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {t('dashboard.jobs.detailsSubtitle')}
              </p>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-lg font-semibold text-slate-900">
                  {t('dashboard.jobs.roomsFor', {
                    rooms: selectedJob.rooms || 1,
                    category: tv('categories', selectedJob.category),
                  })}
                </p>
                <p className="mt-2 text-sm text-slate-500">{formattedLocation}</p>
                {selectedJob.additional_preferences ? (
                  <p className="mt-4 text-sm text-slate-500">{selectedJob.additional_preferences}</p>
                ) : null}
              </div>

              <form className="space-y-4" onSubmit={submitParticipation}>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('dashboard.jobs.specificAddress')}
                  </label>
                  <input
                    type="text"
                    value={form.specificAddress}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, specificAddress: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
                    placeholder={t('dashboard.jobs.specificAddressPlaceholder')}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t('dashboard.jobs.contactDetails')}
                  </label>
                  <textarea
                    value={form.contactDetails}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, contactDetails: event.target.value }))
                    }
                    className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
                    placeholder={t('dashboard.jobs.contactDetailsPlaceholder')}
                  />
                </div>

                {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
                {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={submitting || !user?.id}
                    className="rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? t('dashboard.common.submitting') : t('dashboard.jobs.submit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {t('common.close')}
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
