'use client'

import { Link } from 'react-router-dom'
import { BiBriefcaseAlt2, BiBuildings } from 'react-icons/bi'
import { FiCalendar, FiClock, FiMapPin } from 'react-icons/fi'
import {
  formatOrderNeedFrom,
  formatOrderPreferencesSummary,
} from '../utils/orderPreferences'
import { useLanguage } from '../i18n/useLanguage'
import { buildCategoryPagePath } from '../lib/seo/categoryPages.js'

const formatCurrency = (value, t) => {
  if (!value) {
    return t('orders.jobFeed.budgetNotSpecified')
  }

  return t('orders.jobFeed.budgetAmount', { amount: Number(value).toLocaleString() })
}

const formatPostedDate = (value, t, fd) => {
  if (!value) {
    return t('orders.jobFeed.recentlyPosted')
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return t('orders.jobFeed.recentlyPosted')
  }

  return fd(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatLocation = (order) =>
  [order.sub_area, order.area, order.district, order.division]
    .filter(Boolean)
    .join(', ')

const buildFallbackTitle = (order, t, tv) => {
  const category = tv('categories', order.category) || t('orders.jobFeed.defaultCategory')
  const location = formatLocation(order)
  return location
    ? t('orders.jobFeed.fallbackTitleWithLocation', { category, location })
    : t('orders.jobFeed.fallbackTitle', { category })
}

const buildFallbackDescription = (order, t, language) => {
  const summary = formatOrderPreferencesSummary(order.additional_preferences, language)
  if (summary) {
    return summary
  }

  const parts = []
  if (order.rooms) {
    parts.push(t('orders.jobFeed.roomRequirement', { rooms: order.rooms }))
  }
  if (order.max_budget) {
    parts.push(t('orders.jobFeed.budgetUpTo', { budget: formatCurrency(order.max_budget, t) }))
  }
  if (order.property_need_from) {
    parts.push(
      t('orders.jobFeed.needFrom', {
        date: formatOrderNeedFrom(order.property_need_from, language),
      })
    )
  }

  return parts.join(' | ') || t('orders.jobFeed.fallbackDescription')
}

// Known categories go to their landing page; anything else falls back to the filtered list.
const buildCategoryHref = (category) =>
  buildCategoryPagePath(category) || `/propertylist2?category=${encodeURIComponent(category || 'All')}`

const buildThumbnailLabel = (order, t, tv, language) => {
  const category = tv('categories', order.category?.trim()) || t('orders.jobFeed.defaultCategory')
  const location = order.district?.trim() || order.division?.trim() || t('orders.jobFeed.defaultLocation')
  const needFrom = formatOrderNeedFrom(order.property_need_from, language) || t('orders.jobFeed.flexible')
  const budget = formatCurrency(order.max_budget, t)

  return {
    category,
    location,
    rooms: order.rooms || t('orders.jobFeed.flexible'),
    needFrom,
    budget,
  }
}

export default function JobFeedSection({ orders = [], isLoading = false }) {
  const { t, tv, language } = useLanguage()
  const visibleOrders = orders.slice(0, 4)

  return (
    <section className='ui-panel mb-14 px-4 py-8 md:px-6 md:py-10'>
      <div className='flex flex-col gap-3 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between'>
        <div>
          <p className='ui-eyebrow'>
            {t('orders.jobFeed.kicker')}
          </p>
          <h2 className='mt-3 text-2xl font-bold leading-tight text-ink md:text-3xl'>
            {t('orders.jobFeed.title')}
          </h2>
          <p className='mt-2 max-w-2xl text-body text-muted'>
            {t('orders.jobFeed.subtitle')}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className='grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2 xl:grid-cols-3'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className='ui-card animate-pulse p-5'>
              <div className='h-32 rounded-xl bg-slate-200' />
              <div className='mt-4 h-4 w-28 rounded-full bg-gray-200' />
              <div className='mt-4 h-8 w-3/4 rounded-full bg-gray-200' />
              <div className='mt-3 h-20 rounded-2xl bg-gray-100' />
              <div className='mt-4 grid grid-cols-2 gap-3'>
                <div className='h-16 rounded-2xl bg-gray-100' />
                <div className='h-16 rounded-2xl bg-gray-100' />
              </div>
            </div>
          ))}
        </div>
      ) : visibleOrders.length > 0 ? (
        <div className='grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2 xl:grid-cols-4'>
          {visibleOrders.map((order) => {
            const title = order.job_feed_title?.trim() || buildFallbackTitle(order, t, tv)
            const description =
              order.job_feed_description?.trim() || buildFallbackDescription(order, t, language)
            const location = formatLocation(order)
            const thumbnail = buildThumbnailLabel(order, t, tv, language)
            const href = buildCategoryHref(order.category)

            return (
              <Link
                key={order.id}
                to={href}
                className='ui-card ui-card-interactive block p-5'
              >
                <div className='relative overflow-hidden rounded-xl bg-ink p-4 text-white'>
                  <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_38%)]' />
                  <div className='absolute -right-8 bottom-0 h-20 w-20 rounded-full border border-white/15 bg-white/10' />
                  <div className='relative'>
                    <div className='inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white'>
                      <BiBuildings className='text-sm' />
                      <span>{thumbnail.category}</span>
                    </div>
                    <div className='mt-4'>
                      <h3 className='text-xl font-bold leading-tight'>{thumbnail.location}</h3>
                      <p className='mt-1 text-sm font-medium text-white/80'>
                        {t('orders.jobFeed.roomsRequired', { rooms: thumbnail.rooms })}
                      </p>
                    </div>
                  </div>
                </div>






                <div className='mt-4 space-y-3'>


                  <div className='rounded-xl  border-gray-200 bg-white/90 p-3'>
                    <div className='space-y-2 text-sm'>

                      <div className='flex items-center justify-between gap-3 border-b border-dashed border-gray-200 pb-2'>
                        <span className='font-semibold text-gray-500'>{t('orders.jobFeed.needFromLabel')}</span>
                        <span className='text-right font-bold text-gray-900'>{thumbnail.needFrom}</span>
                      </div>
                      <div className='flex items-center justify-between gap-3'>
                        <span className='font-semibold text-gray-500'>{t('orders.jobFeed.budgetLabel')}</span>
                        <span className='text-right font-bold text-gray-900 line-clamp-1'>{thumbnail.budget}</span>
                      </div>
                    </div>
                  </div>
                </div>


              </Link>
            )
          })}
        </div>
      ) : (
        <div className='pt-6'>
          <div className='rounded-[var(--radius-panel)] border border-dashed border-line bg-canvas px-6 py-12 text-center'>
            <div className='ui-badge ui-badge-brand text-sm'>
              <BiBriefcaseAlt2 className='text-base' />
              <span>{t('orders.jobFeed.emptyBadge')}</span>
            </div>
            <h3 className='mt-4 text-lg font-semibold text-ink'>{t('orders.jobFeed.emptyTitle')}</h3>
            <p className='mx-auto mt-2 max-w-xl text-caption text-muted'>
              {t('orders.jobFeed.emptyDescription')}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
