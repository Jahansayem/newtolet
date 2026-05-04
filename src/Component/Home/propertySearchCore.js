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

export const normalizeSearchQuery = (searchQuery = '') =>
  searchQuery.toLowerCase().replace('#', '').trim()

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim().toLowerCase()
}

const getPropertyPrice = (item) => {
  const amount = Number(item?.pricing?.rent_amount_bdt)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export const matchesKeywordSearch = (item, searchQuery = '') => {
  const normalizedSearch = normalizeSearchQuery(searchQuery)

  if (!normalizedSearch) {
    return true
  }

  const priceText = getPropertyPrice(item)?.toString() || ''
  const searchableValues = [
    item?.property_id_number,
    item?.category,
    item?.property_type,
    item?.location?.area,
    item?.location?.state_district,
    item?.location?.sub_area,
    item?.location?.short_description,
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value))

  return (
    searchableValues.some((value) => value.includes(normalizedSearch)) ||
    priceText.includes(normalizedSearch)
  )
}
