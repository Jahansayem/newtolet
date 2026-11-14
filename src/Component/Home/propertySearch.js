import locationData from '../../thetolet_locations_bundle.json'
import { HOME_CATEGORIES } from './categoryConfig'
import { buildPageHref, canonicalizeInternalHref } from '../../lib/routePaths.js'
import { matchesPropertyCategory } from '../../lib/propertyCategories'
import {
  PROPERTY_TYPE_OPTIONS,
  matchesPropertyTypeOption,
  resolvePropertyTypeOption,
} from '../../lib/propertyTypes'
import {
  DEFAULT_SEARCH_FILTERS,
  matchesKeywordSearch,
} from './propertySearchCore'
import { compareActivePinnedFirst } from '../../utils/propertyPinning'
import { placeKey } from '../../lib/search/normalize.js'
import {
  BATHROOM_FILTER_OPTIONS,
  OCCUPANCY_FILTER_KEYS,
  parseAmenityList,
} from '../../lib/search/filterOptions.js'
export { DEFAULT_SEARCH_FILTERS } from './propertySearchCore'
export { normalizeSearchQuery } from './propertySearchCore'

export { PROPERTY_TYPE_OPTIONS }

export const ROOM_FILTER_OPTIONS = ['1', '2', '3', '4', '5']
export { BATHROOM_FILTER_OPTIONS, AMENITY_FILTER_KEYS, OCCUPANCY_FILTER_KEYS } from '../../lib/search/filterOptions.js'

export const SORT_OPTIONS = [
  { value: 'newest', labelKey: 'search.sort.newest' },
  { value: 'price_low', labelKey: 'search.sort.priceLow' },
  { value: 'price_high', labelKey: 'search.sort.priceHigh' },
  { value: 'oldest', labelKey: 'search.sort.oldest' },
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
  'baths',
  'amenities',
  'occupancy',
  'includeNegotiable',
  'sort',
  // Pagination lives in the URL too; any filter change drops it (back to page 1).
  'page',
]

const subAreaListKey = (district, upazilla) => `${district}|${upazilla}`

/** Case/punctuation-insensitive dedupe ('Bashundhara R.A' = 'Bashundhara R/A'), sorted. */
const uniquePlaceNames = (names = []) => {
  const byKey = new Map()
  names.forEach((name) => {
    const key = placeKey(name)
    if (key && !byKey.has(key)) byKey.set(key, name)
  })
  return [...byKey.values()].sort((left, right) => left.localeCompare(right))
}

