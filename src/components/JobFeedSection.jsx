'use client'

import { Link } from 'react-router-dom'
import { BiBriefcaseAlt2, BiBuildings } from 'react-icons/bi'
import { FiCalendar, FiClock, FiMapPin } from 'react-icons/fi'
import {
  formatOrderNeedFrom,
  formatOrderPreferencesSummary,
} from '../utils/orderPreferences'

const formatCurrency = (value) => {
  if (!value) {
    return 'Budget not specified'
  }

  return `BDT ${Number(value).toLocaleString()}`
}

const formatPostedDate = (value) => {
  if (!value) {
    return 'Recently posted'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Recently posted'
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatLocation = (order) =>
  [order.sub_area, order.area, order.district, order.division]
    .filter(Boolean)
    .join(', ')

const buildFallbackTitle = (order) => {
  const category = order.category || 'Home'
  const location = formatLocation(order)
  return location ? `${category} needed in ${location}` : `${category} requirement posted`
}

const buildFallbackDescription = (order) => {
  const summary = formatOrderPreferencesSummary(order.additional_preferences)
  if (summary) {
    return summary
  }

  const parts = []
  if (order.rooms) {
    parts.push(`${order.rooms} room requirement`)
  }
  if (order.max_budget) {
    parts.push(`Budget up to ${formatCurrency(order.max_budget)}`)
  }
  if (order.property_need_from) {
    parts.push(`Need from ${formatOrderNeedFrom(order.property_need_from)}`)
  }

  return parts.join(' | ') || 'Customer requirement posted from the Order Home flow.'
}

const buildCategoryHref = (category) => {
  const encodedCategory = encodeURIComponent(category || 'All')
  return `/propertylist2?category=${encodedCategory}`
}

export default function JobFeedSection({ orders = [], isLoading = false }) {
  if (!isLoading && orders.length === 0) {
    return null
  }

  return (
    <section className='mb-14 rounded-[32px] border border-gray-200 bg-white px-4 py-8 shadow-sm md:px-6 md:py-10'>
      <div className='flex flex-col gap-3 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.35em] text-[#1E73B8]'>
            Job Feed
          </p>
          <h2 className='mt-3 text-3xl font-bold text-gray-800 md:text-4xl'>
            Order Home job feed from confirmed customer requests
          </h2>
          <p className='mt-2 text-sm text-gray-500 md:text-base'>
            This upper feed highlights confirmed Order Home requests that admins choose to publish.
          </p>
        </div>
        {orders.length > 0 && (
          <div className='inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white'>
            <BiBriefcaseAlt2 className='text-base' />
            <span>{orders.length} confirmed jobs</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className='grid grid-cols-1 gap-5 pt-6 lg:grid-cols-2 xl:grid-cols-3'>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className='animate-pulse rounded-3xl border border-gray-200 p-6'>
              <div className='h-4 w-28 rounded-full bg-gray-200' />
              <div className='mt-4 h-8 w-3/4 rounded-full bg-gray-200' />
              <div className='mt-3 h-20 rounded-2xl bg-gray-100' />
              <div className='mt-4 grid grid-cols-2 gap-3'>
                <div className='h-16 rounded-2xl bg-gray-100' />
                <div className='h-16 rounded-2xl bg-gray-100' />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-5 pt-6 lg:grid-cols-2 xl:grid-cols-3'>
          {orders.map((order) => {
            const title = order.job_feed_title?.trim() || buildFallbackTitle(order)
            const description =
              order.job_feed_description?.trim() || buildFallbackDescription(order)
            const location = formatLocation(order)

            return (
              <article
                key={order.id}
                className='rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-sm transition-shadow duration-300 hover:shadow-lg'
              >
                <div className='flex items-start justify-between gap-4'>
                  <div className='inline-flex items-center gap-2 rounded-full bg-[#1E73B8]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#1E73B8]'>
                    <BiBriefcaseAlt2 className='text-sm' />
                    <span>Ordered Home</span>
                  </div>
                  <div className='inline-flex items-center gap-1 text-xs font-medium text-gray-500'>
                    <FiClock className='text-sm' />
                    <span>{formatPostedDate(order.job_feed_posted_at || order.created_at)}</span>
                  </div>
                </div>

                <h3 className='mt-5 text-xl font-bold leading-8 text-gray-900'>{title}</h3>
                <p className='mt-3 min-h-[72px] text-sm leading-6 text-gray-600'>{description}</p>

                <div className='mt-5 space-y-3'>
                  <div className='flex items-start gap-2 text-sm text-gray-600'>
                    <FiMapPin className='mt-0.5 flex-shrink-0 text-[#1E73B8]' />
                    <span>{location || 'Location not specified'}</span>
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='rounded-2xl bg-[#1E73B8]/5 p-4'>
                      <p className='text-xs font-semibold uppercase tracking-[0.18em] text-[#1E73B8]'>
                        Category
                      </p>
                      <p className='mt-2 text-sm font-semibold text-gray-900'>
                        {order.category || 'N/A'}
                      </p>
                    </div>
                    <div className='rounded-2xl bg-emerald-50 p-4'>
                      <p className='text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700'>
                        Rooms
                      </p>
                      <p className='mt-2 text-sm font-semibold text-gray-900'>
                        {order.rooms || 'N/A'}
                      </p>
                    </div>
                    <div className='rounded-2xl bg-amber-50 p-4'>
                      <p className='text-xs font-semibold uppercase tracking-[0.18em] text-amber-700'>
                        Budget
                      </p>
                      <p className='mt-2 text-sm font-semibold text-gray-900'>
                        {formatCurrency(order.max_budget)}
                      </p>
                    </div>
                    <div className='rounded-2xl bg-slate-100 p-4'>
                      <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-600'>
                        Need From
                      </p>
                      <p className='mt-2 text-sm font-semibold text-gray-900'>
                        {formatOrderNeedFrom(order.property_need_from) || 'Flexible'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className='mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-5'>
                  <div className='inline-flex items-center gap-2 text-sm font-medium text-gray-500'>
                    <FiCalendar className='text-sm text-[#1E73B8]' />
                    <span>Posted from Order Home</span>
                  </div>
                  <Link
                    to={buildCategoryHref(order.category)}
                    className='inline-flex items-center gap-2 rounded-full border border-[#1E73B8] px-4 py-2 text-sm font-semibold text-[#1E73B8] transition-colors duration-200 hover:bg-[#1E73B8] hover:text-white'
                  >
                    <BiBuildings className='text-base' />
                    <span>Browse matching homes</span>
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
