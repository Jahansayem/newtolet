import test from 'node:test'
import assert from 'node:assert/strict'
import { HOME_CATEGORIES } from '../src/lib/propertyCategories.js'
import {
  CATEGORY_PAGE_SLUGS,
  buildCategoryPageHref,
  buildCategoryPagePath,
  categoryPageJsonLd,
  getCategoryFromPagePath,
  getCategoryFromSlug,
  getCategoryPageSeo,
  getCategorySlug,
  serializeJsonLd,
} from '../src/lib/seo/categoryPages.js'
import { readFileSync } from 'node:fs'
import { CATEGORY_SLUGS, DIVISION_SLUGS, buildSitemapXml } from '../supabase/functions/sitemap/build.js'
// propertySearch.js (which wires these helpers into the search page) uses extensionless imports that
// only the bundler resolves, so its route handling is checked in the browser, not here.

test('every home category has a slug that maps back to it', () => {
  for (const category of HOME_CATEGORIES) {
    assert.equal(getCategoryFromSlug(getCategorySlug(category)), category)
  }
  assert.deepEqual([...CATEGORY_PAGE_SLUGS], ['family', 'bachelor', 'office', 'sublet', 'hostel', 'shop'])
  assert.equal(getCategoryFromSlug('FAMILY/'), 'Family')
  assert.equal(getCategoryFromSlug('villa'), '')
  assert.equal(getCategorySlug('Villa'), '')
})

test('category page paths end with a slash', () => {
  assert.equal(buildCategoryPagePath('Bachelor'), '/bd/property/category/bachelor/')
  assert.equal(buildCategoryPagePath('Nope'), '')
})

test('a pathname resolves to its category page', () => {
  assert.equal(getCategoryFromPagePath('/bd/property/category/office/'), 'Office')
  assert.equal(getCategoryFromPagePath('/bd/property/category/office'), 'Office')
  assert.equal(getCategoryFromPagePath('/bd/property/category/villa/'), '')
  assert.equal(getCategoryFromPagePath('/bd/property-listing/'), '')
})

test('category page hrefs keep other filters and drop the category param', () => {
  const params = new URLSearchParams('category=Family&minPrice=8000&rooms=2')
  assert.equal(buildCategoryPageHref('Family', params), '/bd/property/category/family/?minPrice=8000&rooms=2')
  assert.equal(params.get('category'), 'Family', 'the caller\'s params are not modified')
  assert.equal(buildCategoryPageHref('Shop'), '/bd/property/category/shop/')
  assert.equal(buildCategoryPageHref('Villa'), '')
})

test('category page metadata and JSON-LD', () => {
  for (const category of HOME_CATEGORIES) {
    const seo = getCategoryPageSeo(category)
    assert.ok(seo.title.length <= 70, `${category} title too long`)
    assert.ok(seo.description.length <= 160, `${category} description too long`)
  }
  const jsonLd = categoryPageJsonLd('Hostel')
  const crumbs = jsonLd['@graph'].find((node) => node['@type'] === 'BreadcrumbList').itemListElement
  assert.equal(crumbs.at(-1).item, 'https://www.newtolet.com/bd/property/category/hostel/')
  assert.doesNotMatch(serializeJsonLd({ text: '</script>' }), /<\/script>/)
})

test('sitemap division URLs match the pages the build creates', () => {
  // app/(site)/bd/property-division/[divisionSlug]/page.js builds getLegacyDivisionSlug() slugs.
  const source = readFileSync(new URL('../src/Component/Home/propertySearch.js', import.meta.url), 'utf8')
  const block = source.match(/LEGACY_DIVISION_SLUGS = Object\.freeze\(\{([\s\S]*?)\}\)/)[1]
  const builtSlugs = [...block.matchAll(/:\s*'([a-z-]+)'/g)].map((match) => match[1]).sort()
  assert.deepEqual([...DIVISION_SLUGS].sort(), builtSlugs)
})

test('the sitemap lists every category page', () => {
  assert.deepEqual(CATEGORY_SLUGS, [...CATEGORY_PAGE_SLUGS])
  const xml = buildSitemapXml([])
  for (const slug of CATEGORY_PAGE_SLUGS) {
    assert.match(xml, new RegExp(`<loc>https://www\\.newtolet\\.com/bd/property/category/${slug}/</loc>`))
  }
})
