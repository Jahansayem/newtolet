// Shared SEO constants and the per-route metadata builder used by app/**/layout.js files.
// The site is a static export, so every value here is baked into the HTML at build time.

export const SITE_URL = 'https://www.newtolet.com'
export const SITE_NAME = 'NewTolet.Com'
export const DEFAULT_OG_IMAGE = '/favicon-512x512.png'

const withTrailingSlash = (path = '/') => {
  if (!path || path === '/') return '/'
  const clean = path.split('?')[0].split('#')[0]
  return clean.endsWith('/') ? clean : `${clean}/`
}

export const absoluteUrl = (path = '/') => new URL(withTrailingSlash(path), SITE_URL).toString()

/**
 * Next.js metadata for one route. `path` is the canonical path (trailing slash added),
 * so duplicate routes such as /propertylist2/ can point at /bd/property-listing/.
 */
export function buildRouteMetadata({ title, description, path = '/', noindex = false }) {
  const canonical = withTrailingSlash(path)
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      alternateLocale: ['bn_BD'],
      images: [{ url: DEFAULT_OG_IMAGE, width: 512, height: 512, alt: `${SITE_NAME} logo` }],
    },
    twitter: { card: 'summary', title, description, images: [DEFAULT_OG_IMAGE] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

/** Route table: one entry per public page. Private pages are noindex. */
export const ROUTE_SEO = {
  home: {
    path: '/',
    title: 'NewTolet.Com - House, Flat & Room Rent in Bangladesh',
    description:
      'Find family flats, bachelor rooms, sublets, hostels, offices and shops for rent across Bangladesh. Search by division, district and area, compare rent and contact owners.',
  },
  listing: {
    path: '/bd/property-listing/',
    title: 'Properties for Rent in Bangladesh | NewTolet.Com',
    description:
      'Browse rental listings across all 64 districts of Bangladesh. Filter by area, rent, bedrooms, bathrooms and category: family, bachelor, sublet, hostel, office and shop.',
  },
  about: {
    path: '/about/',
    title: 'About NewTolet | Rental Marketplace in Bangladesh',
    description: 'NewTolet connects renters with house owners across Bangladesh. Learn who we are and how the marketplace works.',
  },
  contact: {
    path: '/contact/',
    title: 'Contact NewTolet | Support for Renters and Owners',
    description: 'Questions about a listing, a payment or your account? Contact the NewTolet team; we reply within one working day.',
  },
  article: {
    path: '/article/',
    title: 'Rental Guides for Dhaka and Bangladesh | NewTolet',
    description: 'Area guides and tips for renting a flat, room or sublet in Mirpur, Dhanmondi, Uttara and across Bangladesh.',
  },
  career: {
    path: '/career/',
    title: 'Careers at NewTolet',
    description: 'Open roles and ways to work with NewTolet, the rental marketplace for Bangladesh.',
  },
  earnmoney: {
    path: '/earnmoney/',
    title: 'Earn Money with NewTolet Referrals',
    description: 'Refer owners and renters to NewTolet and earn commission on paid purchases.',
  },
  saved: {
    path: '/saved/',
    title: 'Saved Properties | NewTolet.Com',
    description: 'Properties you saved on NewTolet.',
    noindex: true,
  },
  listdetails: {
    path: '/listdetails/',
    title: 'Property Details | NewTolet.Com',
    description: 'Rent, rooms, facilities and location for this property on NewTolet.',
  },
  login: { path: '/login/', title: 'Log in | NewTolet.Com', description: 'Log in to your NewTolet account.', noindex: true },
  registration: {
    path: '/registration/',
    title: 'Create an account | NewTolet.Com',
    description: 'Register on NewTolet to post a property, save listings and contact owners.',
  },
  'forgot-password': { path: '/forgot-password/', title: 'Reset your password | NewTolet.Com', description: 'Reset your NewTolet password.', noindex: true },
  'reset-password': { path: '/reset-password/', title: 'Choose a new password | NewTolet.Com', description: 'Choose a new NewTolet password.', noindex: true },
  private: { path: '/', title: 'My account | NewTolet.Com', description: 'Your NewTolet account.', noindex: true },
}

export const routeMetadata = (key, overrides = {}) => {
  const entry = ROUTE_SEO[key]
  return buildRouteMetadata({ ...entry, ...overrides })
}
