// Link checker: every literal internal link in the source must point at a route the static
// export actually builds (or a file in public/). Catches nav/footer links to pages that do not
// exist, which the QA audit found on the live site.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCE_DIRS = ['src', 'components', 'app']
const SOURCE_EXTENSIONS = /\.(jsx?|mjs)$/

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      walk(full, out)
    } else {
      out.push(full)
    }
  }
  return out
}

// Routes = every app/**/page.js directory with route groups "(x)" removed.
const collectRoutes = () => {
  const routes = new Set()
  for (const file of walk(join(ROOT, 'app'))) {
    if (!/[\\/]page\.jsx?$/.test(file)) continue
    const segments = relative(join(ROOT, 'app'), file).split(sep).slice(0, -1).filter((part) => !/^\(.*\)$/.test(part))
    routes.add(`/${segments.join('/')}`.replace(/\/$/, '') || '/')
  }
  return routes
}

const routeExists = (routes, path) => {
  const clean = (path.split(/[?#]/)[0] || '/').replace(/\/$/, '') || '/'
  if (routes.has(clean)) return true
  // Dynamic segments such as /bd/property-division/[divisionSlug].
  for (const route of routes) {
    if (!route.includes('[')) continue
    const pattern = new RegExp(`^${route.replace(/\[[^\]]+\]/g, '[^/]+')}$`)
    if (pattern.test(clean)) return true
  }
  // Static assets served from public/.
  return existsSync(join(ROOT, 'public', clean))
}

const LINK_PATTERNS = [
  /\b(?:to|href)=\s*["'](\/[^"'\s{}$]*)["']/g,
  /\b(?:to|href)=\{\s*["'](\/[^"'\s{}$]*)["']\s*\}/g,
  /\b(?:to|href|path|learnMoreUrl)\s*:\s*["'](\/[^"'\s{}$]*)["']/g,
]

test('every literal internal link resolves to a built route or public file', () => {
  const routes = collectRoutes()
  const broken = []

  for (const dir of SOURCE_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      if (!SOURCE_EXTENSIONS.test(file)) continue
      const source = readFileSync(file, 'utf8')
      for (const pattern of LINK_PATTERNS) {
        for (const match of source.matchAll(pattern)) {
          const path = match[1]
          if (path.startsWith('//') || path.startsWith('/_next/') || path.startsWith('/api/')) continue
          if (!routeExists(routes, path)) {
            broken.push(`${relative(ROOT, file)}: ${path}`)
          }
        }
      }
    }
  }

  assert.deepEqual(broken, [], `Links to pages that do not exist:\n${broken.join('\n')}`)
})

test('the nav/footer pages the QA audit checked all exist', () => {
  const routes = collectRoutes()
  for (const path of ['/', '/about', '/contact', '/terms', '/privacy', '/refund', '/addproperty', '/earnmoney', '/career', '/article', '/registration', '/login', '/bd/property-listing']) {
    assert.ok(routes.has(path), `missing route ${path}`)
  }
})
