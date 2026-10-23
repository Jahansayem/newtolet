// TEST-ONLY listing fixture for layout verification when Supabase is unreachable.
// It is injected into the browser's localStorage snapshot cache for a single QA run.
// Nothing here is written to source, the database, or any user-visible build.
// Ids are deliberately non-UUID ("qa-fixture-…") so they can never collide with real data.

const CACHE_PREFIX = 'newtolet-cache:v1'
const CATALOG_VERSION = 'v3'
const HOMEPAGE_KEY = `properties:${CATALOG_VERSION}:homepage:72`
const ALL_KEY = `properties:${CATALOG_VERSION}:all:all:0`
const SEARCHABLE_KEY = `properties:${CATALOG_VERSION}:searchable:200`

const CATEGORIES = ['Family', 'Bachelor', 'Office', 'Sublet', 'Hostel', 'Shop']
const TYPES = ['Apartment', 'House', 'Room', 'Office Space', 'Shop', 'Warehouse']
const AREAS = [
  { area: 'Mirpur DOHS', district: 'Dhaka' },
  { area: 'Bashundhara Residential Area Block I', district: 'Dhaka' },
  { area: 'মিরপুর ডিওএইচএস', district: 'ঢাকা' },
  { area: 'Uttara Sector 13', district: 'Dhaka' },
  { area: 'Khulshi', district: 'Chattogram' },
  { area: 'Zindabazar', district: 'Sylhet' },
  { area: 'বনানী ডিওএইচএস আবাসিক এলাকা', district: 'ঢাকা' },
  { area: 'Shahjalal Upashahar', district: 'Sylhet' },
]
const AMENITIES = ['parking', 'lift', 'generator', 'gas', 'security', 'cctv']

const svgImage = (index) => {
  const hue = (index * 47) % 360
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">` +
    `<rect width="600" height="400" fill="hsl(${hue} 35% 72%)"/>` +
    `<rect x="60" y="120" width="480" height="200" rx="16" fill="hsl(${hue} 35% 55%)"/>` +
    `<text x="300" y="230" font-family="sans-serif" font-size="36" text-anchor="middle" fill="#fff">QA fixture ${index}</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function buildFixtureProperties(count = 30) {
  const now = Date.now()
  const items = []
  for (let i = 0; i < count; i += 1) {
    const category = CATEGORIES[i % CATEGORIES.length]
    const type = TYPES[i % TYPES.length]
    const loc = AREAS[i % AREAS.length]
    const negotiable = i % 5 === 0
    const rent = negotiable ? null : 8000 + (i % 9) * 2750
    const imageCount = 1 + (i % 3)
    const images = Array.from({ length: imageCount }, (_, k) => svgImage(i * 3 + k))
    const id = `qa-fixture-${String(i + 1).padStart(4, '0')}`
    const specs = {
      total_rooms: 1 + (i % 4),
      dining_rooms: i % 2,
      living_rooms: 1,
      total_bathrooms: 1 + (i % 2),
      total_balcony: i % 3,
      total_kitchen: 1,
      floor_level: `${(i % 9) + 1}th Floor`,
      room_size: 650 + (i % 6) * 120,
    }
    items.push({
      id,
      property_id_number: 9000 + i,
      category,
      normalizedCategory: category,
      property_type: type,
      ...specs,
      occupancy: i % 2 ? 'Only Family' : 'No Restriction',
      specifications: { ...specs },
      pricing: { rent_amount_bdt: rent, rent_period: 'Monthly', is_rent_negotiable: negotiable },
      location: {
        state_district: loc.district,
        area: loc.area,
        sub_area: i % 4 === 0 ? 'Road 7, House 12' : null,
        short_description:
          i % 3 === 0
            ? 'QA fixture listing used only for layout verification. Not a real property.'
            : 'লেআউট যাচাইয়ের জন্য ব্যবহৃত পরীক্ষামূলক তালিকা। এটি কোনো প্রকৃত প্রপার্টি নয়।',
      },
      amenities: AMENITIES.slice(0, 1 + (i % AMENITIES.length)),
      availability: { available_from: '2026-11-01', deadline: null },
      images,
      primary_image: images[0],
      lat: null,
      lng: null,
      status: 'approved',
      is_active: true,
      pinned_at: null,
      pinned_until: null,
      is_pinned: i === 2,
      created_at: new Date(now - i * 3600 * 1000).toISOString(),
      reviewed_at: new Date(now - i * 3600 * 1000).toISOString(),
    })
  }
  return items
}

export function fixtureInitScript() {
  const properties = buildFixtureProperties()
  const payload = JSON.stringify({ savedAt: Date.now(), data: properties })
  const keys = [HOMEPAGE_KEY, ALL_KEY, SEARCHABLE_KEY].map((k) => `${CACHE_PREFIX}:${k}`)
  return `(() => { try { const p = ${JSON.stringify(payload)}; ${JSON.stringify(keys)}.forEach((k) => localStorage.setItem(k, p)); window.__QA_FIXTURE__ = true; } catch (e) {} })();`
}

export const FIXTURE_FIRST_ID = 'qa-fixture-0001'
