import locationData from '../../thetolet_locations_bundle.json'
import { HOME_CATEGORIES } from './categoryConfig'
import { buildPageHref, canonicalizeInternalHref } from '../../lib/routePaths.js'
import { matchesPropertyCategory } from '../../lib/propertyCategories'
import {
  DEFAULT_SEARCH_FILTERS,
  matchesKeywordSearch,
} from './propertySearchCore'
export { DEFAULT_SEARCH_FILTERS } from './propertySearchCore'
export { normalizeSearchQuery } from './propertySearchCore'

export const PROPERTY_TYPE_OPTIONS = [
  'Apartment',
  'House',
  'Room',
  'Sublet',
  'Office',
  'Shop',
  'Warehouse',
]

export const ROOM_FILTER_OPTIONS = ['1', '2', '3', '4', '5']

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
]

const LEGACY_PROPERTY_LIST_PATH = '/bd/property-listing'
const LEGACY_PROPERTY_DIVISION_PREFIX = '/bd/property-division'
const LEGACY_DIVISION_SLUGS = Object.freeze({
  Barishal: 'barishal',
  Chattogram: 'chittagong',
  Dhaka: 'dhaka',
  Khulna: 'khulna',
  Mymensingh: 'mymensingh',
  Rajshahi: 'rajshahi',
  Rangpur: 'rangpur',
  Sylhet: 'sylhet',
})
const LEGACY_DIVISION_NAMES = Object.freeze(
  Object.entries(LEGACY_DIVISION_SLUGS).reduce((accumulator, [division, slug]) => {
    accumulator[slug] = division
    return accumulator
  }, {
    chattogram: 'Chattogram',
  })
)

const SEARCH_PARAM_KEYS = [
  'search',
  'division',
  'district',
  'upazilla',
  'subArea',
  'category',
  'propertyType',
  'minPrice',
  'maxPrice',
  'rooms',
  'sort',
]

const LOCATION_INDEX = (() => {
  const divisions = []
  const districtsByDivision = {}
  const upazillasByDistrict = {}
  const subAreasByUpazilla = {}
  const districtToDivision = {}
  const upazillaToDistrict = {}
  const upazillaToDivision = {}

  locationData.divisions.forEach((division) => {
    divisions.push(division.name)
    districtsByDivision[division.name] = division.districts.map((district) => district.name)

    division.districts.forEach((district) => {
      districtToDivision[district.name.toLowerCase()] = division.name
      upazillasByDistrict[district.name] = district.upazillas.map((upazilla) => upazilla.name)

      district.upazillas.forEach((upazilla) => {
        upazillaToDistrict[upazilla.name.toLowerCase()] = district.name
        upazillaToDivision[upazilla.name.toLowerCase()] = division.name
        subAreasByUpazilla[upazilla.name] = upazilla.sub_areas || []
      })
    })
  })

  return {
    divisions,
    districtsByDivision,
    upazillasByDistrict,
    subAreasByUpazilla,
    districtToDivision,
    upazillaToDistrict,
    upazillaToDivision,
  }
})()

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim().toLowerCase()
}

const normalizePositiveNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const digitsOnly = value.toString().replace(/[^\d]/g, '')
  if (!digitsOnly) {
    return ''
  }

  const parsed = Number(digitsOnly)
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : ''
}

const getValue = (paramsLike, key) => {
  if (!paramsLike) {
    return ''
  }

  if (typeof paramsLike.get === 'function') {
    return paramsLike.get(key) || ''
  }

  return paramsLike[key] || ''
}

const normalizePathname = (pathname = '') => {
  if (!pathname) {
    return ''
  }

  return pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname
}

const getRouteParamValue = (routeParams, key) => {
  const rawValue = routeParams?.[key]

  if (Array.isArray(rawValue)) {
    return rawValue[0] || ''
  }

  return rawValue || ''
}

export const getLegacyDivisionSlug = (division = '') =>
  LEGACY_DIVISION_SLUGS[division] || normalizeText(division).replace(/\s+/g, '-')

export const getDivisionFromLegacySlug = (slug = '') =>
  LEGACY_DIVISION_NAMES[normalizeText(slug)] || ''

export const buildLegacyPropertyListHref = () => LEGACY_PROPERTY_LIST_PATH

export const buildLegacyPropertyDivisionHref = (division = '') => {
  const slug = getLegacyDivisionSlug(division)
  return canonicalizeInternalHref(`${LEGACY_PROPERTY_DIVISION_PREFIX}/${slug}`)
}

