'use client'

import Link from 'next/link'
import { useLanguage } from '../../src/i18n/useLanguage'

/**
 * Slim header for the standalone auth pages (login, registration, password reset).
 * Those pages hide the full site chrome, which left visitors with no way back to Home or Search.
 * The language toggle stays inside each auth card, so it is not repeated here.
 */
export default function AuthHeader() {
  const { t } = useLanguage()

  return (
    <header className="border-b border-line bg-white">
      <nav
        aria-label={t('nav.mainNavigation')}
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3"
      >
        <Link href="/" className="inline-flex shrink-0 items-center" aria-label={t('nav.logoAlt')}>
          <img src="/logo.png" alt={t('nav.logoAlt')} className="h-9 w-auto" width="144" height="36" />
        </Link>
        <div className="flex items-center gap-1 text-sm font-semibold">
          <Link href="/" className="ui-btn ui-btn-ghost ui-btn-sm">
            {t('nav.home')}
          </Link>
          <Link href="/bd/property-listing/" className="ui-btn ui-btn-ghost ui-btn-sm">
            {t('nav.properties')}
          </Link>
        </div>
      </nav>
    </header>
  )
}
