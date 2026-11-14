// Turns search filters into PostgREST filter conditions. Pure (no Supabase import) so the exact
// conditions are unit-tested; propertyCatalogService applies them to a query.
//
// All OR/AND logic is emitted as one combined tree (see `combineGroups`) because sending several
// `or=` parameters is not something every PostgREST version ANDs together.
import { DISTRICT_STORED_SPELLINGS } from './aliases.js'
import { lookupPlace, resolveQuery, suggestPlace } from './locationIndex.js'
import { isPunctuationOnly, normalizeQuery } from './normalize.js'
import { AMENITY_FILTERS, OCCUPANCY_FILTERS, parseAmenityList } from './filterOptions.js'

/** Quote a value for a PostgREST logic tree: "...", with \ and " escaped. `%` stays a wildcard. */
export const quote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

const ilike = (column, pattern) => `${column}.ilike.${quote(pattern)}`
const orOf = (conditions) => (conditions.length === 1 ? conditions[0] : `or(${conditions.join(',')})`)
const andOf = (conditions) => (conditions.length === 1 ? conditions[0] : `and(${conditions.join(',')})`)

/** Every stored spelling of a district; prefix match tolerates trailing spaces ("Sylhet "). */
export const districtCondition = (district) =>
  orOf([district, ...(DISTRICT_STORED_SPELLINGS[district] || [])].map((name) => ilike('state_district', `${name}%`)))

const nameInAreaFields = (name) => orOf([ilike('area', `%${name}%`), ilike('sub_area', `%${name}%`)])

/**
 * SQL condition for a resolved place. Area-level matches are always tied to their district, so
 * "Uttara" cannot match an address in Chattogram that mentions "Uttara Abasik".
 */
export function placeCondition(place, index) {
  if (!place) return ''

  if (place.type === 'district') {
    return orOf(place.entries.map((entry) => districtCondition(entry.district)))
  }

  if (place.type === 'division') {
    const districts = index.districtsByDivision.get(place.name) || []
    return orOf([...new Set([place.name, ...districts])].map(districtCondition))
  }

  if (place.type === 'upazilla') {
    return orOf(place.entries.map((entry) => andOf([districtCondition(entry.district), nameInAreaFields(entry.upazilla)])))
  }

  if (place.type === 'subArea') {
    return orOf(place.entries.map((entry) => andOf([districtCondition(entry.district), nameInAreaFields(entry.subArea)])))
  }

  // Known alias outside the bundle (e.g. Farmgate): match the area fields only.
  return nameInAreaFields(place.name)
}

const FREE_TEXT_COLUMNS = ['area', 'sub_area', 'short_description', 'category', 'property_type', 'occupancy']

/** Every word must appear in at least one text column (AND of ORs). */
export function freeTextCondition(words = []) {
  const groups = words.map((word) => {
    const columns = /^\d{5,}$/.test(word) ? [...FREE_TEXT_COLUMNS, 'property_id_number'] : FREE_TEXT_COLUMNS
    return orOf(columns.map((column) => ilike(column, `%${word}%`)))
  })
  return groups.length ? andOf(groups) : ''
}

/** One PostgREST `or` argument that ANDs all groups: `(and(g1,g2))` or `(g1)`. */
export const combineGroups = (groups = []) => {
  const present = groups.filter(Boolean)
  if (!present.length) return ''
  return present.length === 1 ? present[0] : `and(${present.join(',')})`
}

/**
 * @param {object} filters normalised search filters (search, division, district, upazilla, subArea,
 *   category, propertyType, minPrice, maxPrice, includeNegotiable, rooms, baths, amenities, occupancy, sort)
 * @param {object} index createLocationIndex(...) result
 * @returns {{
 *   empty: boolean,               // query can match nothing (e.g. "!!!"): skip the request
 *   logic: string,                // value for query.or(...) wrapped in "(...)" by supabase-js, or ''
 *   category: string, propertyType: string,   // possibly derived from words like "family", "flat"
 *   amenities: string[][],        // each entry = stored values, all required
 *   occupancyValues: string[],
 *   place: object|null, suggestion: string,
 * }}
 */
export function buildSearchPlan(filters = {}, index) {
  const groups = []
  let category = filters.category && filters.category !== 'All' ? filters.category : 'All'
  let propertyType = filters.propertyType && filters.propertyType !== 'All' ? filters.propertyType : 'All'
  const amenityKeys = new Set(parseAmenityList(filters.amenities))
  let occupancy = filters.occupancy || ''
  let place = null
  let suggestion = ''

  if (isPunctuationOnly(filters.search)) {
    return { empty: true, logic: '', category, propertyType, amenities: [], occupancyValues: [], place, suggestion }
  }

  // Location dropdowns (most specific wins). They are exact picks, so no free-text expansion.
  if (filters.subArea) {
    const entries = [{ subArea: filters.subArea, district: filters.district || '' }]
    groups.push(entries[0].district ? andOf([districtCondition(entries[0].district), nameInAreaFields(filters.subArea)]) : nameInAreaFields(filters.subArea))
  } else if (filters.upazilla) {
    groups.push(filters.district ? andOf([districtCondition(filters.district), nameInAreaFields(filters.upazilla)]) : nameInAreaFields(filters.upazilla))
  } else if (filters.district) {
    groups.push(districtCondition(filters.district))
  } else if (filters.division) {
    groups.push(placeCondition({ type: 'division', name: filters.division, entries: [] }, index))
  }

  const normalized = normalizeQuery(filters.search)
  if (normalized) {
    const resolved = resolveQuery(index, normalized)
    place = resolved.place
    if (place) groups.push(placeCondition(place, index))

    resolved.wordFilters.forEach((wordFilter) => {
      if (wordFilter.category && category === 'All') category = wordFilter.category
      if (wordFilter.propertyType && propertyType === 'All') propertyType = wordFilter.propertyType
      if (wordFilter.amenity) amenityKeys.add(wordFilter.amenity)
      if (wordFilter.occupancy && !occupancy) occupancy = wordFilter.occupancy
    })

    if (resolved.freeText.length) groups.push(freeTextCondition(resolved.freeText))
    if (!place && resolved.freeText.length) suggestion = suggestPlace(index, resolved.freeText.join(' '))
  }

  // Price: "Negotiable" listings have no comparable price, so a price range excludes them
  // unless the user asks to include price-on-request listings.
  const min = Number(filters.minPrice) || 0
  const max = Number(filters.maxPrice) || 0
  if ((min || max) && filters.includeNegotiable) {
    const range = [min ? `rent_amount_bdt.gte.${min}` : '', max ? `rent_amount_bdt.lte.${max}` : ''].filter(Boolean)
    groups.push(orOf([andOf([...range, 'is_rent_negotiable.not.is.true']), 'is_rent_negotiable.is.true']))
  }

  return {
    empty: false,
    logic: combineGroups(groups),
    category,
    propertyType,
    amenities: [...amenityKeys].map((key) => AMENITY_FILTERS[key]).filter(Boolean),
    occupancyValues: OCCUPANCY_FILTERS[occupancy] || [],
    place,
    suggestion,
  }
}

export { lookupPlace }