export const getSearchRouteContext = (pathname = '', routeParams = {}) => {
  const normalizedPathname = normalizePathname(pathname)

  if (normalizedPathname === LEGACY_PROPERTY_LIST_PATH) {
    return {
      pathname: normalizedPathname,
      isLegacyPropertyList: true,
      division: '',
    }
  }

  if (normalizedPathname.startsWith(`${LEGACY_PROPERTY_DIVISION_PREFIX}/`)) {
    const divisionSlug =
      getRouteParamValue(routeParams, 'divisionSlug') ||
      normalizedPathname.slice(`${LEGACY_PROPERTY_DIVISION_PREFIX}/`.length)

    return {
      pathname: normalizedPathname,
      isLegacyPropertyList: true,
      division: getDivisionFromLegacySlug(divisionSlug),
    }
  }

  return {
    pathname: normalizedPathname || '/propertylist2',
    isLegacyPropertyList: false,
    division: '',
  }
}

const buildLocationTrail = (filters) => {
  const nextFilters = { ...DEFAULT_SEARCH_FILTERS, ...filters }

  if (!nextFilters.division) {
    nextFilters.district = ''
    nextFilters.upazilla = ''
    nextFilters.subArea = ''
    return nextFilters
  }

  const districts = LOCATION_INDEX.districtsByDivision[nextFilters.division] || []
  if (!districts.includes(nextFilters.district)) {
    nextFilters.district = ''
    nextFilters.upazilla = ''
    nextFilters.subArea = ''
    return nextFilters
  }

  const upazillas = LOCATION_INDEX.upazillasByDistrict[nextFilters.district] || []
  if (!upazillas.includes(nextFilters.upazilla)) {
    nextFilters.upazilla = ''
    nextFilters.subArea = ''
    return nextFilters
  }

  const subAreas = LOCATION_INDEX.subAreasByUpazilla[nextFilters.upazilla] || []
  if (!subAreas.includes(nextFilters.subArea)) {
    nextFilters.subArea = ''
  }

  return nextFilters
}

export const parseSearchFilters = (paramsLike, routeContext = null) => {
  const nextFilters = {
    search: getValue(paramsLike, 'search').trim(),
    division: routeContext?.division || getValue(paramsLike, 'division').trim(),
    district: getValue(paramsLike, 'district').trim(),
    upazilla: getValue(paramsLike, 'upazilla').trim(),
    subArea: getValue(paramsLike, 'subArea').trim(),
    category: getValue(paramsLike, 'category').trim(),
    propertyType: getValue(paramsLike, 'propertyType').trim(),
    minPrice: normalizePositiveNumber(getValue(paramsLike, 'minPrice')),
    maxPrice: normalizePositiveNumber(getValue(paramsLike, 'maxPrice')),
    rooms: normalizePositiveNumber(getValue(paramsLike, 'rooms')),
    sort: getValue(paramsLike, 'sort').trim(),
  }

  nextFilters.category = HOME_CATEGORIES.includes(nextFilters.category)
    ? nextFilters.category
    : DEFAULT_SEARCH_FILTERS.category
  nextFilters.propertyType = PROPERTY_TYPE_OPTIONS.includes(nextFilters.propertyType)
    ? nextFilters.propertyType
    : DEFAULT_SEARCH_FILTERS.propertyType
  nextFilters.rooms = ROOM_FILTER_OPTIONS.includes(nextFilters.rooms) ? nextFilters.rooms : ''
  nextFilters.sort = SORT_OPTIONS.some((option) => option.value === nextFilters.sort)
    ? nextFilters.sort
    : DEFAULT_SEARCH_FILTERS.sort

  return buildLocationTrail(nextFilters)
}

export const getLocationOptions = (filters = DEFAULT_SEARCH_FILTERS) => {
  const normalizedFilters = buildLocationTrail(filters)

  return {
    divisions: LOCATION_INDEX.divisions,
    districts: normalizedFilters.division
      ? LOCATION_INDEX.districtsByDivision[normalizedFilters.division] || []
      : [],
    upazillas: normalizedFilters.district
      ? LOCATION_INDEX.upazillasByDistrict[normalizedFilters.district] || []
      : [],
    subAreas: normalizedFilters.upazilla
      ? LOCATION_INDEX.subAreasByUpazilla[normalizedFilters.upazilla] || []
      : [],
  }
}

