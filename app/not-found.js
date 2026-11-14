'use client'

import Link from 'next/link'
import { useLanguage } from '../src/i18n/useLanguage'

const POPULAR_AREAS = ['Mirpur', 'Uttara', 'Dhanmondi', 'Bashundhara', 'Mohammadpur', 'Gulshan']
const LISTING_PATH = '/bd/property-listing/'

export default function NotFound() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <Link href="/" aria-label={t('nav.logoAlt')}>
            <img src="/logo.png" alt={t('nav.logoAlt')} className="h-9 w-auto" width="144" height="36" />
          </Link>
        </div>
      </header>

      <main className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg text-center">
          <h1 className="mb-3 text-4xl font-bold text-gray-900">{t('notFound.title')}</h1>
          <p className="mb-8 text-gray-600">{t('notFound.description')}</p>

          {/* Plain GET form: works before JavaScript loads and lands on the real search page. */}
          <form action={LISTING_PATH} method="get" role="search" className="flex gap-2">
            <label htmlFor="not-found-search" className="sr-only">
              {t('notFound.searchLabel')}
            </label>
            <input
              id="not-found-search"
              name="search"
              type="search"
              placeholder={t('notFound.searchPlaceholder')}
              className="min-h-11 flex-1 rounded-lg border border-gray-300 bg-white px-4 text-base focus:border-brand focus:outline-none"
            />
            <button type="submit" className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-hover">
              {t('notFound.searchSubmit')}
            </button>
          </form>

          <p className="mt-8 text-sm font-semibold text-gray-700">{t('notFound.popular')}</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {POPULAR_AREAS.map((area) => (
              <li key={area}>
                <Link
                  href={`${LISTING_PATH}?search=${encodeURIComponent(area)}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white px-4 text-sm hover:border-brand hover:text-brand"
                >
                  {area}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-5 font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              {t('notFound.goHome')}
            </Link>
            <Link
              href={LISTING_PATH}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 font-semibold text-gray-800 hover:border-brand"
            >
              {t('notFound.browseAll')}
            </Link>
            <Link
              href="/contact/"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 font-semibold text-gray-800 hover:border-brand"
            >
              {t('notFound.contact')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
