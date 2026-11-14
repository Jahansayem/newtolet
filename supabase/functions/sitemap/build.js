// Pure sitemap.xml builder. Plain JS so the Deno Edge Function and `node --test` share it.

export const SITE_URL = 'https://www.newtolet.com'

export const STATIC_PATHS = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/bd/property-listing/', changefreq: 'hourly', priority: '0.9' },
  { path: '/about/', changefreq: 'monthly', priority: '0.4' },
  { path: '/contact/', changefreq: 'monthly', priority: '0.4' },
  { path: '/article/', changefreq: 'weekly', priority: '0.5' },
  { path: '/career/', changefreq: 'monthly', priority: '0.3' },
  { path: '/earnmoney/', changefreq: 'monthly', priority: '0.3' },
  { path: '/registration/', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms/', changefreq: 'yearly', priority: '0.2' },
  { path: '/privacy/', changefreq: 'yearly', priority: '0.2' },
  { path: '/refund/', changefreq: 'yearly', priority: '0.2' },
]

// Must match getLegacyDivisionSlug() in src/Component/Home/propertySearch.js.
export const DIVISION_SLUGS = [
  'barishal',
  'chattogram',
  'dhaka',
  'khulna',
  'mymensingh',
  'rajshahi',
  'rangpur',
  'sylhet',
]

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
export const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => XML_ESCAPES[char])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isoDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const urlEntry = ({ loc, lastmod, changefreq, priority }) =>
  [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : '',
    priority ? `    <priority>${priority}</priority>` : '',
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n')

/**
 * @param {Array<{id: string, updated_at?: string, created_at?: string}>} listings approved, live rows
 * @param {{ divisionSlugs?: string[] }} [options] slugs to include (defaults to all 8)
 */
export function buildSitemapXml(listings = [], { divisionSlugs = DIVISION_SLUGS } = {}) {
  const entries = [
    ...STATIC_PATHS.map(({ path, changefreq, priority }) => ({ loc: `${SITE_URL}${path}`, changefreq, priority })),
    ...divisionSlugs.map((slug) => ({
      loc: `${SITE_URL}/bd/property-division/${slug}/`,
      changefreq: 'daily',
      priority: '0.8',
    })),
    ...listings
      .filter((row) => row && UUID_PATTERN.test(String(row.id || '')))
      .map((row) => ({
        loc: `${SITE_URL}/listdetails/?id=${row.id}`,
        lastmod: isoDate(row.updated_at || row.created_at),
        changefreq: 'weekly',
        priority: '0.7',
      })),
  ]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(urlEntry),
    '</urlset>',
    '',
  ].join('\n')
}