export const updateSearchFilters = (filters, key, value) => {
  const nextFilters = {
    ...DEFAULT_SEARCH_FILTERS,
    ...filters,
    [key]: typeof value === 'string' ? value : value?.toString?.() || '',
  }

  if (key === 'minPrice' || key === 'maxPrice' || key === 'rooms') {
    nextFilters[key] = normalizePositiveNumber(value)
  }

  if (key === 'category' && !HOME_CATEGORIES.includes(nextFilters.category)) {
    nextFilters.category = DEFAULT_SEARCH_FILTERS.category
  }

  if (key === 'propertyType' && !PROPERTY_TYPE_OPTIONS.includes(nextFilters.propertyType)) {
    nextFilters.propertyType = DEFAULT_SEARCH_FILTERS.propertyType
  }

  if (key === 'sort' && !SORT_OPTIONS.some((option) => option.value === nextFilters.sort)) {
    nextFilters.sort = DEFAULT_SEARCH_FILTERS.sort
  }

  if (key === 'division') {
    nextFilters.district = ''
    nextFilters.upazilla = ''
    nextFilters.subArea = ''
  }

  if (key === 'district') {
    nextFilters.upazilla = ''
    nextFilters.subArea = ''
  }

  if (key === 'upazilla') {
    nextFilters.subArea = ''
  }

  return buildLocationTrail(nextFilters)
}

export const clearSearchFilter = (filters, key) => updateSearchFilters(filters, key, DEFAULT_SEARCH_FILTERS[key] || '')

export const buildSearchParams = (filters, existingSearchParams) => {
  const normalizedFilters = buildLocationTrail({ ...DEFAULT_SEARCH_FILTERS, ...filters })
  const params = existingSearchParams instanceof URLSearchParams
    ? new URLSearchParams(existingSearchParams.toString())
    : new URLSearchParams()

  SEARCH_PARAM_KEYS.forEach((key) => params.delete(key))

  Object.entries(normalizedFilters).forEach(([key, value]) => {
    const defaultValue = DEFAULT_SEARCH_FILTERS[key]
    if (value && value !== defaultValue) {
      params.set(key, value)
    }
  })

  return params
}

export const buildSearchHref = (filters, routeContext = '/propertylist2') => {
  const normalizedFilters = buildLocationTrail({ ...DEFAULT_SEARCH_FILTERS, ...filters })
  const params = buildSearchParams(normalizedFilters)
  const pathname =
    typeof routeContext === 'string'
      ? routeContext
      : routeContext?.pathname || '/propertylist2'

  if (typeof routeContext === 'object' && routeContext?.isLegacyPropertyList) {
    params.delete('division')
    const basePath = normalizedFilters.division
      ? buildLegacyPropertyDivisionHref(normalizedFilters.division)
      : buildLegacyPropertyListHref()
    const queryString = params.toString()

    return canonicalizeInternalHref(queryString ? `${basePath}?${queryString}` : basePath)
  }

  if (!pathname || pathname === '/propertylist2') {
    const nextParams = Object.fromEntries(params.entries())
    return buildPageHref('propertylist2', nextParams)
  }

  const queryString = params.toString()
  const href = queryString ? `${pathname}?${queryString}` : pathname
  return canonicalizeInternalHref(href)
}

const getPropertyPrice = (item) => {
  const amount = Number(item?.pricing?.rent_amount_bdt)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}
const getPropertyRooms = (item) =>
  Number(item?.total_rooms ?? item?.specifications?.total_rooms ?? 0)

const resolvePropertyLocation = (item) => {
  const stateDistrict = normalizeText(item?.location?.state_district)
  const area = normalizeText(item?.location?.area)
  const subArea = normalizeText(item?.location?.sub_area)

  let division = ''
  let district = ''

  if (stateDistrict) {
    if (LOCATION_INDEX.divisions.some((entry) => normalizeText(entry) === stateDistrict)) {
      division = stateDistrict
    } else if (LOCATION_INDEX.districtToDivision[stateDistrict]) {
      district = stateDistrict
      division = normalizeText(LOCATION_INDEX.districtToDivision[stateDistrict])
    }
  }

  if (area && !district && LOCATION_INDEX.districtToDivision[area]) {
    district = area
    division = normalizeText(LOCATION_INDEX.districtToDivision[area])
  }

  if (area && LOCATION_INDEX.upazillaToDistrict[area]) {
    district = normalizeText(LOCATION_INDEX.upazillaToDistrict[area])
    division = normalizeText(LOCATION_INDEX.upazillaToDivision[area])
  }

  return {
    division,
    district,
    upazilla: area,
    subArea: subArea,
  }
}

const matchesLocationFilters = (item, filters) => {
  const selectedDivision = normalizeText(filters.division)
  const selectedDistrict = normalizeText(filters.district)
  const selectedUpazilla = normalizeText(filters.upazilla)
  const selectedSubArea = normalizeText(filters.subArea)

  const propertyLocation = resolvePropertyLocation(item)

  if (selectedDivision && propertyLocation.division && propertyLocation.division !== selectedDivision) {
    return false
  }

  if (selectedDivision && !propertyLocation.division) {
    return false
  }

  if (selectedDistrict && propertyLocation.district !== selectedDistrict) {
    return false
  }

  if (selectedUpazilla && propertyLocation.upazilla !== selectedUpazilla) {
    return false
  }

  if (selectedSubArea && propertyLocation.subArea !== selectedSubArea) {
    return false
  }

  return true
}

