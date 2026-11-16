// Listing-page SEO builders, shared by the listing-seo Edge Function (per-listing <head> tags
// and H1 block that nginx splices into the static page) and the listing page itself
// (re-exported from src/lib/seo/jsonLd.js), so the raw HTML and the rendered page agree.
// Plain JS without imports: Deno, webpack and `node --test` all load this file.

export const SITE_URL = 'https://www.newtolet.com'
export const LISTING_TITLE_MAX = 70
const DESCRIPTION_MAX = 160

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isListingId = (value) => UUID_PATTERN.test(String(value || ''))

export const listingUrl = (id) => `${SITE_URL}/listdetails/?id=${encodeURIComponent(String(id || ''))}`

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const positiveNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text)
const titleCase = (text) => text.replace(/\b[a-z]/g, (char) => char.toUpperCase())

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])

/** Area and district, without repeats ("Dhaka, Dhaka"). */
const placeParts = (property) => {
  const parts = [property.area, property.state_district].map(cleanText).filter(Boolean)
  return parts.filter((part, index) => parts.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index)
}

// Category values stored in properties.category -> the word people search with.
const CATEGORY_WORDS = {
  family: 'Family',
  'family home': 'Family',
  bachelor: 'Bachelor',
  sublet: 'Sublet',
  hostel: 'Hostel',
  'hostel/mess': 'Hostel',
  office: 'Office',
  'office space': 'Office',
  shop: 'Shop',
  factory: 'Factory',
  warehouse: 'Warehouse',
}

// property_type -> noun in "flat vara", "room vara", "mess seat vara".
const NOUNS = {
  apartment: 'flat',
  flat: 'flat',
  duplex: 'flat',
  house: 'house',
  building: 'house',
  room: 'room',
  'single room': 'room',
  'shared room': 'room',
  seat: 'mess seat',
  mess: 'mess seat',
  hostel: 'mess seat',
  hotel: 'hotel room',
  office: 'office space',
  'office space': 'office space',
  shop: 'shop',
  factory: 'factory',
  warehouse: 'warehouse',
}

const categoryKey = (property) => cleanText(property.category).toLowerCase()

const propertyNoun = (property) => {
  const type = cleanText(property.property_type).toLowerCase()
  // A "Unit" is part of a flat: a room for sublets and bachelors, a flat for families.
  if (type === 'unit') return CATEGORY_WORDS[categoryKey(property)] === 'Family' ? 'flat' : 'room'
  return NOUNS[type] || type || categoryKey(property) || 'property'
}

/** Bedroom counts only make sense for whole flats and houses. */
const bedroomsFor = (property, noun) => (noun === 'flat' || noun === 'house' ? positiveNumber(property.total_rooms) : null)

// Category words that say nothing beyond the noun ("Office office space", "Hostel mess seat").
const REDUNDANT_CATEGORY = { Hostel: ['mess seat', 'hotel room'], Office: ['office space'], Shop: ['shop'], Factory: ['factory'], Warehouse: ['warehouse'] }

const categoryWord = (property, noun) => {
  const word = CATEGORY_WORDS[categoryKey(property)] || cleanText(property.category)
  if (!word || word.toLowerCase() === noun || (REDUNDANT_CATEGORY[word] || []).includes(noun)) return ''
  return word
}

const rentAmount = (property) => (property.is_rent_negotiable ? null : positiveNumber(property.rent_amount_bdt))
const takaLabel = (amount) => `৳${amount.toLocaleString('en-US')}/month`

/** Short headline, e.g. "3-bed Family Apartment for rent in Mirpur, Dhaka" (breadcrumbs, JSON-LD name). */
export function listingHeadline(property = {}) {
  const beds = positiveNumber(property.total_rooms)
  const type = cleanText(property.property_type || property.category || 'Property')
  const category = cleanText(property.category)
  const kind = category && category.toLowerCase() !== type.toLowerCase() ? `${category} ${type}` : type
  const place = placeParts(property).join(', ')
  return `${beds ? `${beds}-bed ` : ''}${kind} for rent${place ? ` in ${place}` : ''}`
}

export function listingPriceLabel(property = {}) {
  const amount = rentAmount(property)
  return amount ? `Tk ${amount.toLocaleString('en-US')}/month` : 'Rent negotiable'
}

/** Page H1, e.g. "3 Bedroom Family Flat for Rent in Mirpur, Dhaka". */
export function listingH1(property = {}) {
  const noun = propertyNoun(property)
  const beds = bedroomsFor(property, noun)
  const lead = [beds ? `${beds} Bedroom` : '', categoryWord(property, noun), titleCase(noun)].filter(Boolean).join(' ')
  const place = placeParts(property).join(', ')
  return `${lead} for Rent${place ? ` in ${place}` : ''}`
}

