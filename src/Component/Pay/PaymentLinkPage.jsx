'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FiAlertCircle, FiCheck, FiClock, FiLock, FiSlash, FiXCircle } from 'react-icons/fi'
import { getPaymentLink, startPaymentLinkCheckout, verifyPaymentLink } from '../../services/paymentLinkService'
import { normalizeBdPhone, normalizePaymentLinkCode, resolvePayPageView } from '../../lib/paymentLinks'
import { useLanguage } from '../../i18n/useLanguage'
import LanguageToggle from '../../components/LanguageToggle.jsx'

// ৳ and Western digits in both languages (project i18n rule).
const money = (value) => Number(value || 0).toLocaleString('en-US')
const REFERENCE_PATTERN = /^\d{10,30}$/

// One soft tint per outcome. The title always says what happened; the colour
// and icon only support it.
const TONES = {
  success: { ring: 'bg-success-soft text-success', icon: FiCheck },
  wait: { ring: 'bg-marigold-soft text-marigold-700', icon: FiClock },
  problem: { ring: 'bg-danger-soft text-danger', icon: FiXCircle },
  quiet: { ring: 'bg-canvas text-muted', icon: FiSlash },
  missing: { ring: 'bg-canvas text-muted', icon: FiAlertCircle },
}

const Shell = ({ children }) => (
  <div className="flex min-h-dvh flex-col bg-canvas px-4 py-6 sm:py-10">
    <header className="mx-auto flex w-full max-w-md items-center justify-between">
      <Link to="/" className="inline-flex items-center" aria-label="NewTolet.Com">
        <img src="/logo.png" alt="NewTolet.Com" className="h-9 w-auto" />
      </Link>
      <LanguageToggle size="sm" />
    </header>
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6">{children}</main>
  </div>
)

