'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../i18n/useLanguage'
import IDVerification from '../AddProperty/IDVerification'
import { VerifiedOwnerBadge } from '../listing/ListingTrust'
import { getMyVerification, submitVerification } from '../../services/verificationService'
import { formatPanelDate, PanelCard, PanelCardHeader } from './UserPanelPrimitives'

/**
 * "Get verified": the owner uploads an ID (NID, passport or driving licence). An admin reviews it
 * in the admin panel; approval puts a "Verified owner" badge on all of the owner's listings.
 */
const VerificationPanel = () => {
  const { t, language } = useLanguage()
  const { user, isLoading } = useAuth()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [idType, setIdType] = useState('National ID')
  const [idFront, setIdFront] = useState(null)
  const [idBack, setIdBack] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState({ type: '', key: '', text: '' })

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await getMyVerification(user.id)
    setRequest(data)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (!isLoading) void load()
  }, [isLoading, load])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage({ type: '', key: '', text: '' })

    if (!idFront || !idBack) {
      setMessage({ type: 'error', key: 'dashboard.verification.needBothSides', text: '' })
      return
    }

    setSubmitting(true)
    const { error } = await submitVerification({ userId: user.id, idType, frontFile: idFront, backFile: idBack })
    setSubmitting(false)

    if (error) {
      setMessage({ type: 'error', key: '', text: error.message || '' })
      return
    }

    setIdFront(null)
    setIdBack(null)
    setMessage({ type: 'success', key: 'dashboard.verification.submitted', text: '' })
    await load()
  }

  if (isLoading || loading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500" role="status">{t('common.loading')}</p>
      </PanelCard>
    )
  }

  const status = request?.verification_status || (user?.verified ? 'approved' : '')
  const canSubmit = status !== 'approved' && status !== 'pending'

  return (
    <PanelCard>
      <PanelCardHeader title={t('dashboard.verification.title')} subtitle={t('dashboard.verification.subtitle')} />

      <div className="space-y-5 px-6 py-6">
        {status === 'approved' ? (
          <div className="ui-note ui-note-success space-y-2">
            <VerifiedOwnerBadge />
            <p>{t('dashboard.verification.approved')}</p>
          </div>
        ) : null}

        {status === 'pending' ? (
          <p className="ui-note" role="status">
            {t('dashboard.verification.pending', { date: formatPanelDate(request?.submitted_at, false, language) })}
          </p>
        ) : null}

        {status === 'rejected' ? (
          <div className="ui-note ui-note-danger" role="alert">
            <p className="font-semibold">{t('dashboard.verification.rejected')}</p>
            {request?.admin_notes ? <p className="mt-1">{t('dashboard.verification.reason', { reason: request.admin_notes })}</p> : null}
          </div>
        ) : null}

        {canSubmit ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>{t('dashboard.verification.why')}</li>
              <li>{t('dashboard.verification.privacy')}</li>
            </ul>
            <IDVerification
              idType={idType}
              idFront={idFront}
              idBack={idBack}
              onIdTypeChange={setIdType}
              onIdFrontChange={setIdFront}
              onIdBackChange={setIdBack}
              isVerified={false}
            />
            {message.type ? (
              <p role={message.type === 'error' ? 'alert' : 'status'} className={`ui-note ${message.type === 'error' ? 'ui-note-danger' : 'ui-note-success'}`}>
                {message.key ? t(message.key) : message.text || t('dashboard.verification.failed')}
              </p>
            ) : null}
            <button type="submit" disabled={submitting} className="ui-btn ui-btn-primary">
              {submitting ? t('dashboard.verification.submitting') : t('dashboard.verification.submit')}
            </button>
          </form>
        ) : message.type === 'success' ? (
          <p role="status" className="ui-note ui-note-success">{t(message.key)}</p>
        ) : null}
      </div>
    </PanelCard>
  )
}

export default VerificationPanel
