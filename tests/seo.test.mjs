import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRouteMetadata, routeMetadata, SITE_URL } from '../src/lib/seo/siteMeta.js'
import {
  listingDescription,
  listingDocumentTitle,
  listingH1,
  listingHeadline,
  listingImageAlt,
  listingJsonLd,
  listingPriceLabel,
  siteJsonLd,
} from '../src/lib/seo/jsonLd.js'
import {
  buildListingBodyHtml,
  buildListingHeadHtml,
  isListingId,
  LISTING_TITLE_MAX,
} from '../supabase/functions/_shared/listingSeo.js'
import { addListingSsi } from '../scripts/listing-ssi.mjs'
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
  assert.equal(listingDocumentTitle(property), 'Family 3 bed flat vara in Mirpur, Dhaka – ৳15,000/month | NewTolet')
  assert.equal(listingH1(property), '3 Bedroom Family Flat for Rent in Mirpur, Dhaka')
  assert.equal(listingImageAlt(property, 2), '3 bedroom flat vara Mirpur – photo 2')
})

test('listing titles stay short and differ per listing', () => {
  const long = { property_type: 'Apartment', category: 'Family', total_rooms: 4, area: 'Mohammadpur Housing Society', state_district: 'Dhaka', rent_amount_bdt: 125000 }
  // Too long with the district: the district goes first, the area stays.
  assert.equal(listingDocumentTitle(long), 'Family 4 bed flat vara in Mohammadpur Housing Society – ৳125,000/month | NewTolet')
  assert.ok(listingDocumentTitle({ ...long, area: 'Mirpur', rent_amount_bdt: 25000 }).length <= LISTING_TITLE_MAX)
  assert.equal(listingDocumentTitle({ property_type: 'Room', category: 'Bachelor', area: 'Uttara', is_rent_negotiable: true }), 'Bachelor room vara in Uttara | NewTolet')
  assert.equal(listingDocumentTitle({ property_type: 'Hostel', category: 'Hostel/Mess', area: 'Farmgate', rent_amount_bdt: 4000 }), 'Mess seat vara in Farmgate – ৳4,000/month | NewTolet')
})

test('stored category/type values map to searched words', () => {
  const words = (category, property_type) => listingH1({ category, property_type, total_rooms: 2 })
  assert.equal(words('Family Home', 'Apartment'), '2 Bedroom Family Flat for Rent')
  assert.equal(words('Sublet', 'Unit'), 'Sublet Room for Rent')
  assert.equal(words('Bachelor', 'Unit'), 'Bachelor Room for Rent')
  assert.equal(words('Family', 'Unit'), '2 Bedroom Family Flat for Rent')
  assert.equal(words('Bachelor', 'Hostel'), 'Bachelor Mess Seat for Rent')
  assert.equal(words('Office Space', 'Office Space'), 'Office Space for Rent')
  assert.equal(words('Shop', 'Shop'), 'Shop for Rent')
  assert.equal(words('Family Home', 'Building'), '2 Bedroom Family House for Rent')
})

test('listing description is at most 160 characters and mentions basa vara', () => {
  const description = listingDescription({
    property_type: 'Apartment', category: 'Family', total_rooms: 3, total_bathrooms: 2, size_sqft: 1200,
    area: 'Mirpur 10', state_district: 'Dhaka', rent_amount_bdt: 18000, amenities: ['Lift', 'Gas', 'Parking', 'Generator'],
    short_description: 'South facing flat near the metro station with a wide balcony and 24 hour security.',
  })
  assert.ok(description.length <= 160, description)
  assert.match(description, /^3 Bedroom Family Flat for Rent in Mirpur 10, Dhaka\. Rent ৳18,000\/month\. 2 bath, 1,200 sq ft\. Lift, Gas, Parking\./)
  assert.match(listingDescription({ property_type: 'Room', area: 'Uttara' }), /Basa vara on NewTolet\./)
})