/**
 * <title>, e.g. "Family 3 bed flat vara in Mirpur, Dhaka – ৳18,000/month | NewTolet".
 * Drops the district when the full title would be longer than LISTING_TITLE_MAX.
 */
export function listingDocumentTitle(property = {}) {
  const noun = propertyNoun(property)
  const beds = bedroomsFor(property, noun)
  const lead = capitalize([categoryWord(property, noun), beds ? `${beds} bed` : '', `${noun} vara`].filter(Boolean).join(' '))
  const amount = rentAmount(property)
  const price = amount ? ` – ${takaLabel(amount)}` : ''
  const places = placeParts(property)
  const build = (parts) => `${lead}${parts.length ? ` in ${parts.join(', ')}` : ''}${price} | NewTolet`
  const full = build(places)
  return full.length > LISTING_TITLE_MAX && places.length > 1 ? build(places.slice(0, 1)) : full
}

const clampText = (text, max) => {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`
}

/** Meta description, at most 160 characters: headline, rent, size, facilities, "basa vara". */
export function listingDescription(property = {}) {
  const amount = rentAmount(property)
  const facts = [
    positiveNumber(property.total_bathrooms) ? `${property.total_bathrooms} bath` : '',
    positiveNumber(property.size_sqft) ? `${Number(property.size_sqft).toLocaleString('en-US')} sq ft` : '',
  ].filter(Boolean)
  const amenities = (Array.isArray(property.amenities) ? property.amenities : []).map(cleanText).filter(Boolean)
  const parts = [
    `${listingH1(property)}.`,
    amount ? `Rent ${takaLabel(amount)}.` : 'Rent negotiable.',
    facts.length ? `${facts.join(', ')}.` : '',
    amenities.length ? `${amenities.slice(0, 3).join(', ')}.` : '',
    'Basa vara on NewTolet.',
  ].filter(Boolean)
  let text = parts.join(' ')
  const summary = cleanText(property.short_description)
  if (summary && text.length < 140) text = `${text} ${summary}`
  return clampText(text, DESCRIPTION_MAX)
}

/** Photo alt text, e.g. "3 bedroom flat vara Mirpur – photo 2". */
export function listingImageAlt(property = {}, number = 1) {
  const noun = propertyNoun(property)
  const beds = bedroomsFor(property, noun)
  const place = placeParts(property)[0]
  return `${beds ? `${beds} bedroom ` : ''}${noun} vara${place ? ` ${place}` : ''} – photo ${number}`
}

const ACCOMMODATION_TYPES = { flat: 'Apartment', house: 'House', room: 'Room', 'mess seat': 'Room', 'hotel room': 'Room' }

/** RealEstateListing (with the Apartment/House/Room it is about) + BreadcrumbList. */
export function listingJsonLd(property = {}, { url, images = [] } = {}) {
  const pageUrl = url || listingUrl(property.id)
  const amount = rentAmount(property)
  const noun = propertyNoun(property)
  const address = {
    '@type': 'PostalAddress',
    addressLocality: cleanText(property.area) || undefined,
    addressRegion: cleanText(property.state_district) || undefined,
    addressCountry: 'BD',
  }
  const hasGeo = Number.isFinite(Number(property.lat)) && Number.isFinite(Number(property.lng)) && property.lat && property.lng
  const accommodationType = ACCOMMODATION_TYPES[noun]
  const amenities = (Array.isArray(property.amenities) ? property.amenities : []).map(cleanText).filter(Boolean)
  const size = positiveNumber(property.size_sqft)

  const listing = {
    '@type': 'RealEstateListing',
    '@id': `${pageUrl}#listing`,
    name: listingHeadline(property),
    description: listingDescription(property),
    url: pageUrl,
    datePosted: property.created_at || undefined,
    image: images.filter(Boolean).slice(0, 6),
    contentLocation: {
      '@type': 'Place',
      address,
      ...(hasGeo ? { geo: { '@type': 'GeoCoordinates', latitude: Number(property.lat), longitude: Number(property.lng) } } : {}),
    },
    ...(accommodationType
      ? {
          about: {
            '@type': accommodationType,
            name: listingH1(property),
            address,
            numberOfRooms: positiveNumber(property.total_rooms) || undefined,
            numberOfBathroomsTotal: positiveNumber(property.total_bathrooms) || undefined,
            ...(size ? { floorSize: { '@type': 'QuantitativeValue', value: size, unitCode: 'FTK' } } : {}),
            ...(amenities.length
              ? { amenityFeature: amenities.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })) }
              : {}),
          },
        }
      : {}),
    ...(amount
      ? {
          offers: {
            '@type': 'Offer',
            price: amount,
            priceCurrency: 'BDT',
            businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  }

  const listingIndex = `${SITE_URL}/bd/property-listing/`
  const district = cleanText(property.state_district)
  const crumbs = [
    { name: 'Home', item: `${SITE_URL}/` },
    { name: 'Properties', item: listingIndex },
    district ? { name: district, item: `${listingIndex}?search=${encodeURIComponent(district)}` } : null,
    { name: listingHeadline(property), item: pageUrl },
  ].filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      listing,
      {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })),
      },
    ],
  }
}

