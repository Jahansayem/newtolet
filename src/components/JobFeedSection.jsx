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

const buildThumbnailLabel = (order) => {
  const category = order.category?.trim() || 'Home'
  const location = order.district?.trim() || order.division?.trim() || 'Bangladesh'
  const needFrom = formatOrderNeedFrom(order.property_need_from) || 'Flexible'
  const budget = formatCurrency(order.max_budget)

  return {
    category,
    location,
    rooms: order.rooms || 'Flexible',
    needFrom,
    budget,
  }
}

export default function JobFeedSection({ orders = [], isLoading = false }) {
  const visibleOrders = orders.slice(0, 4)

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
            This feed highlights confirmed Order Home requests that admins choose to publish.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className='grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2 xl:grid-cols-3'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className='animate-pulse rounded-3xl border border-gray-200 p-6'>
              <div className='h-32 rounded-[28px] bg-gray-100' />
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
            const title = order.job_feed_title?.trim() || buildFallbackTitle(order)
            const description =
              order.job_feed_description?.trim() || buildFallbackDescription(order)
            const location = formatLocation(order)
            const thumbnail = buildThumbnailLabel(order)
            const href = buildCategoryHref(order.category)

            return (
              <Link
                key={order.id}
                to={href}
                className='block rounded-xl border border-gray-200 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-sm transition-shadow duration-300 hover:shadow-lg'
              >
                <div className='relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1E73B8] via-sky-600 to-cyan-500 p-4 text-white'>
                  <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_38%)]' />
                  <div className='absolute -right-8 bottom-0 h-20 w-20 rounded-full border border-white/15 bg-white/10' />
                  <div className='relative'>
                    <div className='inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white'>
                      <BiBuildings className='text-sm' />
                      <span>{thumbnail.category}</span>
                    </div>
                    <div className='mt-4'>
                      <h3 className='text-xl font-bold leading-tight'>{thumbnail.location}</h3>
                      <p className='mt-1 text-sm font-medium text-white/80'>
                        {thumbnail.rooms} rooms required
                      </p>
                    </div>
                  </div>
                </div>

                

               
                

                <div className='mt-4 space-y-3'>
                 

                  <div className='rounded-xl  border-gray-200 bg-white/90 p-3'>
                    <div className='space-y-2 text-sm'>
                      
                      <div className='flex items-center justify-between gap-3 border-b border-dashed border-gray-200 pb-2'>
                        <span className='font-semibold text-gray-500'>Need From:</span>
                        <span className='text-right font-bold text-gray-900'>{thumbnail.needFrom}</span>
                      </div>
                      <div className='flex items-center justify-between gap-3'>
                        <span className='font-semibold text-gray-500'>Budget:</span>
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
          <div className='rounded-3xl border border-dashed border-gray-200 bg-slate-50 px-6 py-12 text-center'>
            <div className='inline-flex items-center gap-2 rounded-full bg-[#1E73B8]/10 px-4 py-2 text-sm font-semibold text-[#1E73B8]'>
              <BiBriefcaseAlt2 className='text-base' />
              <span>Job feed is ready</span>
            </div>
            <h3 className='mt-4 text-xl font-bold text-gray-900'>No job feed posts published yet</h3>
            <p className='mt-2 text-sm leading-6 text-gray-500 md:text-base'>
              Confirmed Order Home requests will appear here once admins publish them to the homepage job feed.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
