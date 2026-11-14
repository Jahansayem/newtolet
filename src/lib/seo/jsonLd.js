// schema.org JSON-LD builders. Pure functions so they can be unit-tested with node --test.
import { SITE_CONTACT } from '../../config/siteContact.js'
import { SITE_NAME, SITE_URL, absoluteUrl } from './siteMeta.js'

export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/favicon-512x512.png`,
        email: SITE_CONTACT.email,
        telephone: SITE_CONTACT.phoneDisplay.replace(/\s+/g, ''),
        address: {
          '@type': 'PostalAddress',
          addressLocality: SITE_CONTACT.addressLocality,
          addressRegion: SITE_CONTACT.addressRegion,
          addressCountry: SITE_CONTACT.addressCountry,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        inLanguage: ['en', 'bn'],
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/bd/property-listing/?search={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const positiveNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

/** Human title for a listing, e.g. "3-bed Family Apartment for rent in Mirpur, Dhaka". */
export function listingHeadline(property = {}) {
  const beds = positiveNumber(property.total_rooms)
  const type = cleanText(property.property_type || property.category || 'Property')
  const category = cleanText(property.category)
  const kind = category && category.toLowerCase() !== type.toLowerCase() ? `${category} ${type}` : type
  const place = [property.area, property.state_district].map(cleanText).filter(Boolean)
  const uniquePlace = place.filter((part, index) => place.indexOf(part) === index).join(', ')
  return `${beds ? `${beds}-bed ` : ''}${kind} for rent${uniquePlace ? ` in ${uniquePlace}` : ''}`
}

export function listingPriceLabel(property = {}) {
  const amount = positiveNumber(property.rent_amount_bdt)
  if (property.is_rent_negotiable || !amount) return 'Rent negotiable'
  return `Tk ${amount.toLocaleString('en-US')}/month`
}

/** Document title for the detail page. */
export function listingDocumentTitle(property = {}) {
  return `${listingHeadline(property)} - ${listingPriceLabel(property)} | NewTolet`
}

export function listingDescription(property = {}) {
  const parts = [
    listingHeadline(property),
    listingPriceLabel(property),
    positiveNumber(property.total_bathrooms) ? `${property.total_bathrooms} bath` : '',
    positiveNumber(property.size_sqft) ? `${property.size_sqft} sq ft` : '',
  ].filter(Boolean)
  const summary = cleanText(property.short_description).slice(0, 110)
  return `${parts.join(' · ')}${summary ? `. ${summary}` : ''}`.slice(0, 300)
}

/** RealEstateListing + BreadcrumbList for one property detail page. */
export function listingJsonLd(property = {}, { url, images = [] } = {}) {
  const pageUrl = url || absoluteUrl(`/listdetails/?id=${property.id || ''}`)
  const amount = positiveNumber(property.rent_amount_bdt)
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
      address: {
        '@type': 'PostalAddress',
        addressLocality: cleanText(property.area) || undefined,
        addressRegion: cleanText(property.state_district) || undefined,
        addressCountry: 'BD',
      },
      ...(Number.isFinite(Number(property.lat)) && Number.isFinite(Number(property.lng)) && property.lat && property.lng
        ? { geo: { '@type': 'GeoCoordinates', latitude: Number(property.lat), longitude: Number(property.lng) } }
        : {}),
    },
    ...(amount && !property.is_rent_negotiable
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

  const crumbs = [
    { name: 'Home', item: `${SITE_URL}/` },
    { name: 'Properties', item: absoluteUrl('/bd/property-listing/') },
    cleanText(property.state_district)
      ? {
          name: cleanText(property.state_district),
          item: `${absoluteUrl('/bd/property-listing/')}?search=${encodeURIComponent(cleanText(property.state_district))}`,
        }
      : null,
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
