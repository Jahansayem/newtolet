'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { getProfileSettings, updatePanelProfile } from '../../services/userPanelService'
import { useLanguage } from '../../i18n/useLanguage'
import { PanelCard, PanelCardHeader } from './UserPanelPrimitives'

const EMPTY_FORM = {
  name: '',
  email: '',
  newPassword: '',
}

const ProfilePanel = () => {
  const { t } = useLanguage()
  const { user, isLoading, updateUserInContext } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [initialForm, setInitialForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const {
    data: profile,
    isLoading: profileLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'profile',
    loader: () => getProfileSettings(user.id),
    enabled: !isLoading && Boolean(user?.id),
  })

  useEffect(() => {
    const nextForm = {
      name: profile?.name || '',
      email: profile?.email || '',
      newPassword: '',
    }

    setForm(nextForm)
    setInitialForm(nextForm)
  }, [profile?.email, profile?.name])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    setError('')

    const result = await updatePanelProfile(user?.id, form)
    setSaving(false)

    if (!result.success) {
      setError(result.error || t('dashboard.profile.updateError'))
      return
    }

    updateUserInContext?.({
      name: form.name,
      email: form.email,
    })

    const nextInitial = {
      name: form.name,
      email: form.email,
      newPassword: '',
    }

    setInitialForm(nextInitial)
    setForm(nextInitial)
    setNotice(
      result.requiresEmailVerification
        ? t('dashboard.profile.updatedVerifyEmail')
        : t('dashboard.profile.updated')
    )
  }

  if (isLoading || profileLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">{t('dashboard.profile.loading')}</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard>
      <PanelCardHeader
        title={t('dashboard.profile.title')}
        subtitle={t('dashboard.profile.subtitle')}
        status={isRefreshing ? t('dashboard.common.refreshing') : null}
      />
      <form className="space-y-5 px-6 py-6" onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold text-slate-700">{t('dashboard.profile.nameLabel')}</label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand"
              required
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-2 block text-sm font-semibold text-slate-700">{t('dashboard.profile.emailLabel')}</label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="profile-new-password" className="mb-2 block text-sm font-semibold text-slate-700">{t('dashboard.profile.newPasswordLabel')}</label>
          <input
            id="profile-new-password"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) =>
              setForm((current) => ({ ...current, newPassword: event.target.value }))
            }
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand"
            placeholder={t('dashboard.profile.newPasswordPlaceholder')}
          />
        </div>

        {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
        {notice ? <p role="status" className="text-sm font-medium text-emerald-600">{notice}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? t('dashboard.common.saving') : t('dashboard.profile.saveChanges')}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(initialForm)
              setNotice('')
              setError('')
            }}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </PanelCard>
  )
}

export default ProfilePanel
