// schema.org JSON-LD builders. Pure functions so they can be unit-tested with node --test.
import { SITE_CONTACT } from '../../config/siteContact.js'
import { SITE_NAME, SITE_URL } from './siteMeta.js'

// Listing builders live with the listing-seo Edge Function so the server-rendered <head>
// and the listing page use one implementation.
export {
  listingDescription,
  listingDocumentTitle,
  listingH1,
  listingHeadline,
  listingImageAlt,
  listingJsonLd,
  listingPriceLabel,
} from '../../../supabase/functions/_shared/listingSeo.js'

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
