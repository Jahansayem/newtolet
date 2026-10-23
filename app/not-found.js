'use client'

import Link from 'next/link'
import { useLanguage } from '../src/i18n/useLanguage'

export default function NotFound() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">{t('notFound.title')}</h1>
        <p className="text-gray-600 mb-6">{t('notFound.description')}</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-3 text-white font-semibold hover:bg-brand-hover transition-colors"
        >
          {t('notFound.goHome')}
        </Link>
      </div>
    </div>
  )
}
