const PAGE_BY_PATH = Object.freeze({
  '/about': 'about',
  '/addproperty': 'addproperty',
  '/admin': 'admin',
  '/admin-dashboard': 'admin-dashboard',
  '/book': 'book',
  '/book/buy-credits': 'book-buy-credits',
  '/contact': 'contact',
  '/dashboard': 'dashboard',
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
  '/terms': 'terms',
})

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

export const buildPageHref = (page = '', params = {}, hash = '') => {
  const searchParams = new URLSearchParams()

  if (page) {
    searchParams.set('page', page)
  }

  setParamValues(searchParams, params)

  const queryString = searchParams.toString()
  return appendHash(queryString ? `/?${queryString}` : '/', hash)
}

export const getRoutePage = (pathname = '/', searchParamsLike = null) => {
  const explicitPage =
    typeof searchParamsLike?.get === 'function'
      ? searchParamsLike.get('page')
      : searchParamsLike?.page

  if (explicitPage) {
    return String(explicitPage).trim()
  }

  return PAGE_BY_PATH[normalizePathname(pathname)] || ''
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
  const mappedPage = PAGE_BY_PATH[normalizedPathname]

  if (!mappedPage) {
    if (normalizedPathname === '/') {
      return appendHash(resolvedUrl.search ? `/${resolvedUrl.search}` : '/', resolvedUrl.hash)
    }

    return appendHash(`${resolvedUrl.pathname}${resolvedUrl.search}`, resolvedUrl.hash)
  }

  const params = new URLSearchParams(resolvedUrl.search)
  params.set('page', mappedPage)

  return appendHash(`/?${params.toString()}`, resolvedUrl.hash)
}

export const buildListDetailsHref = (id) => buildPageHref('listdetails', { id })

export const buildOrderhomeHref = (id) => buildPageHref('orderhome', { id })

export const buildBookHref = (id) => buildPageHref('book', { id })

export const buildEditPropertyHref = (propertyId) =>
  buildPageHref('edit-property', { propertyId })

export const buildDashboardHref = (tab = 'dashboard') =>
  buildPageHref('dashboard', { tab })
