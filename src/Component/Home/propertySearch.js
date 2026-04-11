import locationData from '../../thetolet_locations_bundle.json'
import { HOME_CATEGORIES } from './categoryConfig'
import { buildPageHref, canonicalizeInternalHref } from '../../lib/routePaths.js'

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

export const DEFAULT_SEARCH_FILTERS = {
  search: '',
  division: '',
  district: '',
  upazilla: '',
  subArea: '',
  category: 'All',
  propertyType: 'All',
  minPrice: '',
  maxPrice: '',
  rooms: '',
  sort: 'newest',
}

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

export const normalizeSearchQuery = (searchQuery = '') =>
  searchQuery.toLowerCase().replace('#', '').trim()

export const parseSearchFilters = (paramsLike) => {
  const nextFilters = {
    search: getValue(paramsLike, 'search').trim(),
    division: getValue(paramsLike, 'division').trim(),
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

export const buildSearchHref = (filters, pathname = '/propertylist2') => {
  const params = buildSearchParams(filters)

  if (!pathname || pathname === '/propertylist2') {
    const nextParams = Object.fromEntries(params.entries())
    return buildPageHref('propertylist2', nextParams)
  }

  const queryString = params.toString()
  const href = queryString ? `${pathname}?${queryString}` : pathname
  return canonicalizeInternalHref(href)
}

const getPropertyPrice = (item) => Number(item?.pricing?.rent_amount_bdt || 0)
const getPropertyRooms = (item) =>
  Number(item?.total_rooms ?? item?.specifications?.total_rooms ?? 0)

const getPropertyDivision = (item) => {
  const district = normalizeText(item?.location?.state_district)
  const area = normalizeText(item?.location?.area)

  return (
    LOCATION_INDEX.districtToDivision[district] ||
    LOCATION_INDEX.upazillaToDivision[area] ||
    ''
  )
}

const getPropertyDistrict = (item) => {
  const district = normalizeText(item?.location?.state_district)
  const area = normalizeText(item?.location?.area)

  return district || LOCATION_INDEX.upazillaToDistrict[area] || ''
}

const matchesKeywordSearch = (item, searchQuery = '') => {
  const normalizedSearch = normalizeSearchQuery(searchQuery)

  if (!normalizedSearch) {
    return true
  }

  const priceText = getPropertyPrice(item).toString()
  const searchableValues = [
    item?.property_id_number,
    item?.category,
    item?.property_type,
    item?.location?.area,
    item?.location?.state_district,
    item?.location?.sub_area,
    item?.location?.sector,
    item?.location?.road,
    item?.location?.house_plot,
    item?.location?.short_description,
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value))

  return searchableValues.some((value) => value.includes(normalizedSearch)) || priceText.includes(normalizedSearch)
}

const matchesLocationFilters = (item, filters) => {
  const selectedDivision = normalizeText(filters.division)
  const selectedDistrict = normalizeText(filters.district)
  const selectedUpazilla = normalizeText(filters.upazilla)
  const selectedSubArea = normalizeText(filters.subArea)

  const propertyDivision = getPropertyDivision(item)
  const propertyDistrict = getPropertyDistrict(item)
  const propertyArea = normalizeText(item?.location?.area)
  const propertySubArea = normalizeText(item?.location?.sub_area)

  if (selectedDivision && propertyDivision && propertyDivision !== selectedDivision) {
    return false
  }

  if (selectedDivision && !propertyDivision) {
    return false
  }

  if (selectedDistrict && propertyDistrict !== selectedDistrict) {
    return false
  }

  if (selectedUpazilla && propertyArea !== selectedUpazilla) {
    return false
  }

  if (selectedSubArea && propertySubArea !== selectedSubArea) {
    return false
  }

  return true
}

const matchesBudgetFilters = (item, filters) => {
  const price = getPropertyPrice(item)
  const minPrice = filters.minPrice ? Number(filters.minPrice) : null
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null

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
    (!filters.category || filters.category === 'All' || item?.category === filters.category) &&
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
    return nextProperties.sort((left, right) => getPropertyPrice(left) - getPropertyPrice(right))
  }

  if (sort === 'price_high') {
    return nextProperties.sort((left, right) => getPropertyPrice(right) - getPropertyPrice(left))
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