// JSON inside <script> must not be able to close the tag.
const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

/**
 * Per-listing <head> tags for the static listing page. `property` is null when the id is
 * unknown, rented, expired or deleted: the page is then marked noindex.
 */
export function buildListingHeadHtml(property, { images = [] } = {}) {
  if (!property) {
    return [
      '<title>Listing not available | NewTolet</title>',
      '<meta name="description" content="This listing is no longer available on NewTolet. Browse current flats, rooms and sublets for rent across Bangladesh."/>',
      '<meta name="robots" content="noindex, follow"/>',
    ].join('')
  }
  const url = listingUrl(property.id)
  const title = escapeHtml(listingDocumentTitle(property))
  const description = escapeHtml(listingDescription(property))
  const photos = images.filter((image) => typeof image === 'string' && /^https?:\/\//.test(image))
  const image = photos[0] ? escapeHtml(photos[0]) : ''
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}"/>`,
    `<link rel="canonical" href="${escapeHtml(url)}"/>`,
    `<meta property="og:title" content="${title}"/>`,
    `<meta property="og:description" content="${description}"/>`,
    `<meta property="og:url" content="${escapeHtml(url)}"/>`,
    image ? `<meta property="og:image" content="${image}"/>` : '',
    `<meta name="twitter:title" content="${title}"/>`,
    `<meta name="twitter:description" content="${description}"/>`,
    image ? `<meta name="twitter:image" content="${image}"/>` : '',
    `<script type="application/ld+json" id="page-jsonld">${scriptJson(listingJsonLd(property, { url, images: photos }))}</script>`,
  ].join('')
}

const isoDay = (value) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : ''
}

/**
 * Server-rendered summary with the page's only H1, for crawlers and visitors without
 * JavaScript. The listing page removes it once it renders the same listing itself.
 */
export function buildListingBodyHtml(property) {
  if (!property) return ''
  const amount = rentAmount(property)
  const noun = propertyNoun(property)
  const facts = [
    ['Category', cleanText(property.category)],
    ['Property type', cleanText(property.property_type)],
    ['Bedrooms', bedroomsFor(property, noun) || ''],
    ['Bathrooms', positiveNumber(property.total_bathrooms) || ''],
    ['Balcony', positiveNumber(property.balcony) || ''],
    ['Size', positiveNumber(property.size_sqft) ? `${Number(property.size_sqft).toLocaleString('en-US')} sq ft` : ''],
    ['Floor', cleanText(property.floor_level)],
    ['Available from', isoDay(property.available_from)],
    ['Location', [property.sub_area, ...placeParts(property)].map(cleanText).filter(Boolean).join(', ')],
  ].filter(([, value]) => value !== '' && value !== null && value !== undefined)
  const amenities = (Array.isArray(property.amenities) ? property.amenities : []).map(cleanText).filter(Boolean)
  const summary = cleanText(property.short_description)

  return [
    '<section id="listing-ssr" style="max-width:72rem;margin:2rem auto;padding:0 1rem;line-height:1.6">',
    '<nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/bd/property-listing/">Properties for rent</a></nav>',
    `<h1>${escapeHtml(listingH1(property))}</h1>`,
    `<p><strong>Rent:</strong> ${escapeHtml(amount ? takaLabel(amount) : 'Negotiable')}</p>`,
    `<ul>${facts.map(([label, value]) => `<li>${label}: ${escapeHtml(value)}</li>`).join('')}</ul>`,
    amenities.length ? `<p><strong>Facilities:</strong> ${escapeHtml(amenities.join(', '))}</p>` : '',
    summary ? `<p>${escapeHtml(summary)}</p>` : '',
    '<p><a href="/bd/property-listing/">Browse more flats, rooms and sublets for rent</a></p>',
    '</section>',
  ].join('')
}
