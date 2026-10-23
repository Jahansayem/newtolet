// Shared helpers for the responsive QA harness.
// Dependency-free apart from playwright-core (installed with --no-save).
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..')
export const OUT_ROOT = path.join(ROOT, 'tmp', 'qa-screenshots')
export const AUTH_STATE_PATH = path.join(OUT_ROOT, '.auth-state.json')

export const DEFAULT_WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]
export const HEIGHTS = { 320: 568, 360: 740, 375: 667, 390: 844, 430: 932, 768: 1024, 1024: 768, 1280: 800, 1440: 900, 1920: 1080 }

export const PUBLIC_ROUTES = [
  '/',
  '/propertylist2/',
  '/propertylist2/?category=Family',
  '/listdetails/?id=__FIRST_LISTING__',
  '/login/',
  '/registration/',
  '/about/',
  '/contact/',
  '/addproperty/',
]
export const AUTH_ROUTES = ['/addproperty/', '/dashboard/?tab=saved', '/my-properties/']

export const IGNORED_CONSOLE = /bagelstoppage|adsterra|highperformanceformat|profitableratecpm|googlesyndication|doubleclick|ERR_BLOCKED_BY_CLIENT|favicon\.ico|Download the React DevTools|net::ERR_|Failed to load resource/i

export function parseCli() {
  const { values } = parseArgs({
    options: {
      phase: { type: 'string' },
      base: { type: 'string', default: 'http://localhost:3001' },
      routes: { type: 'string' },
      widths: { type: 'string' },
      journeys: { type: 'boolean', default: false },
      'only-journeys': { type: 'boolean', default: false },
      channel: { type: 'string' },
      headed: { type: 'boolean', default: false },
      'reduced-motion': { type: 'boolean', default: false },
      'keep-auth': { type: 'boolean', default: false },
      compare: { type: 'boolean', default: false },
      fixture: { type: 'boolean', default: false },
      resume: { type: 'boolean', default: false },
    },
    strict: true,
  })
  if (!values.phase && !values.compare) {
    throw new Error('--phase before|after is required')
  }
  return {
    ...values,
    widths: values.widths ? values.widths.split(',').map((w) => Number(w.trim())).filter(Boolean) : DEFAULT_WIDTHS,
    routes: values.routes ? values.routes.split(',').map((r) => r.trim()).filter(Boolean) : PUBLIC_ROUTES,
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function slugForRoute(route) {
  return route.replace(/^\//, '').replace(/\/$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'
}

export async function preflight(base) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(base, { signal: controller.signal })
    if (res.status !== 200) throw new Error(`GET ${base} returned ${res.status}`)
  } catch (error) {
    throw new Error(`Dev server not reachable at ${base}. Start it first with: npx next dev --webpack -p 3001 (${error.message})`)
  } finally {
    clearTimeout(t)
  }
}

export async function launchBrowser({ channel, headed }) {
  const { chromium } = await import('playwright-core')
  const options = { headless: !headed }
  if (channel) options.channel = channel
  try {
    return await chromium.launch(options)
  } catch (error) {
    if (channel) throw error
    console.warn(`[qa] bundled chromium failed (${error.message.split('\n')[0]}); retrying with channel=chrome`)
    return chromium.launch({ ...options, channel: 'chrome' })
  }
}

export async function newContextFor(browser, width, extra = {}) {
  const context = await browser.newContext({
    viewport: { width, height: HEIGHTS[width] || 900 },
    deviceScaleFactor: 1,
    isMobile: width <= 430,
    hasTouch: width <= 430,
    locale: 'en-US',
    reducedMotion: extra.reducedMotion ? 'reduce' : 'no-preference',
    storageState: extra.storageState,
  })
  await context.addInitScript(() => {
    try {
      localStorage.removeItem('newtolet:supabase-connection-failed-until')
      localStorage.removeItem('newtolet:supabase-restricted-until')
      localStorage.removeItem('addPropertyFormDraft')
    } catch {
      /* ignore */
    }
  })
  if (extra.fixture) {
    const { fixtureInitScript } = await import('./fixture.mjs')
    await context.addInitScript(fixtureInitScript())
  }
  return context
}

export function attachConsoleCapture(page) {
  const record = { errors: [], pageErrors: [], ignored: 0, dialogs: [] }
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (IGNORED_CONSOLE.test(text)) {
      record.ignored += 1
      return
    }
    record.errors.push(text.slice(0, 300))
  })
  page.on('pageerror', (error) => {
    record.pageErrors.push(String(error && error.message ? error.message : error).slice(0, 300))
  })
  page.on('dialog', async (dialog) => {
    record.dialogs.push(`${dialog.type()}: ${dialog.message().slice(0, 120)}`)
    await dialog.dismiss().catch(() => {})
  })
  return record
}

