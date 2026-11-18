// Category landing pages: /bd/property/category/<slug>/ (family, bachelor, office, sublet, hostel,
// shop). Pure helpers shared by the route (metadata, JSON-LD), the search page (route context) and
// tests. The visible intro text lives in the locale files (categoryPages.*).
import { HOME_CATEGORIES } from '../propertyCategories.js'
import { SITE_NAME, SITE_URL } from './siteMeta.js'

export const CATEGORY_PAGE_PREFIX = '/bd/property/category'

export const getCategorySlug = (category = '') =>
  HOME_CATEGORIES.includes(category) ? category.toLowerCase() : ''

export const getCategoryFromSlug = (slug = '') => {
  const key = String(slug || '').trim().toLowerCase().replace(/\/+$/, '')
  return HOME_CATEGORIES.find((category) => category.toLowerCase() === key) || ''
}

export const CATEGORY_PAGE_SLUGS = Object.freeze(HOME_CATEGORIES.map(getCategorySlug))

/** "/bd/property/category/family/" (trailing slash: the static export serves directories). */
export const buildCategoryPagePath = (category) => {
  const slug = getCategorySlug(category)
  return slug ? `${CATEGORY_PAGE_PREFIX}/${slug}/` : ''
}

/** The category a pathname is the landing page of ('' when it is not a category page). */
export const getCategoryFromPagePath = (pathname = '') => {
  const path = String(pathname || '').replace(/\/+$/, '')
  if (!path.startsWith(`${CATEGORY_PAGE_PREFIX}/`)) return ''
  return getCategoryFromSlug(path.slice(CATEGORY_PAGE_PREFIX.length + 1))
}

/**
 * Href for a category page with the other search filters as query params. The path carries the
 * category, so a `category` param is dropped.
 */
export const buildCategoryPageHref = (category, params = new URLSearchParams()) => {
  const basePath = buildCategoryPagePath(category)
  if (!basePath) return ''
  const query = new URLSearchParams(params)
  query.delete('category')
  const queryString = query.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}

// English <title>/<meta description> per category. Search engines see the static HTML, which
// renders in English; the Bangla intro is shown to visitors who pick বাং.
const CATEGORY_PAGE_SEO = Object.freeze({
  Family: {
    title: 'Family Flat & House Rent in Bangladesh (Basa Vara) | NewTolet',
    description: 'Family flats and houses for rent across Bangladesh. Compare rent, bedrooms, floor and facilities, then contact the owner directly. No broker.',
  },
  Bachelor: {
    title: 'Bachelor Room & Seat Rent in Bangladesh | NewTolet',
    description: 'Bachelor rooms, seats and flats for rent in Dhaka and across Bangladesh. Filter by area, rent and who can rent, and contact owners directly.',
  },
  Office: {
    title: 'Office Space for Rent in Bangladesh | NewTolet',
    description: 'Office rooms, floors and commercial space for rent in Bangladesh. Filter by area, size and rent and call the owner directly.',
  },
  Sublet: {
    title: 'Sublet Rooms for Rent in Bangladesh | NewTolet',
    description: 'Sublet rooms in shared flats across Bangladesh, including female-only and family sublets. See rent, rooms and rules before you call.',
  },
  Hostel: {
    title: 'Hostel & Mess Seat Rent in Bangladesh | NewTolet',
    description: 'Hostel and mess seats and rooms for students and job holders in Bangladesh. Compare monthly rent, facilities and location.',
  },
  Shop: {
    title: 'Shop Space for Rent in Bangladesh | NewTolet',
    description: 'Shops and retail space for rent across Bangladesh. Filter by area and rent and contact the owner without a broker.',
  },
})

export const getCategoryPageSeo = (category) => {
  const seo = CATEGORY_PAGE_SEO[category]
  if (!seo) return null
  return { ...seo, path: buildCategoryPagePath(category) }
}

/** CollectionPage + BreadcrumbList. Listings load client-side, so there is no ItemList here. */
export const categoryPageJsonLd = (category) => {
  const seo = getCategoryPageSeo(category)
  if (!seo) return null
  const url = `${SITE_URL}${seo.path}`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: seo.title.replace(/ \| NewTolet$/, ''),
        description: seo.description,
        inLanguage: 'en',
        isPartOf: { '@id': `${SITE_URL}/#website`, name: SITE_NAME },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Properties for rent', item: `${SITE_URL}/bd/property-listing/` },
          { '@type': 'ListItem', position: 3, name: `${category} rent`, item: url },
        ],
      },
    ],
  }
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so it cannot close the tag. */
export const serializeJsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c')
