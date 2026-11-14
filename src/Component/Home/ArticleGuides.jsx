'use client'

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowRight } from 'react-icons/fi'
import { useLanguage } from '../../i18n/useLanguage'
import { countNewListings } from '../../services/propertyCatalogService'
import { buildSearchHref, getSearchRouteContext } from './propertySearch'
import { buildDashboardHref } from '../../lib/routePaths'

const LISTING_CONTEXT = getSearchRouteContext('/bd/property-listing')

// Area guides link to the live search; the count is read live, never hard-coded.
const GUIDES = [
  { id: 'mirpur', filters: { search: 'Mirpur' } },
  { id: 'uttara', filters: { search: 'Uttara' } },
  { id: 'dhanmondi', filters: { search: 'Dhanmondi' } },
  { id: 'bachelor-dhaka', filters: { district: 'Dhaka', category: 'Bachelor' } },
  { id: 'refer-and-earn', href: buildDashboardHref('referrals') },
  { id: 'earn-by-finding-homes', href: buildDashboardHref('job-feed') },
]

const ArticleGuides = () => {
  const { t } = useLanguage()
  const [counts, setCounts] = useState({})

  useEffect(() => {
    let active = true
    Promise.all(
      GUIDES.filter((guide) => guide.filters).map(async (guide) => {
        try {
          return [guide.id, await countNewListings(guide.filters)]
        } catch {
          return [guide.id, null]
        }
      })
    ).then((entries) => {
      if (active) setCounts(Object.fromEntries(entries))
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="border-t border-slate-100 p-5 sm:p-8 lg:p-10">
      <h2 className="text-2xl font-bold text-slate-900">{t('article.guides.title')}</h2>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {GUIDES.map((guide) => {
          const href = guide.href || buildSearchHref(guide.filters, LISTING_CONTEXT)
          const count = counts[guide.id]
          return (
            <article key={guide.id} id={guide.id} className="scroll-mt-28 rounded-3xl border border-slate-100 bg-slate-50 p-6">
              <h3 className="text-xl font-bold text-slate-900">{t(`article.guides.items.${guide.id}.title`)}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{t(`article.guides.items.${guide.id}.body1`)}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{t(`article.guides.items.${guide.id}.body2`)}</p>
              <Link to={href} className="ui-btn ui-btn-secondary ui-btn-sm mt-5">
                <span>
                  {guide.filters && Number.isFinite(count)
                    ? t('article.guides.searchWithCount', { count: count.toLocaleString() })
                    : t(`article.guides.items.${guide.id}.cta`)}
                </span>
                <FiArrowRight aria-hidden="true" />
              </Link>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default ArticleGuides