const Outcome = ({ tone, title, description, children = null }) => {
  const config = TONES[tone] || TONES.quiet
  const Icon = config.icon
  return (
    <div className="text-center" role="status">
      <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${config.ring}`} aria-hidden="true">
        <Icon className="text-2xl" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-body leading-relaxed text-muted">{description}</p>
      {children}
    </div>
  )
}

const AmountBlock = ({ label, amount, purposeLabel, purpose }) => (
  <div className="rounded-[var(--radius-card)] bg-canvas px-5 py-5 text-center">
    <p className="text-caption text-muted">{label}</p>
    <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-ink">৳{money(amount)}</p>
    {purpose ? (
      <p className="mt-3 text-body text-ink">
        <span className="text-muted">{purposeLabel}: </span>
        {purpose}
      </p>
    ) : null}
  </div>
)

const PaymentLinkPage = () => {
  const { t, fdt } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawCode = searchParams.get('c')
  const code = normalizePaymentLinkCode(rawCode)
  const referenceParam = searchParams.get('reference')
  const reference = referenceParam && REFERENCE_PATTERN.test(referenceParam) ? referenceParam : null
  const returnState = searchParams.get('state')

  // phase: 'loading' | 'verifying' | 'ready' | 'error'
  const [phase, setPhase] = useState(reference ? 'verifying' : 'loading')
  const [link, setLink] = useState(null)
  const [payment, setPayment] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [formError, setFormError] = useState('')
  const [starting, setStarting] = useState(false)

  const load = useCallback(async () => {
    if (!code) {
      setLink(null)
      setPhase('ready')
      return
    }

    setPhase(reference ? 'verifying' : 'loading')
    // Coming back from EPS: ask the server to confirm this attempt. A plain
    // visit (or a verify that fails) just reads the link.
    let result = reference ? await verifyPaymentLink(code, reference) : await getPaymentLink(code)
    if (result.error && reference) result = await getPaymentLink(code)

    if (result.error) {
      const notFound = /not found/i.test(result.error.message || '')
      setLink(null)
      setPayment(null)
      setPhase(notFound ? 'ready' : 'error')
      return
    }

    setLink(result.data?.link || null)
    setPayment(result.data?.payment || null)
    setPhase('ready')
  }, [code, reference])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    document.title = t('payments.link.pageTitle')
  }, [t])

  const startAgain = () => {
    setFormError('')
    setPayment(null)
    setSearchParams({ c: code }, { replace: true })
  }

  const pay = async (event) => {
    event.preventDefault()
    if (starting) return

    const cleanName = name.replace(/\s+/g, ' ').trim()
    if (link.needs_name && cleanName.length < 2) {
      setFormError(t('payments.link.errors.nameRequired'))
      return
    }
    const cleanPhone = link.needs_phone ? normalizeBdPhone(phone) : null
    if (link.needs_phone && !cleanPhone) {
      setFormError(t('payments.link.errors.phoneInvalid'))
      return
    }

    setFormError('')
    setStarting(true)
    const result = await startPaymentLinkCheckout(code, { name: cleanName || null, phone: cleanPhone })

    if (result.error || !result.data?.paymentUrl) {
      setStarting(false)
      // The link may have been paid or cancelled in the meantime.
      await load()
      setFormError(result.error?.message || t('payments.link.errors.startFailed'))
      return
    }

    // Leave `starting` on: the browser is navigating to the EPS page.
    window.location.assign(result.data.paymentUrl)
  }

  if (phase === 'loading' || phase === 'verifying') {
    return (
      <Shell>
        <section className="ui-panel p-8 text-center" aria-busy="true" aria-live="polite">
          <span className="loading loading-spinner loading-lg text-brand" aria-hidden="true" />
          <h1 className="mt-4 text-lg font-semibold text-ink">{t(phase === 'verifying' ? 'payments.link.verifying' : 'payments.link.loading')}</h1>
          {phase === 'verifying' ? <p className="mt-2 text-caption text-muted">{t('payments.link.verifyingHint')}</p> : null}
        </section>
      </Shell>
    )
  }

  if (phase === 'error') {
    return (
      <Shell>
        <section className="ui-panel p-6 sm:p-8">
          <Outcome tone="missing" title={t('payments.link.errors.loadFailed')} description="">
            <button type="button" className="ui-btn ui-btn-primary mt-6 w-full" onClick={() => void load()}>
              {t('payments.link.tryAgain')}
            </button>
          </Outcome>
        </section>
      </Shell>
    )
  }

  const view = resolvePayPageView({ link, payment, state: returnState, hasReference: Boolean(reference) })

  if (view === 'not-found') {
    return (
      <Shell>
        <section className="ui-panel p-6 sm:p-8">
          <Outcome tone="missing" title={t('payments.link.notFound.title')} description={t('payments.link.notFound.description')} />
        </section>
      </Shell>
    )
  }

  if (view === 'closed') {
    return (
      <Shell>
        <section className="ui-panel p-6 sm:p-8">
          <Outcome tone="quiet" title={t('payments.link.closed.title')} description={t('payments.link.closed.description')} />
        </section>
      </Shell>
    )
  }

  if (view === 'paid') {
    const rows = [
      { label: t('payments.link.paid.amount'), value: `৳${money(payment?.amount || link.amount_bdt)}` },
      payment?.method ? { label: t('payments.link.paid.method'), value: payment.method } : null,
      payment?.eps_transaction_id || payment?.reference
        ? { label: t('payments.link.paid.transaction'), value: payment.eps_transaction_id || payment.reference, mono: true }
        : null,
      link.paid_at ? { label: t('payments.link.paid.date'), value: fdt(link.paid_at, { month: 'long' }) } : null,
    ].filter(Boolean)

    return (
      <Shell>
        <section className="ui-panel p-6 sm:p-8">
          <Outcome tone="success" title={t('payments.link.paid.title')} description={t('payments.link.paid.description')} />
          <dl className="mt-6 divide-y divide-line rounded-[var(--radius-card)] border border-line text-body">
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-muted">{t('payments.link.forLabel')}</dt>
              <dd className="text-right text-ink">{link.purpose}</dd>
            </div>
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="shrink-0 text-muted">{row.label}</dt>
                <dd className={`break-all text-right text-ink ${row.mono ? 'font-mono text-caption' : 'tabular-nums'}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-center text-caption text-muted">{t('payments.link.paid.keep')}</p>
        </section>
      </Shell>
    )
  }

  if (view === 'review' || view === 'pending') {
    return (
      <Shell>
        <section className="ui-panel p-6 sm:p-8">
          <Outcome tone="wait" title={t(`payments.link.${view}.title`)} description={t(`payments.link.${view}.description`)}>
            <div className="mt-6 space-y-3">
              <AmountBlock label={t('payments.link.amountLabel')} amount={link.amount_bdt} purposeLabel={t('payments.link.forLabel')} purpose={link.purpose} />
              <button type="button" className="ui-btn ui-btn-secondary w-full" onClick={() => void load()}>
                {t('payments.link.checkAgain')}
              </button>
            </div>
          </Outcome>
        </section>
      </Shell>
    )
  }

  if (view === 'failed' || view === 'cancelled') {
    return (
      <Shell>
        <section className="ui-panel p-6 sm:p-8">
          <Outcome tone={view === 'failed' ? 'problem' : 'quiet'} title={t(`payments.link.${view}.title`)} description={t(`payments.link.${view}.description`)}>
            <div className="mt-6 space-y-3">
              <AmountBlock label={t('payments.link.amountLabel')} amount={link.amount_bdt} purposeLabel={t('payments.link.forLabel')} purpose={link.purpose} />
              <button type="button" className="ui-btn ui-btn-primary w-full" onClick={startAgain}>
                {t('payments.link.tryAgain')}
              </button>
            </div>
          </Outcome>
        </section>
      </Shell>
    )
  }

  // view === 'ready'
  return (
    <Shell>
      <section className="ui-panel overflow-hidden">
        <form onSubmit={pay} className="space-y-5 p-6 sm:p-8" noValidate>
          {link.customer_first_name ? <p className="text-body text-muted">{t('payments.link.greeting', { name: link.customer_first_name })}</p> : null}

          <AmountBlock label={t('payments.link.amountLabel')} amount={link.amount_bdt} purposeLabel={t('payments.link.forLabel')} purpose={link.purpose} />

          {link.needs_name ? (
            <div>
              <label className="ui-label" htmlFor="pay-name">{t('payments.link.nameLabel')}</label>
              <input id="pay-name" className="ui-field" autoComplete="name" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} />
            </div>
          ) : null}

          {link.needs_phone ? (
            <div>
              <label className="ui-label" htmlFor="pay-phone">{t('payments.link.phoneLabel')}</label>
              <input
                id="pay-phone"
                className="ui-field tabular-nums"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={17}
                placeholder="01XXXXXXXXX"
                required
                aria-describedby="pay-phone-hint"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
              <p id="pay-phone-hint" className="ui-help">{t('payments.link.phoneHint')}</p>
            </div>
          ) : null}

          {formError ? (
            <p className="ui-note ui-note-danger text-caption" role="alert">
              {formError}
            </p>
          ) : null}

          <button type="submit" className="ui-btn ui-btn-primary ui-btn-lg w-full" disabled={starting} aria-busy={starting || undefined}>
            {starting ? (
              <>
                <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                <span>{t('payments.link.starting')}</span>
              </>
            ) : (
              <span className="tabular-nums">{t('payments.link.payButton', { amount: money(link.amount_bdt) })}</span>
            )}
          </button>

          <p className="flex items-start gap-2 text-caption leading-relaxed text-muted">
            <FiLock className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{t('payments.link.secure')}</span>
          </p>
        </form>

        <div className="border-t border-line bg-canvas px-6 py-4 sm:px-8">
          <img
            src="/payments/eps-checkout-banner.webp"
            alt={t('payments.link.epsBadgeAlt')}
            className="mx-auto w-full max-w-xs"
            loading="lazy"
            decoding="async"
          />
          <p className="mt-2 text-center text-caption text-muted">{t('payments.link.methods')}</p>
        </div>
      </section>

      <p className="mt-4 text-center text-caption text-muted">
        <Link to="/contact" className="underline decoration-line underline-offset-4 hover:text-ink">
          {t('payments.link.support')}
        </Link>
      </p>
    </Shell>
  )
}

export default PaymentLinkPage