export async function settle(page, { maxMs = 6000 } = {}) {
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {})
  const started = Date.now()
  let quietSince = null
  while (Date.now() - started < maxMs) {
    // Only skeleton placeholders count; ad slots and decorative pulses are excluded.
    const skeletons = await page
      .evaluate(() => [...document.querySelectorAll('.animate-pulse')].filter((el) => !el.closest('[data-ad-slot], ins, iframe')).length)
      .catch(() => 0)
    if (skeletons === 0) {
      if (quietSince === null) quietSince = Date.now()
      if (Date.now() - quietSince >= 400) break
    } else {
      quietSince = null
    }
    await page.waitForTimeout(200)
  }
  // Ad scripts keep the network busy indefinitely, so a short fixed pause replaces networkidle.
  await page.waitForTimeout(600)
}

export async function scrollSweep(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight
    const max = () => document.documentElement.scrollHeight
    for (let y = 0; y < max(); y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, max())
    await new Promise((r) => setTimeout(r, 250))
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 300))
  })
}

// Browser-side metric collection. Must be self-contained (serialised into the page).
export function collectMetrics({ width, tapTargets }) {
  const vw = document.documentElement.clientWidth
  const cssPath = (el) => {
    const parts = []
    let n = el
    let depth = 0
    while (n && n.nodeType === 1 && depth < 6) {
      let s = n.tagName.toLowerCase()
      if (n.id) {
        parts.unshift(`${s}#${n.id}`)
        break
      }
      const cls = [...n.classList].slice(0, 3).map((c) => '.' + CSS.escape(c)).join('')
      const sib = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : []
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(n) + 1})`
      parts.unshift(s + cls)
      n = n.parentElement
      depth += 1
    }
    return parts.join(' > ')
  }
  const rectOf = (el) => {
    const r = el.getBoundingClientRect()
    return { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1) }
  }
  const isVisible = (el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"]')
  }
  const translatedOff = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const t = getComputedStyle(n).transform
      if (!t || t === 'none') continue
      const m = t.match(/matrix\(([^)]+)\)/)
      if (!m) continue
      const parts = m[1].split(',').map(parseFloat)
      const tx = parts[4]
      const ty = parts[5]
      const r = n.getBoundingClientRect()
      if (Math.abs(tx) >= r.width - 1 || Math.abs(ty) >= r.height - 1) return true
    }
    return false
  }
  const insideScroller = (el) => {
    for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX
      if (['auto', 'scroll', 'hidden', 'clip'].includes(ox)) {
        const r = n.getBoundingClientRect()
        if (r.right <= vw + 1 && r.left >= -1) return true
      }
    }
    return false
  }

  const offenders = []
  const offenderSet = new Set()
  for (const el of document.body.querySelectorAll('*')) {
    if (offenders.length >= 20) break
    if (!isVisible(el)) continue
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed' || translatedOff(el) || insideScroller(el)) continue
    const r = el.getBoundingClientRect()
    if (!(r.right > vw + 1 || r.left < -1)) continue
    if (el.parentElement && offenderSet.has(el.parentElement)) {
      offenderSet.add(el)
      continue
    }
    offenderSet.add(el)
    offenders.push({ selector: cssPath(el), rect: rectOf(el) })
  }
  const overflow = {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    docOverflow: document.documentElement.scrollWidth > vw,
    offenderCount: offenders.length,
    offenders,
  }

  const cardRows = []
  const grids = new Set(
    [...document.querySelectorAll('a[href*="/listdetails"]')]
      .map((a) => a.closest('.grid > *')?.parentElement)
      .filter(Boolean),
  )
  for (const grid of grids) {
    const rows = new Map()
    for (const card of grid.children) {
      const r = card.getBoundingClientRect()
      const key = Math.round(r.top / 4) * 4
      if (!rows.has(key)) rows.set(key, [])
      rows.get(key).push(+r.height.toFixed(1))
    }
    const rowList = [...rows].map(([top, hs]) => {
      const min = Math.min(...hs)
      const max = Math.max(...hs)
      return { top, count: hs.length, min, max, delta: +(max - min).toFixed(1), flagged: max - min > 8 }
    })
    cardRows.push({
      grid: cssPath(grid),
      cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      flaggedRows: rowList.filter((r) => r.flagged).length,
      rows: rowList,
    })
  }

  let tap = null
  if (tapTargets) {
    const sel = 'a, button, [role="button"], input[type="checkbox"], input[type="radio"], select'
    const small = [...document.querySelectorAll(sel)]
      .filter(isVisible)
      .filter((el) => !translatedOff(el))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
    tap = {
      count: small.length,
      samples: small.slice(0, 15).map(({ el, r }) => ({
        selector: cssPath(el),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
      })),
    }
  }

  const clampEls = [...document.querySelectorAll('[class*="line-clamp-"], .truncate')].filter(isVisible)
  const clipped = clampEls.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
  const textClip = {
    total: clampEls.length,
    clipped: clipped.length,
    samples: clipped.slice(0, 10).map((el) => ({ selector: cssPath(el), text: el.textContent.trim().slice(0, 50) })),
  }

  const accName = (el) =>
    (
      el.getAttribute('aria-label') ||
      (el.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || '')
        .join(' ') ||
      el.getAttribute('title') ||
      el.textContent ||
      [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ') ||
      el.querySelector('svg title')?.textContent ||
      ''
    ).trim()
  const imgNoAlt = [...document.images].filter((i) => !i.hasAttribute('alt') && isVisible(i))
  const unnamed = [...document.querySelectorAll('a, button, [role="button"]')].filter(isVisible).filter((el) => !accName(el))
  const unlabeled = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea')]
    .filter(isVisible)
    .filter((el) => !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title'))
  const a11y = {
    imgNoAlt: imgNoAlt.length,
    unnamedControls: unnamed.length,
    unlabeledInputs: unlabeled.length,
    hasMain: !!document.querySelector('main'),
    h1Count: document.querySelectorAll('h1').length,
    samples: {
      imgNoAlt: imgNoAlt.slice(0, 5).map(cssPath),
      unnamed: unnamed.slice(0, 10).map(cssPath),
      unlabeled: unlabeled.slice(0, 10).map(cssPath),
    },
  }

  return { width, overflow, cardRows, tapTargets: tap, textClip, a11y }
}

export async function probeOverlaps(page, width) {
  await page.evaluate(() => window.scrollTo(0, 450))
  await page.waitForTimeout(400)
  await page.evaluate(() => window.scrollTo(0, 400))
  await page.waitForTimeout(450)
  const stickyNavbar = await page.evaluate(() => {
    const nav = document.querySelector('header.sticky.top-0.z-50, div.sticky.top-0.z-50')
    const navRect = nav ? nav.getBoundingClientRect() : null
    const navVisible = !!navRect && navRect.bottom > 0 && navRect.height > 0
    const bars = [...document.querySelectorAll('.sticky')].filter((e) => e !== nav && getComputedStyle(e).position === 'sticky')
    const bar = bars.find((e) => e.getBoundingClientRect().height > 0)
    if (!bar) return { present: false, navHeight: navRect ? +navRect.height.toFixed(1) : null }
    const b = bar.getBoundingClientRect()
    return {
      present: true,
      navVisible,
      navHeight: navRect ? +navRect.height.toFixed(1) : null,
      navBottom: navRect ? +navRect.bottom.toFixed(1) : null,
      barTop: +b.top.toFixed(1),
      gapPx: navVisible ? +(b.top - navRect.bottom).toFixed(1) : null,
      overlapPx: navVisible ? Math.max(0, +(navRect.bottom - b.top).toFixed(1)) : 0,
      stickyTopCss: getComputedStyle(bar).top,
    }
  })

  let bottomNavFooter = { present: false }
  if (width < 640) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(400)
    bottomNavFooter = await page.evaluate(() => {
      const nav = [...document.querySelectorAll('div, nav')].find(
        (d) => d.classList.contains('fixed') && d.classList.contains('bottom-0') && d.classList.contains('sm:hidden'),
      )
      const footer = document.querySelector('footer')
      if (!nav || !footer || nav.getBoundingClientRect().height === 0) return { present: false }
      const navTop = nav.getBoundingClientRect().top
      const last = [...footer.querySelectorAll('*')].reduce((m, el) => Math.max(m, el.getBoundingClientRect().bottom), 0)
      return {
        present: true,
        navHeight: +nav.getBoundingClientRect().height.toFixed(1),
        navTop: +navTop.toFixed(1),
        footerContentBottom: +last.toFixed(1),
        overlapPx: Math.max(0, +(last - navTop).toFixed(1)),
      }
    })
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  return { stickyNavbar, bottomNavFooter }
}

export function hasCreds() {
  return Boolean(process.env.QA_TEST_EMAIL && process.env.QA_TEST_PASSWORD)
}

export async function loginViaUi(page, base) {
  await page.goto(`${base}/login/`, { waitUntil: 'load', timeout: 60000 })
  const email = page.locator('input[type="email"]').first()
  await email.waitFor({ state: 'visible', timeout: 15000 })
  await email.fill(process.env.QA_TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(process.env.QA_TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 })
}

export async function ensureAuthState(browser, base) {
  if (!hasCreds()) return null
  if (fs.existsSync(AUTH_STATE_PATH)) return AUTH_STATE_PATH
  const context = await newContextFor(browser, 1280)
  const page = await context.newPage()
  try {
    await loginViaUi(page, base)
    await context.storageState({ path: AUTH_STATE_PATH })
    return AUTH_STATE_PATH
  } finally {
    await context.close()
  }
}

export async function verifyLoggedIn(page, base) {
  await page.goto(`${base}/addproperty/`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(3500)
  return !page.url().includes('/login')
}

// 2x2 opaque PNG (valid file for upload tests).
export const PNG_2x2 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8Dwn4GBgQEADgYDAbVnHhAAAAAASUVORK5CYII=',
  'base64',
)

export function writeJson(file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function pad(value, len) {
  const s = String(value ?? '')
  return s.length >= len ? s : s + ' '.repeat(len - s.length)
}