test('listing head HTML: escaped, canonical with id, JSON-LD cannot close its script', () => {
  const id = 'c9d8a299-67c9-415d-92b9-ba0805ebbda0'
  const head = buildListingHeadHtml(
    { id, property_type: 'Apartment', category: 'Family', area: 'Mirpur "10"', state_district: 'Dhaka', rent_amount_bdt: 18000, short_description: '</script><b>hi</b>' },
    { images: ['https://api.newtolet.com/a.jpg', 'javascript:alert(1)'] },
  )
  assert.match(head, new RegExp(`<link rel="canonical" href="${SITE_URL}/listdetails/\\?id=${id}"/>`))
  assert.match(head, /<title>Family flat vara in Mirpur &quot;10&quot;, Dhaka – ৳18,000\/month \| NewTolet<\/title>/)
  assert.match(head, /<meta property="og:image" content="https:\/\/api\.newtolet\.com\/a\.jpg"\/>/)
  assert.doesNotMatch(head, /javascript:/)
  assert.equal(head.split('</script>').length, 2)
  assert.doesNotMatch(head, /noindex/)
  const ld = JSON.parse(head.match(/<script type="application\/ld\+json" id="page-jsonld">(.*)<\/script>/)[1])
  assert.equal(ld['@graph'][0].about['@type'], 'Apartment')
  assert.equal(ld['@graph'][0].offers.businessFunction, 'http://purl.org/goodrelations/v1#LeaseOut')
})

test('missing listings are noindex and get no H1 block', () => {
  assert.match(buildListingHeadHtml(null), /<meta name="robots" content="noindex, follow"\/>/)
  assert.doesNotMatch(buildListingHeadHtml(null), /canonical/)
  assert.equal(buildListingBodyHtml(null), '')
  assert.equal(isListingId('../etc'), false)
})

test('listing body HTML has one escaped H1 and only public facts', () => {
  const body = buildListingBodyHtml({
    id: 'x', property_type: 'Apartment', category: 'Family', total_rooms: 2, area: 'Uttara', state_district: 'Dhaka',
    rent_amount_bdt: 15000, amenities: ['Lift'], short_description: '<img src=x onerror=alert(1)>', contact_number: '01700000000',
  })
  assert.equal(body.match(/<h1>/g).length, 1)
  assert.match(body, /<h1>2 Bedroom Family Flat for Rent in Uttara, Dhaka<\/h1>/)
  assert.match(body, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(body, /01700000000/)
})

test('listing page SSI patch keeps the generic tags as the fallback stub', () => {
  const html = '<html><head><meta charSet="utf-8"/><title>Property Details | NewTolet.Com</title><meta name="description" content="Generic"/><meta name="author" content="NewTolet.Com"/><meta property="og:title" content="Property Details | NewTolet.Com"/><meta property="og:description" content="Generic"/><meta property="og:site_name" content="NewTolet.Com"/><meta name="twitter:card" content="summary"/><meta name="twitter:title" content="Property Details | NewTolet.Com"/><meta name="twitter:description" content="Generic"/></head><body><main></main><script>x</script></body></html>'
  const patched = addListingSsi(html)
  assert.match(patched, /<!--# block name="seo_head" --><title>Property Details \| NewTolet\.Com<\/title><meta name="description" content="Generic"\/><meta property="og:title"[^>]*><meta property="og:description"[^>]*><meta name="twitter:title"[^>]*><meta name="twitter:description" content="Generic"\/><!--# endblock --><!--# include virtual="\/__seo\/head\?id=\$arg_id" stub="seo_head" --><meta name="author"/)
  assert.equal(patched.split('og:title').length, 2)
  assert.match(patched, /<!--# include virtual="\/__seo\/body\?id=\$arg_id" stub="seo_none" --><\/body>/)
  assert.equal(patched.split('twitter:title').length, 2)
  assert.equal(addListingSsi(patched), patched)
  assert.throws(() => addListingSsi('<html><head><title>x</title></head><body></body></html>'), /markup changed/)
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
