import { stripPropertyIdPrefix } from '../../utils/propertyDisplaySerial'
import locationData from '../../thetolet_locations_bundle.json'

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

// "ID: 100001" (as shown on cards) and "#100001" both match the stored number.
export const normalizeSearchQuery = (searchQuery = '') =>
  stripPropertyIdPrefix(searchQuery).replace('#', '').toLowerCase().trim()

const LOCATION_INDEX = (() => {
  const divisionByKey = {}
  const districtToDivision = {}
  const upazillaToDistrict = {}
  const upazillaToDivision = {}
  const subAreaToUpazilla = {}
  const subAreaToDistrict = {}
  const subAreaToDivision = {}

  ;(locationData?.divisions || []).forEach((division) => {
    const divisionName = division?.name || ''

    if (!divisionName) {
      return
    }

    divisionByKey[normalizeSearchQuery(divisionName)] = divisionName

    ;(division.districts || []).forEach((district) => {
      const districtName = district?.name || ''

      if (!districtName) {
        return
      }

      districtToDivision[normalizeSearchQuery(districtName)] = divisionName

      ;(district.upazillas || []).forEach((upazilla) => {
        const upazillaName = upazilla?.name || ''

        if (!upazillaName) {
          return
        }

        upazillaToDistrict[normalizeSearchQuery(upazillaName)] = districtName
        upazillaToDivision[normalizeSearchQuery(upazillaName)] = divisionName

        ;(upazilla.sub_areas || []).forEach((subArea) => {
          const subAreaKey = normalizeSearchQuery(subArea)

          if (!subAreaKey) {
            return
          }

          subAreaToUpazilla[subAreaKey] = upazillaName
          subAreaToDistrict[subAreaKey] = districtName
          subAreaToDivision[subAreaKey] = divisionName
        })
      })
    })
  })

  return {
    divisionByKey,
    districtToDivision,
    upazillaToDistrict,
    upazillaToDivision,
    subAreaToUpazilla,
    subAreaToDistrict,
    subAreaToDivision,
  }
})()

const getPropertyPrice = (item) => {
  const amount = Number(item?.pricing?.rent_amount_bdt)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

const getPropertyLocationSearchValues = (item = {}) => {
  const stateDistrict = item?.location?.state_district ?? item?.state_district
  const area = item?.location?.area ?? item?.area
  const subArea = item?.location?.sub_area ?? item?.sub_area
  const values = [
    item?.location?.division,
    stateDistrict,
    area,
    subArea,
  ]
  const stateDistrictKey = normalizeSearchQuery(stateDistrict || '')
  const areaKey = normalizeSearchQuery(area || '')
  const subAreaKey = normalizeSearchQuery(subArea || '')

  if (LOCATION_INDEX.divisionByKey[stateDistrictKey]) {
    values.push(LOCATION_INDEX.divisionByKey[stateDistrictKey])
  }

  if (LOCATION_INDEX.districtToDivision[stateDistrictKey]) {
    values.push(LOCATION_INDEX.districtToDivision[stateDistrictKey])
  }

  if (LOCATION_INDEX.upazillaToDistrict[areaKey]) {
    values.push(LOCATION_INDEX.upazillaToDistrict[areaKey], LOCATION_INDEX.upazillaToDivision[areaKey])
  }

  if (LOCATION_INDEX.subAreaToUpazilla[subAreaKey]) {
    values.push(
      LOCATION_INDEX.subAreaToUpazilla[subAreaKey],
      LOCATION_INDEX.subAreaToDistrict[subAreaKey],
      LOCATION_INDEX.subAreaToDivision[subAreaKey]
    )
  }

  return Array.from(new Set(values.filter(Boolean)))
}

const getGeneratedPropertySearchText = (item = {}) => {
  const stateDistrict = item?.location?.state_district ?? item?.state_district
  const area = item?.location?.area ?? item?.area
  const subArea = item?.location?.sub_area ?? item?.sub_area
  const category = item?.category
  const propertyType = item?.property_type

  return [
    [category, propertyType].filter(Boolean).join(' '),
    [category, propertyType, area, stateDistrict].filter(Boolean).join(' '),
    [propertyType, area, subArea, stateDistrict].filter(Boolean).join(' '),
    [category, 'property', area, stateDistrict].filter(Boolean).join(' '),
  ]
}

export const matchesKeywordSearch = (item, searchQuery = '') => {
  const normalizedSearch = normalizeSearchQuery(searchQuery)

  if (!normalizedSearch) {
    return true
  }

  const priceText = getPropertyPrice(item)?.toString() || ''
  const searchableValues = [
    item?.id,
    item?.property_id_number,
    item?.category,
    item?.property_type,
    item?.floor_level,
    item?.occupancy,
    item?.pricing?.rent_period ?? item?.rent_period,
    item?.search_related_text,
    ...getPropertyLocationSearchValues(item),
    item?.location?.short_description,
    ...(Array.isArray(item?.amenities) ? item.amenities : []),
    ...getGeneratedPropertySearchText(item),
  ]
    .filter(Boolean)
    .map((value) => normalizeSearchQuery(String(value)))
    .filter(Boolean)
  const keywordTokens = normalizedSearch.split(/\s+/).filter(Boolean)
  const searchableText = searchableValues.join(' ')

  return (
    searchableValues.some((value) => value.includes(normalizedSearch)) ||
    keywordTokens.every((token) => searchableText.includes(token)) ||
    priceText.includes(normalizedSearch)
  )
}
