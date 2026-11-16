// Facebook Page post text for a newly approved listing, used by the facebook-page-post
// Edge Function. Plain JS without Deno imports so `node --test` can load it.
//
// Only public listing fields go in: never contact_number, user_id, road, house_plot or
// anything else public_property_catalog leaves out.

import { listingH1, listingUrl } from './listingSeo.js'

/** Facebook allows ~63k characters; keep posts readable in the feed. */
export const MESSAGE_MAX = 1500
/** attached_media accepts more, but 10 photos is the practical feed limit. */
export const MAX_PHOTOS = 10

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const positiveNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

const formatDate = (value) => {
  const text = cleanText(value)
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return ''
  const date = new Date(`${text.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const hashtag = (value) => {
  const word = cleanText(value).replace(/[^\p{L}\p{N}]+/gu, '')
  return word ? `#${word}` : ''
}

const clamp = (text, max) => {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

const PERIOD_UNITS = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }

/** "৳18,000/month", "৳18,000/month (negotiable)" or "Negotiable". */
export function facebookRentLabel(property = {}) {
  const amount = positiveNumber(property.rent_amount_bdt)
  const period = cleanText(property.rent_period).toLowerCase()
  const unit = `/${PERIOD_UNITS[period] || 'month'}`
  if (!amount) return 'Negotiable'
  return `৳${amount.toLocaleString('en-US')}${unit}${property.is_rent_negotiable ? ' (negotiable)' : ''}`
}

/**
 * Post text, e.g.
 *   🏠 3 Bedroom Family Flat for Rent in Mirpur, Dhaka
 *   💰 Rent: ৳18,000/month
 *   🛏 3 bed · 🚿 2 bath · 📐 1,200 sq ft · 🏢 Floor 4
 *   📅 Available from 1 Dec 2026
 *   <short description>
 *   👉 Details & contact: https://www.newtolet.com/listdetails/?id=…
 *   #NewTolet #ToLet #Mirpur #Dhaka #BasaVara
 */
export function buildFacebookPostMessage(property = {}, { amenities = [] } = {}) {
  const facts = [
    positiveNumber(property.total_rooms) ? `🛏 ${property.total_rooms} bed` : '',
    positiveNumber(property.total_bathrooms) ? `🚿 ${property.total_bathrooms} bath` : '',
    positiveNumber(property.room_size_sqft) ? `📐 ${Number(property.room_size_sqft).toLocaleString('en-US')} sq ft` : '',
    cleanText(property.floor_level) ? `🏢 Floor ${cleanText(property.floor_level)}` : '',
  ].filter(Boolean)

  const where = [property.sub_area, property.area, property.state_district].map(cleanText).filter(Boolean)
  const uniqueWhere = where.filter((part, index) => where.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index)
  const amenityList = (Array.isArray(amenities) ? amenities : []).map(cleanText).filter(Boolean).slice(0, 6)
  const available = formatDate(property.available_from)
  const ref = cleanText(property.property_id_number)

  const head = [
    `🏠 ${listingH1(property)}`,
    `💰 Rent: ${facebookRentLabel(property)}`,
    uniqueWhere.length ? `📍 ${uniqueWhere.join(', ')}` : '',
    facts.length ? facts.join(' · ') : '',
    amenityList.length ? `✅ ${amenityList.join(', ')}` : '',
    available ? `📅 Available from ${available}` : '',
  ].filter(Boolean)

  const tags = ['#NewTolet', '#ToLet', hashtag(property.area), hashtag(property.state_district), '#BasaVara']
  const uniqueTags = [...new Set(tags.filter(Boolean))]
  const tail = [
    `👉 Details & contact: ${listingUrl(property.id)}`,
    ref ? `Ref: NT-${ref}` : '',
    '',
    uniqueTags.join(' '),
  ].filter((line, index, lines) => line !== '' || index === lines.length - 2)

  const fixed = `${head.join('\n')}\n\n\n${tail.join('\n')}`
  const summary = cleanText(property.short_description)
  const room = MESSAGE_MAX - fixed.length
  const body = summary && room > 40 ? `\n\n${clamp(summary, room)}` : ''
  return `${head.join('\n')}${body}\n\n${tail.join('\n')}`
}

/** Public http(s) image URLs, in order, without duplicates, at most MAX_PHOTOS. */
export function facebookPhotoUrls(images = []) {
  const urls = []
  for (const entry of Array.isArray(images) ? images : []) {
    const url = cleanText(typeof entry === 'string' ? entry : entry?.image_url)
    if (!/^https?:\/\//i.test(url) || urls.includes(url)) continue
    urls.push(url)
    if (urls.length >= MAX_PHOTOS) break
  }
  return urls
}

/** Minutes to wait before retry n (1-based): 2, 8, 30, 120, then give up. */
export const RETRY_DELAYS_MINUTES = [2, 8, 30, 120]
export const MAX_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1

export function nextRetryDelayMinutes(attempts) {
  const index = Math.max(0, Number(attempts) - 1)
  return index < RETRY_DELAYS_MINUTES.length ? RETRY_DELAYS_MINUTES[index] : null
}
