// Location index over the bundle (divisions > districts > upazillas/areas > sub-areas) and the
// query resolver used by the listing search. Pure: the caller passes the bundle JSON in.
import { editDistance, placeKey } from './normalize.js'
import { areaHint, isStopword, placeAlias, wordFilter } from './aliases.js'

const pushTo = (map, key, value) => {
  if (!key) return
  const list = map.get(key)
  if (list) {
    if (!list.some((entry) => JSON.stringify(entry) === JSON.stringify(value))) list.push(value)
  } else {
    map.set(key, [value])
  }
}

export function createLocationIndex(locationData = {}) {
  const divisions = new Map()
  const districts = new Map()
  const upazillas = new Map()
  const subAreas = new Map()
  const districtsByDivision = new Map()
  const suggestionNames = new Map()

  for (const division of locationData.divisions || []) {
    if (!division?.name) continue
    divisions.set(placeKey(division.name), [{ division: division.name }])
    suggestionNames.set(placeKey(division.name), division.name)
    const districtNames = []

    for (const district of division.districts || []) {
      if (!district?.name) continue
      districtNames.push(district.name)
      pushTo(districts, placeKey(district.name), { district: district.name, division: division.name })
      suggestionNames.set(placeKey(district.name), district.name)

      for (const upazilla of district.upazillas || []) {
        if (!upazilla?.name || /^others?$/i.test(upazilla.name)) continue
        pushTo(upazillas, placeKey(upazilla.name), { upazilla: upazilla.name, district: district.name, division: division.name })
        suggestionNames.set(placeKey(upazilla.name), upazilla.name)

        for (const subArea of upazilla.sub_areas || []) {
          if (!subArea) continue
          pushTo(subAreas, placeKey(subArea), {
            subArea,
            upazilla: upazilla.name,
            district: district.name,
            division: division.name,
          })
        }
      }
    }

    districtsByDivision.set(division.name, districtNames)
  }

  return { divisions, districts, upazillas, subAreas, districtsByDivision, suggestionNames }
}

/**
 * Most specific meaning of one place word. When one name is both a district and its division
 * (all 8 divisions), the district wins: "Sylhet" means Sylhet district, not the whole division.
 */
export function lookupPlace(index, text) {
  const english = placeAlias(text)
  const key = placeKey(english || text)
  if (!key || key.length < 2) return null

  if (index.districts.has(key)) return { type: 'district', name: index.districts.get(key)[0].district, entries: index.districts.get(key) }
  if (index.upazillas.has(key)) return { type: 'upazilla', name: index.upazillas.get(key)[0].upazilla, entries: index.upazillas.get(key) }
  const hint = areaHint(key)
  if (hint) return { type: 'subArea', name: hint.name, entries: [{ subArea: hint.name, district: hint.district }] }
  if (index.divisions.has(key)) return { type: 'division', name: index.divisions.get(key)[0].division, entries: index.divisions.get(key) }
  if (index.subAreas.has(key)) return { type: 'subArea', name: index.subAreas.get(key)[0].subArea, entries: index.subAreas.get(key) }
  // A known alias that is not in the bundle (e.g. Farmgate) still searches by its English name.
  if (english) return { type: 'text', name: english, entries: [] }
  return null
}

/**
 * Split a normalised query into one place (longest matching word group), structured word
 * filters (family, flat, lift, ...) and the remaining free-text words.
 *
 * @returns {{ place: null | {type, name, entries}, wordFilters: object[], freeText: string[] }}
 */
export function resolveQuery(index, normalizedQuery = '') {
  const tokens = normalizedQuery.split(' ').filter(Boolean)
  const wordFilters = []
  const candidates = []

  // Pull out filter words and stopwords first so they never combine into a place name.
  tokens.forEach((token) => {
    const filter = wordFilter(token)
    if (filter) {
      wordFilters.push(filter)
    } else if (!isStopword(token)) {
      candidates.push(token)
    }
  })

  for (let size = Math.min(candidates.length, 4); size >= 1; size -= 1) {
    for (let start = 0; start + size <= candidates.length; start += 1) {
      const gram = candidates.slice(start, start + size).join(' ')
      const place = lookupPlace(index, gram)
      if (place) {
        const freeText = [...candidates.slice(0, start), ...candidates.slice(start + size)]
          // Numbers right after a place ("mirpur 10") stay with it as an area detail.
          .filter((token) => token.length >= 2 || /\d/.test(token))
        return { place, wordFilters, freeText }
      }
    }
  }

  return { place: null, wordFilters, freeText: candidates.filter((token) => token.length >= 2 || /\d/.test(token)) }
}

/** "Did you mean" for a query with no results: the closest known place name, if close enough. */
export function suggestPlace(index, normalizedQuery = '') {
  const key = placeKey(normalizedQuery)
  if (key.length < 4) return ''
  const maxDistance = key.length >= 7 ? 2 : 1
  let best = ''
  let bestDistance = maxDistance + 1

  for (const [nameKey, name] of index.suggestionNames) {
    if (nameKey === key) return ''
    const distance = editDistance(key, nameKey, maxDistance)
    if (distance < bestDistance) {
      best = name
      bestDistance = distance
    }
  }

  return bestDistance <= maxDistance ? best : ''
}
