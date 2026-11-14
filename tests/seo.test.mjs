import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRouteMetadata, routeMetadata, SITE_URL } from '../src/lib/seo/siteMeta.js'
import {
  listingDocumentTitle,
  listingHeadline,
  listingJsonLd,
  listingPriceLabel,
  siteJsonLd,
} from '../src/lib/seo/jsonLd.js'
import { buildSitemapXml, escapeXml } from '../supabase/functions/sitemap/build.js'
import { getRoutePage } from '../src/lib/routePaths.js'

test('canonical host is www.newtolet.com, never thetolet', () => {
  assert.equal(SITE_URL, 'https://www.newtolet.com')
  const meta = routeMetadata('listing')
  assert.equal(meta.alternates.canonical, '/bd/property-listing/')
  assert.equal(meta.openGraph.url, '/bd/property-listing/')
  assert.doesNotMatch(JSON.stringify(meta), /thetolet/)
  assert.doesNotMatch(JSON.stringify(siteJsonLd()), /thetolet/)
})

test('route metadata adds a trailing slash and noindex for private pages', () => {
  assert.equal(buildRouteMetadata({ title: 't', description: 'd', path: '/about' }).alternates.canonical, '/about/')
  assert.deepEqual(routeMetadata('login').robots, { index: false, follow: true })
  assert.equal(routeMetadata('about').robots, undefined)
})

test('listing headline and title are descriptive', () => {
  const property = {
    id: 'c9d8a299-67c9-415d-92b9-ba0805ebbda0',
    property_type: 'Apartment',
    category: 'Family',
    total_rooms: 3,
    area: 'Mirpur',
    state_district: 'Dhaka',
    rent_amount_bdt: 15000,
  }
  assert.equal(listingHeadline(property), '3-bed Family Apartment for rent in Mirpur, Dhaka')
  assert.equal(listingDocumentTitle(property), '3-bed Family Apartment for rent in Mirpur, Dhaka - Tk 15,000/month | NewTolet')
})

test('negotiable or placeholder rent never shows as a price', () => {
  assert.equal(listingPriceLabel({ rent_amount_bdt: 15000, is_rent_negotiable: true }), 'Rent negotiable')
  assert.equal(listingPriceLabel({ rent_amount_bdt: null }), 'Rent negotiable')
  const ld = listingJsonLd({ id: 'x', rent_amount_bdt: 9000, is_rent_negotiable: true })
  assert.equal(ld['@graph'][0].offers, undefined)
})

test('listing JSON-LD has RealEstateListing, offer, geo and breadcrumbs', () => {
  const ld = listingJsonLd(
    { id: 'abc', property_type: 'Room', area: 'Uttara', state_district: 'Dhaka', rent_amount_bdt: 6000, lat: 23.87, lng: 90.39 },
    { url: `${SITE_URL}/listdetails/?id=abc`, images: ['https://api.newtolet.com/a.jpg'] },
  )
  const [listing, crumbs] = ld['@graph']
  assert.equal(listing['@type'], 'RealEstateListing')
  assert.equal(listing.offers.price, 6000)
  assert.equal(listing.offers.priceCurrency, 'BDT')
  assert.equal(listing.contentLocation.geo.latitude, 23.87)
  assert.equal(crumbs['@type'], 'BreadcrumbList')
  assert.equal(crumbs.itemListElement.at(-1).item, `${SITE_URL}/listdetails/?id=abc`)
})

test('sitemap lists static pages, divisions and valid listing ids only', () => {
  const xml = buildSitemapXml([
    { id: 'c9d8a299-67c9-415d-92b9-ba0805ebbda0', updated_at: '2026-11-10T08:00:00Z' },
    { id: 'not-a-uuid' },
  ])
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<loc>https:\/\/www\.newtolet\.com\/<\/loc>/)
  assert.match(xml, /<loc>https:\/\/www\.newtolet\.com\/bd\/property-division\/sylhet\/<\/loc>/)
  assert.match(xml, /listdetails\/\?id=c9d8a299-67c9-415d-92b9-ba0805ebbda0<\/loc>\n    <lastmod>2026-11-10<\/lastmod>/)
  assert.doesNotMatch(xml, /not-a-uuid/)
  assert.equal(escapeXml('a&b<c>'), 'a&amp;b&lt;c&gt;')
})

test('?page= is a legacy page key only on the home path', () => {
  assert.equal(getRoutePage('/', new URLSearchParams('page=about')), 'about')
  assert.equal(getRoutePage('/', new URLSearchParams('page=2')), '')
  assert.equal(getRoutePage('/bd/property-listing/', new URLSearchParams('page=2')), 'propertylist2')
  assert.equal(getRoutePage('/login/'), 'login')
})