const LOCATION_INDEX = (() => {
  const divisions = []
  const districtsByDivision = {}
  const upazillasByDistrict = {}
  const subAreasByUpazilla = {}
  const divisionByKey = {}
  const districtByKey = {}
  const upazillaByKey = {}
  const subAreaByKey = {}
  const districtToDivision = {}
  const upazillaToDistrict = {}
  const upazillaToDivision = {}
  const subAreaToUpazilla = {}
  const subAreaToDistrict = {}
  const subAreaToDivision = {}
  const upazillaCandidates = {}
  const subAreaCandidates = {}

  locationData.divisions.forEach((division) => {
    divisions.push(division.name)
    divisionByKey[division.name.toLowerCase()] = division.name
    districtsByDivision[division.name] = division.districts.map((district) => district.name)

    division.districts.forEach((district) => {
      districtByKey[district.name.toLowerCase()] = district.name
      districtToDivision[district.name.toLowerCase()] = division.name
      upazillasByDistrict[district.name] = district.upazillas.map((upazilla) => upazilla.name)

      district.upazillas.forEach((upazilla) => {
        upazillaByKey[upazilla.name.toLowerCase()] = upazilla.name
        // First match wins for names shared by several districts (Mirpur: Dhaka before Kushtia).
        upazillaToDistrict[upazilla.name.toLowerCase()] ||= district.name
        upazillaToDivision[upazilla.name.toLowerCase()] ||= division.name
        ;(upazillaCandidates[upazilla.name.toLowerCase()] ||= []).push({
          division: division.name,
          district: district.name,
        })
        // Keyed by district too: Kushtia's empty "Mirpur" used to overwrite Dhaka's 24 sub-areas.
        subAreasByUpazilla[subAreaListKey(district.name, upazilla.name)] = upazilla.sub_areas || []
        ;(upazilla.sub_areas || []).forEach((subArea) => {
          const subAreaKey = subArea.toLowerCase()

          subAreaByKey[subAreaKey] = subArea
          subAreaToUpazilla[subAreaKey] ||= upazilla.name
          subAreaToDistrict[subAreaKey] ||= district.name
          subAreaToDivision[subAreaKey] ||= division.name
          ;(subAreaCandidates[subAreaKey] ||= []).push({
            division: division.name,
            district: district.name,
            upazilla: upazilla.name,
          })
        })
      })
    })
  })

  return {
    divisions,
    districtsByDivision,
    upazillasByDistrict,
    subAreasByUpazilla,
    divisionByKey,
    districtByKey,
    upazillaByKey,
    subAreaByKey,
    districtToDivision,
    upazillaToDistrict,
    upazillaToDivision,
    subAreaToUpazilla,
    subAreaToDistrict,
    subAreaToDivision,
    upazillaCandidates,
    subAreaCandidates,
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

const getValue = (paramsLike, key, aliases = []) => {
  if (!paramsLike) {
    return ''
  }

  const keys = [key, ...aliases]

  if (typeof paramsLike.get === 'function') {
    for (const entry of keys) {
      const value = paramsLike.get(entry)

      if (value) {
        return value
      }
    }

    return ''
  }

  for (const entry of keys) {
    if (paramsLike[entry]) {
      return paramsLike[entry]
    }
  }

  return ''
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

const getCanonicalLocationValue = (lookup, value = '') => {
  const key = normalizeText(value)
  return key ? lookup[key] || value.trim() : ''
}

const buildLocationTrail = (filters) => {
  const nextFilters = { ...DEFAULT_SEARCH_FILTERS, ...filters }
  nextFilters.division = getCanonicalLocationValue(LOCATION_INDEX.divisionByKey, nextFilters.division)
  nextFilters.district = getCanonicalLocationValue(LOCATION_INDEX.districtByKey, nextFilters.district)
  nextFilters.upazilla = getCanonicalLocationValue(LOCATION_INDEX.upazillaByKey, nextFilters.upazilla)
  nextFilters.subArea = getCanonicalLocationValue(LOCATION_INDEX.subAreaByKey, nextFilters.subArea)

  const districtKey = normalizeText(nextFilters.district)
  const upazillaKey = normalizeText(nextFilters.upazilla)
  const subAreaKey = normalizeText(nextFilters.subArea)

  // Several upazilla / sub-area names exist in more than one district (e.g. Mirpur in Dhaka and
  // Kushtia). Parents are inferred only when exactly one candidate fits what is already chosen;
  // otherwise the chosen area is kept and the parents stay empty.
  const fitsChosen = (candidate) =>
    (!nextFilters.division || candidate.division === nextFilters.division) &&
    (!nextFilters.district || candidate.district === nextFilters.district)
  const upazillaCandidates = (LOCATION_INDEX.upazillaCandidates[upazillaKey] || []).filter(fitsChosen)
  const subAreaCandidates = (LOCATION_INDEX.subAreaCandidates[subAreaKey] || []).filter(
    (candidate) => fitsChosen(candidate) && (!nextFilters.upazilla || candidate.upazilla === nextFilters.upazilla)
  )
  const uniqueUpazilla = upazillaCandidates.length === 1 ? upazillaCandidates[0] : null
  const uniqueSubArea = subAreaCandidates.length === 1 ? subAreaCandidates[0] : null

  if (!nextFilters.division) {
    nextFilters.division =
      LOCATION_INDEX.districtToDivision[districtKey] ||
      uniqueUpazilla?.division ||
      uniqueSubArea?.division ||
      ''
  }

  if (!nextFilters.district) {
    nextFilters.district = uniqueUpazilla?.district || uniqueSubArea?.district || ''
  }

  if (!nextFilters.upazilla) {
    nextFilters.upazilla = uniqueSubArea?.upazilla || ''
  }

  if (nextFilters.district) {
    const districts = nextFilters.division
      ? LOCATION_INDEX.districtsByDivision[nextFilters.division] || []
      : Object.values(LOCATION_INDEX.districtByKey)
    if (!districts.includes(nextFilters.district)) {
      nextFilters.district = ''
    }
  }

  if (nextFilters.upazilla) {
    const known = (LOCATION_INDEX.upazillaCandidates[upazillaKey] || []).some(fitsChosen)
    if (!known) {
      nextFilters.upazilla = ''
      nextFilters.subArea = ''
    }
  }

  if (nextFilters.subArea) {
    const known = (LOCATION_INDEX.subAreaCandidates[subAreaKey] || []).some(
      (candidate) => fitsChosen(candidate) && (!nextFilters.upazilla || candidate.upazilla === nextFilters.upazilla)
    )
    if (!known) {
      nextFilters.subArea = ''
    }
  }

  return nextFilters
}

export const parseSearchFilters = (paramsLike, routeContext = null) => {
  const nextFilters = {
    search: getValue(paramsLike, 'search').trim(),
    division: routeContext?.division || getValue(paramsLike, 'division').trim(),
    district: getValue(paramsLike, 'district').trim(),
    upazilla: getValue(paramsLike, 'upazilla', ['area']).trim(),
    subArea: getValue(paramsLike, 'subArea', ['sub_area', 'sub-area']).trim(),
    category: getValue(paramsLike, 'category').trim(),
    propertyType: getValue(paramsLike, 'propertyType', ['property_type', 'type']).trim(),
    minPrice: normalizePositiveNumber(getValue(paramsLike, 'minPrice', ['minBudget', 'min_budget'])),
    maxPrice: normalizePositiveNumber(getValue(paramsLike, 'maxPrice', ['maxBudget', 'max_budget'])),
    rooms: normalizePositiveNumber(getValue(paramsLike, 'rooms')),
    baths: normalizePositiveNumber(getValue(paramsLike, 'baths', ['bathrooms'])),
    amenities: parseAmenityList(getValue(paramsLike, 'amenities')).join(','),
    occupancy: getValue(paramsLike, 'occupancy').trim().toLowerCase(),
    includeNegotiable: getValue(paramsLike, 'includeNegotiable') === '1' ? '1' : '',
    sort: getValue(paramsLike, 'sort').trim(),
  }

  nextFilters.category = HOME_CATEGORIES.includes(nextFilters.category)
    ? nextFilters.category
    : DEFAULT_SEARCH_FILTERS.category
  nextFilters.propertyType =
    resolvePropertyTypeOption(nextFilters.propertyType) || DEFAULT_SEARCH_FILTERS.propertyType
  nextFilters.rooms = ROOM_FILTER_OPTIONS.includes(nextFilters.rooms) ? nextFilters.rooms : ''
  nextFilters.baths = BATHROOM_FILTER_OPTIONS.includes(nextFilters.baths) ? nextFilters.baths : ''
  nextFilters.occupancy = OCCUPANCY_FILTER_KEYS.includes(nextFilters.occupancy) ? nextFilters.occupancy : ''
  nextFilters.sort = SORT_OPTIONS.some((option) => option.value === nextFilters.sort)
    ? nextFilters.sort
    : DEFAULT_SEARCH_FILTERS.sort

  return buildLocationTrail(nextFilters)
}

export const getLocationOptions = (filters = DEFAULT_SEARCH_FILTERS) => {
  const normalizedFilters = buildLocationTrail(filters)
  const { division, district, upazilla } = normalizedFilters
  const districtsIn = (divisionName) => LOCATION_INDEX.districtsByDivision[divisionName] || []
  const scopeDistricts = district
    ? [district]
    : division
      ? districtsIn(division)
      : LOCATION_INDEX.divisions.flatMap(districtsIn)

  const upazillas = scopeDistricts.flatMap((districtName) => LOCATION_INDEX.upazillasByDistrict[districtName] || [])

  const subAreas = scopeDistricts.flatMap((districtName) =>
    (LOCATION_INDEX.upazillasByDistrict[districtName] || [])
      .filter((upazillaName) => !upazilla || upazillaName === upazilla)
      .flatMap((upazillaName) => LOCATION_INDEX.subAreasByUpazilla[subAreaListKey(districtName, upazillaName)] || [])
  )

  return {
    divisions: LOCATION_INDEX.divisions,
    districts: division ? districtsIn(division) : uniquePlaceNames(scopeDistricts),
    upazillas: uniquePlaceNames(upazillas.filter((name) => !/^others?$/i.test(name))),
    subAreas: uniquePlaceNames(subAreas),
  }
}

export const updateSearchFilters = (filters, key, value) => {
  const nextFilters = {
    ...DEFAULT_SEARCH_FILTERS,
    ...filters,
    [key]: typeof value === 'string' ? value : value?.toString?.() || '',
  }

  if (key === 'minPrice' || key === 'maxPrice' || key === 'rooms' || key === 'baths') {
    nextFilters[key] = normalizePositiveNumber(value)
  }

  if (key === 'amenities') {
    nextFilters.amenities = parseAmenityList(value).join(',')
  }

  if (key === 'occupancy' && !OCCUPANCY_FILTER_KEYS.includes(nextFilters.occupancy)) {
    nextFilters.occupancy = ''
  }

  if (key === 'includeNegotiable') {
    nextFilters.includeNegotiable = value === true || value === '1' ? '1' : ''
  }

  if (key === 'category' && !HOME_CATEGORIES.includes(nextFilters.category)) {
    nextFilters.category = DEFAULT_SEARCH_FILTERS.category
  }

  if (key === 'propertyType') {
    nextFilters.propertyType =
      resolvePropertyTypeOption(nextFilters.propertyType) || DEFAULT_SEARCH_FILTERS.propertyType
  }

  if (key === 'sort' && !SORT_OPTIONS.some((option) => option.value === nextFilters.sort)) {
    nextFilters.sort = DEFAULT_SEARCH_FILTERS.sort
  }

  // When division changes, clear downstream filters
  if (key === 'division') {
    nextFilters.district = ''
    nextFilters.upazilla = ''
    nextFilters.subArea = ''
  }

  // When district changes, keep the selected division and clear only downstream filters.
  if (key === 'district') {
    nextFilters.upazilla = ''
    nextFilters.subArea = ''
  }

  // When area changes, keep division/district and clear only sub-area.
  if (key === 'upazilla') {
    nextFilters.subArea = ''
  }

  return buildLocationTrail(nextFilters)
}

export const clearSearchFilter = (filters, key) => {
  // Amenity chips are 'amenity:<key>' and remove only that amenity.
  if (String(key).startsWith('amenity:')) {
    const amenity = String(key).slice('amenity:'.length)
    return updateSearchFilters(filters, 'amenities', parseAmenityList(filters.amenities).filter((entry) => entry !== amenity))
  }

  return updateSearchFilters(filters, key, DEFAULT_SEARCH_FILTERS[key] || '')
}

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
  const explicitDivision = normalizeText(item?.location?.division)
  const stateDistrict = normalizeText(item?.location?.state_district)
  const area = normalizeText(item?.location?.area)
  const subArea = normalizeText(item?.location?.sub_area)

  let division = explicitDivision
  let district = ''

  if (stateDistrict && !division) {
    if (LOCATION_INDEX.districtToDivision[stateDistrict]) {
      district = stateDistrict
      division = normalizeText(LOCATION_INDEX.districtToDivision[stateDistrict])
    } else if (LOCATION_INDEX.divisions.some((entry) => normalizeText(entry) === stateDistrict)) {
      division = stateDistrict
    }
  }

  if (area && !district && LOCATION_INDEX.districtToDivision[area]) {
    district = area
    division = normalizeText(LOCATION_INDEX.districtToDivision[area])
  }

  if (area && !district) {
    const candidates = LOCATION_INDEX.upazillaCandidates[area] || []
    if (candidates.length === 1) {
      district = normalizeText(candidates[0].district)
      division = normalizeText(candidates[0].division)
    }
  } else if (area && district && !division) {
    const candidate = (LOCATION_INDEX.upazillaCandidates[area] || []).find(
      (entry) => normalizeText(entry.district) === district
    )
    if (candidate) {
      division = normalizeText(candidate.division)
    }
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
    matchesPropertyTypeOption(item?.property_type, filters.propertyType) &&
    matchesBudgetFilters(item, filters) &&
    matchesRoomFilter(item, filters) &&
    matchesLocationFilters(item, filters) &&
    matchesKeywordSearch(item, filters.search)
  )
}

export const sortProperties = (properties, sort = DEFAULT_SEARCH_FILTERS.sort) => {
  const nextProperties = [...properties]
  const withPinnedFirst = (comparison) =>
    nextProperties.sort((left, right) => {
      const pinComparison = compareActivePinnedFirst(left, right)

      if (pinComparison !== 0) {
        return pinComparison
      }

      return comparison(left, right)
    })

  if (sort === 'price_low') {
    return withPinnedFirst(
      (left, right) =>
        (getPropertyPrice(left) ?? Number.MAX_SAFE_INTEGER) -
        (getPropertyPrice(right) ?? Number.MAX_SAFE_INTEGER)
    )
  }

  if (sort === 'price_high') {
    return withPinnedFirst(
      (left, right) => (getPropertyPrice(right) ?? -1) - (getPropertyPrice(left) ?? -1)
    )
  }

  return withPinnedFirst(
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

/**
 * Active filter chips as translation descriptors: render with `t(chip.labelKey, chip.vars)`.
 * `valueNamespace` marks `vars.value` as a DB enum that should go through `tv()` first, and
 * `valueLabelKey` marks it as a dictionary key (sort labels). `getSearchChipLabel` handles both.
 */
export const getActiveSearchChips = (filters = DEFAULT_SEARCH_FILTERS) => {
  const chips = []

  if (filters.search) chips.push({ key: 'search', labelKey: 'search.chips.keyword', vars: { value: filters.search } })
  if (filters.division) chips.push({ key: 'division', labelKey: 'search.chips.division', vars: { value: filters.division }, valueNamespace: 'divisions' })
  if (filters.district) chips.push({ key: 'district', labelKey: 'search.chips.district', vars: { value: filters.district } })
  if (filters.upazilla) chips.push({ key: 'upazilla', labelKey: 'search.chips.area', vars: { value: filters.upazilla } })
  if (filters.subArea) chips.push({ key: 'subArea', labelKey: 'search.chips.subArea', vars: { value: filters.subArea } })
  if (filters.category && filters.category !== 'All') chips.push({ key: 'category', labelKey: 'search.chips.category', vars: { value: filters.category }, valueNamespace: 'categories' })
  if (filters.propertyType && filters.propertyType !== 'All') chips.push({ key: 'propertyType', labelKey: 'search.chips.type', vars: { value: filters.propertyType }, valueNamespace: 'propertyTypes' })
  if (filters.minPrice) chips.push({ key: 'minPrice', labelKey: 'search.chips.minPrice', vars: { value: filters.minPrice } })
  if (filters.maxPrice) chips.push({ key: 'maxPrice', labelKey: 'search.chips.maxPrice', vars: { value: filters.maxPrice } })
  if (filters.rooms) chips.push({ key: 'rooms', labelKey: 'search.chips.rooms', vars: { value: filters.rooms } })
  if (filters.baths) chips.push({ key: 'baths', labelKey: 'search.chips.baths', vars: { value: filters.baths } })
  parseAmenityList(filters.amenities).forEach((amenity) => {
    chips.push({ key: `amenity:${amenity}`, labelKey: `search.amenities.${amenity}`, vars: { value: amenity } })
  })
  if (filters.occupancy) chips.push({ key: 'occupancy', labelKey: `search.occupancy.${filters.occupancy}`, vars: { value: filters.occupancy } })
  if (filters.includeNegotiable) chips.push({ key: 'includeNegotiable', labelKey: 'search.chips.includeNegotiable', vars: {} })
  if (filters.sort && filters.sort !== DEFAULT_SEARCH_FILTERS.sort) {
    const sortOption = SORT_OPTIONS.find((option) => option.value === filters.sort)
    chips.push({ key: 'sort', labelKey: 'search.chips.sort', vars: { value: filters.sort }, valueLabelKey: sortOption?.labelKey })
  }

  return chips
}

export const getSearchChipLabel = (chip, t, tv) => {
  let value = chip?.vars?.value

  if (chip?.valueLabelKey) {
    value = t(chip.valueLabelKey)
  } else if (chip?.valueNamespace && typeof tv === 'function') {
    value = tv(chip.valueNamespace, value)
  }

  return t(chip.labelKey, { ...chip.vars, value })
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
