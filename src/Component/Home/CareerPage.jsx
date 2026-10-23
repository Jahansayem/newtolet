'use client'

import { useLanguage } from '../../i18n/useLanguage'

export default function CareerPage() {
  const { t } = useLanguage()

  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">{t('career.kicker')}</p>
        <h1 className="mt-4 text-4xl font-bold text-slate-900">{t('career.title')}</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          {t('career.description')}
        </p>
      </div>
    </section>
  )
}
