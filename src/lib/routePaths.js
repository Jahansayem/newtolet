const PAGE_BY_PATH = Object.freeze({
  '/about': 'about',
  '/addproperty': 'addproperty',
  '/admin': 'admin',
  '/admin-dashboard': 'admin-dashboard',
  '/article': 'article',
  '/book': 'book',
  '/book/buy-credits': 'book-buy-credits',
  '/career': 'career',
  '/compare': 'compare',
  '/contact': 'contact',
  '/dashboard': 'dashboard',
  '/bd/property-listing': 'propertylist2',
  '/earnmoney': 'earnmoney',
  '/edit-property': 'edit-property',
  '/forgot-password': 'forgot-password',
  '/listdetails': 'listdetails',
  '/login': 'login',
  '/my-orders': 'my-orders',
  '/my-properties': 'my-properties',
  '/orderhome': 'orderhome',
  '/payment-confirm': 'payment-confirm',
  '/privacy': 'privacy',
  '/propertylist': 'propertylist',
  '/propertylist2': 'propertylist2',
  '/refund': 'refund',
  '/registration': 'registration',
  '/reset-password': 'reset-password',
  '/saved': 'saved',
  '/terms': 'terms',
})

const PATH_BY_PAGE = Object.freeze(
  Object.entries(PAGE_BY_PATH).reduce((accumulator, [pathname, page]) => {
    accumulator[page] = pathname
    return accumulator
  }, {})
)

const EXTERNAL_PROTOCOL_PATTERN = /^[a-z][a-z\d+\-.]*:/i
const INTERNAL_ORIGIN = 'https://newtolet.local'

const normalizePathname = (pathname = '/') => {
  if (!pathname || pathname === '/') {
    return '/'
  }

  const trimmedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return trimmedPath || '/'
}

const appendHash = (href, hash = '') => `${href}${hash || ''}`

const setParamValues = (params, values = {}) => {
  Object.entries(values).forEach(([key, value]) => {
    params.delete(key)

    if (value === null || value === undefined || value === '') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== null && entry !== undefined && entry !== '') {
          params.append(key, String(entry))
        }
      })
      return
    }

    params.set(key, String(value))
  })

  return params
}

const normalizeParamsInput = (paramsLike = {}) => {
  if (paramsLike instanceof URLSearchParams) {
    return new URLSearchParams(paramsLike.toString())
  }

  if (typeof paramsLike?.entries === 'function') {
    return new URLSearchParams(Array.from(paramsLike.entries()))
  }

  return setParamValues(new URLSearchParams(), paramsLike)
}

export const resolvePagePath = (page = '') => PATH_BY_PAGE[page] || '/'

export const resolveLegacyPageHref = (page = '', paramsLike = {}, hash = '') => {
  const pathname = resolvePagePath(page)
  const searchParams = normalizeParamsInput(paramsLike)
  const queryString = searchParams.toString()

  return appendHash(queryString ? `${pathname}?${queryString}` : pathname, hash)
}

export const buildPageHref = (page = '', params = {}, hash = '') => {
  return resolveLegacyPageHref(page, params, hash)
}

export const getRoutePage = (pathname = '/', searchParamsLike = null) => {
  const normalizedPath = normalizePathname(pathname)

  // Legacy '/?page=about' URLs only exist on the home path. Elsewhere ?page= is pagination.
  if (normalizedPath === '/') {
    const explicitPage =
      typeof searchParamsLike?.get === 'function'
        ? searchParamsLike.get('page')
        : searchParamsLike?.page

    if (explicitPage && !/^\d+$/.test(String(explicitPage).trim())) {
      return String(explicitPage).trim()
    }
  }

  if (normalizedPath.startsWith('/bd/property-division/')) {
    return 'propertylist2'
  }

  return PAGE_BY_PATH[normalizedPath] || ''
}

export const canonicalizeInternalHref = (href) => {
  if (typeof href !== 'string') {
    return '/'
  }

  const trimmedHref = href.trim()

  if (!trimmedHref) {
    return '/'
  }

  if (
    trimmedHref.startsWith('#') ||
    trimmedHref.startsWith('//') ||
    EXTERNAL_PROTOCOL_PATTERN.test(trimmedHref)
  ) {
    return trimmedHref
  }

  const resolvedUrl = new URL(trimmedHref, INTERNAL_ORIGIN)
  const normalizedPathname = normalizePathname(resolvedUrl.pathname)
  const explicitPage = normalizedPathname === '/' ? resolvedUrl.searchParams.get('page') : null

  if (explicitPage) {
    const nextParams = new URLSearchParams(resolvedUrl.search)
    nextParams.delete('page')
    return resolveLegacyPageHref(explicitPage, nextParams, resolvedUrl.hash)
  }

  if (normalizedPathname === '/') {
    return appendHash(resolvedUrl.search ? `/${resolvedUrl.search}` : '/', resolvedUrl.hash)
  }

  return appendHash(`${resolvedUrl.pathname}${resolvedUrl.search}`, resolvedUrl.hash)
}

export const buildListDetailsHref = (id) => buildPageHref('listdetails', { id })

export const buildOrderhomeHref = (id) => buildPageHref('orderhome', { id })

export const buildBookHref = (id) => buildPageHref('book', { id })

export const buildEditPropertyHref = (propertyId, params = {}) =>
  buildPageHref('edit-property', { propertyId, ...params })

/** The admin edit screen for one listing, inside the admin panel. */
export const buildAdminEditPropertyHref = (propertyId) =>
  buildPageHref('admin', { tab: 'properties', edit: propertyId })

export const buildDashboardHref = (tab = 'dashboard') =>
  buildPageHref('dashboard', { tab })
