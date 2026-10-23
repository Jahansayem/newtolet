'use client'

import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'

const levelClasses = {
  1: 'text-3xl md:text-4xl font-bold text-gray-900',
  2: 'text-2xl font-bold text-gray-900',
  3: 'text-xl font-semibold text-gray-900',
  4: 'text-lg font-semibold text-gray-800',
}

const renderContentItem = (item) => {
  if (item.type === 'paragraph') {
    return (
      <p key={item.text} className="text-sm leading-7 text-gray-600 md:text-base">
        {item.text}
      </p>
    )
  }

  if (item.type === 'list') {
    return (
      <ul key={item.items.join('|')} className="space-y-3 text-sm leading-7 text-gray-600 md:text-base">
        {item.items.map((entry) => (
          <li key={entry} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
            <span>{entry}</span>
          </li>
        ))}
      </ul>
    )
  }

  return null
}

const renderSection = (section) => (
  <section key={section.title} className="space-y-4">
    <h2 className={levelClasses[section.level || 2]}>{section.title}</h2>
    {Array.isArray(section.content) ? section.content.map(renderContentItem) : null}
    {section.sections ? (
      <div className="space-y-8 pt-2">
        {section.sections.map(renderSection)}
      </div>
    ) : null}
  </section>
)

export default function PolicyPage({ policy }) {
  const { t, language } = useLanguage()
  const content = policy[language] || policy.en

  return (
    <section className="bg-gray-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-5 text-sm text-gray-500">
          <Link to="/" className="font-medium text-brand hover:text-brand-hover">
            {t('common.home')}
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <span>{content.breadcrumbLabel}</span>
        </nav>

        <div className="mb-8 rounded-3xl border border-brand/10 bg-white p-6 shadow-sm md:p-8">
          <div className="inline-flex items-center rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">
            {content.badge}
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900 md:text-4xl">{content.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600 md:text-base">
            {content.intro}
          </p>
          <p className="mt-4 text-sm font-medium text-gray-500">{t('policy.updated', { date: content.updatedAt })}</p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-10">
          <div className="space-y-10">{content.sections.map(renderSection)}</div>
        </div>
      </div>
    </section>
  )
}