const matchesBudgetFilters = (item, filters) => {
  const price = getPropertyPrice(item)
  const minPrice = filters.minPrice ? Number(filters.minPrice) : null
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null

  if (price === null && (minPrice !== null || maxPrice !== null)) {
    return false
  }

  if (minPrice !== null && price < minPrice) {
    return false
  }

  if (maxPrice !== null && price > maxPrice) {
    return false
  }

  return true
}

const matchesRoomFilter = (item, filters) => {
  if (!filters.rooms) {
    return true
  }

  return getPropertyRooms(item) >= Number(filters.rooms)
}

export const matchesPropertySearch = (item, searchInput = '') => {
  if (typeof searchInput === 'string') {
    return matchesKeywordSearch(item, searchInput)
  }

  const filters = { ...DEFAULT_SEARCH_FILTERS, ...searchInput }

  return (
    matchesPropertyCategory(item, filters.category) &&
    (!filters.propertyType || filters.propertyType === 'All' || item?.property_type === filters.propertyType) &&
    matchesBudgetFilters(item, filters) &&
    matchesRoomFilter(item, filters) &&
    matchesLocationFilters(item, filters) &&
    matchesKeywordSearch(item, filters.search)
  )
}

export const sortProperties = (properties, sort = DEFAULT_SEARCH_FILTERS.sort) => {
  const nextProperties = [...properties]

  if (sort === 'price_low') {
    return nextProperties.sort((left, right) => (getPropertyPrice(left) ?? Number.MAX_SAFE_INTEGER) - (getPropertyPrice(right) ?? Number.MAX_SAFE_INTEGER))
  }

  if (sort === 'price_high') {
    return nextProperties.sort((left, right) => (getPropertyPrice(right) ?? -1) - (getPropertyPrice(left) ?? -1))
  }

  return nextProperties.sort(
    (left, right) => new Date(right?.created_at || 0).getTime() - new Date(left?.created_at || 0).getTime()
  )
}

export const applyPropertySearch = (properties, filters = DEFAULT_SEARCH_FILTERS) =>
  sortProperties(
    (properties || []).filter((item) => matchesPropertySearch(item, filters)),
    filters.sort
  )

export const hasActiveSearchFilters = (filters = DEFAULT_SEARCH_FILTERS) =>
  Object.entries(DEFAULT_SEARCH_FILTERS).some(([key, value]) => (filters[key] || '') !== value)

export const getActiveSearchChips = (filters = DEFAULT_SEARCH_FILTERS) => {
  const chips = []

  if (filters.search) chips.push({ key: 'search', label: `Keyword: ${filters.search}` })
  if (filters.division) chips.push({ key: 'division', label: `Division: ${filters.division}` })
  if (filters.district) chips.push({ key: 'district', label: `District: ${filters.district}` })
  if (filters.upazilla) chips.push({ key: 'upazilla', label: `Area: ${filters.upazilla}` })
  if (filters.subArea) chips.push({ key: 'subArea', label: `Sub-area: ${filters.subArea}` })
  if (filters.category && filters.category !== 'All') chips.push({ key: 'category', label: `Category: ${filters.category}` })
  if (filters.propertyType && filters.propertyType !== 'All') chips.push({ key: 'propertyType', label: `Type: ${filters.propertyType}` })
  if (filters.minPrice) chips.push({ key: 'minPrice', label: `Min ৳${filters.minPrice}` })
  if (filters.maxPrice) chips.push({ key: 'maxPrice', label: `Max ৳${filters.maxPrice}` })
  if (filters.rooms) chips.push({ key: 'rooms', label: `${filters.rooms}+ rooms` })

  return chips
}

export const getSearchLocationPayload = (filters = DEFAULT_SEARCH_FILTERS) => {
  const location = {
    division: filters.division || null,
    district: filters.district || null,
    upazilla: filters.upazilla || null,
    subArea: filters.subArea || null,
  }

  return Object.values(location).some(Boolean) ? location : null
}

export const getSearchPriceSummary = (filters = DEFAULT_SEARCH_FILTERS) => {
  const segments = []

  if (filters.minPrice) segments.push(`min:${filters.minPrice}`)
  if (filters.maxPrice) segments.push(`max:${filters.maxPrice}`)
  if (filters.rooms) segments.push(`rooms:${filters.rooms}+`)

  return segments.join(' | ') || null
}
