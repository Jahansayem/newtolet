'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { getProfileSettings, updatePanelProfile } from '../../services/userPanelService'
import { PanelCard, PanelCardHeader } from './UserPanelPrimitives'

const EMPTY_FORM = {
  name: '',
  email: '',
  newPassword: '',
}

const ProfilePanel = () => {
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
      setError(result.error || 'Unable to update profile.')
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
        ? 'Profile updated. Confirm the email change from your inbox.'
        : 'Profile updated successfully.'
    )
  }

  if (isLoading || profileLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">Loading profile...</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard>
      <PanelCardHeader
        title="Profile"
        subtitle="Update the account details shown in your user panel."
        status={isRefreshing ? 'Refreshing...' : null}
      />
      <form className="space-y-5 px-6 py-6" onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Name*</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1E73B8]"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email address*</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1E73B8]"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">New password</label>
          <input
            type="password"
            value={form.newPassword}
            onChange={(event) =>
              setForm((current) => ({ ...current, newPassword: event.target.value }))
            }
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#1E73B8]"
            placeholder="Leave blank to keep your current password"
          />
        </div>

        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-[#1E73B8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#17639f] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving...' : 'Save changes'}
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
            Cancel
          </button>
        </div>
      </form>
    </PanelCard>
  )
}

export default ProfilePanel
