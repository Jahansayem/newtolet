// Responsive QA matrix runner.
// Usage: node scripts/qa/responsive-check.mjs --phase before|after [--routes a,b] [--widths 320,390]
//        [--journeys] [--only-journeys] [--channel chrome] [--headed] [--reduced-motion] [--compare]
import fs from 'node:fs'
import path from 'node:path'
import {
  AUTH_ROUTES,
  AUTH_STATE_PATH,
  OUT_ROOT,
  attachConsoleCapture,
  collectMetrics,
  ensureAuthState,
  ensureDir,
  hasCreds,
  launchBrowser,
  newContextFor,
  pad,
  parseCli,
  preflight,
  probeOverlaps,
  readJson,
  scrollSweep,
  settle,
  slugForRoute,
  verifyLoggedIn,
  writeJson,
} from './lib.mjs'
import { runJourneys } from './journeys.mjs'

const args = parseCli()

if (args.compare) {
  compare()
  process.exit(0)
}

const phaseDir = ensureDir(path.join(OUT_ROOT, args.phase))
const logFile = path.join(phaseDir, 'run.log')
const resultsFile = path.join(phaseDir, 'results.json')
const previous = args.resume && fs.existsSync(resultsFile) ? readJson(resultsFile) : null
if (!args.resume) fs.writeFileSync(logFile, '')
const log = (line) => {
  console.log(line)
  fs.appendFileSync(logFile, line + '\n')
}

await preflight(args.base)
const browser = await launchBrowser({ channel: args.channel, headed: args.headed })
const results = {
  phase: args.phase,
  startedAt: new Date().toISOString(),
  baseUrl: args.base,
  browser: browser.version(),
  auth: hasCreds() ? 'pending' : 'skipped (no creds)',
  fixture: Boolean(args.fixture),
  viewports: args.widths,
  routes: args.routes,
  cells: previous ? previous.cells : [],
  journeys: previous ? previous.journeys || [] : [],
}
const doneCells = new Set(results.cells.map((c) => `${c.slug}@${c.width}`))
const persist = () => writeJson(resultsFile, { ...results, updatedAt: new Date().toISOString() })

let firstListingId = null

async function resolveRoute(route, page) {
  if (!route.includes('__FIRST_LISTING__')) return route
  if (!firstListingId) {
    await page.goto(`${args.base}/`, { waitUntil: 'load', timeout: 90000 })
    await settle(page)
    firstListingId = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/listdetails"]')
      if (!a) return null
      try {
        return new URL(a.href).searchParams.get('id')
      } catch {
        return null
      }
    })
  }
  return firstListingId ? route.replace('__FIRST_LISTING__', firstListingId) : null
}

async function runCell({ route, width, contextKind, storageState }) {
  const slug = slugForRoute(route.replace('__FIRST_LISTING__', 'first')) + (contextKind === 'auth' ? '-auth' : '')
  if (doneCells.has(`${slug}@${width}`)) return
  const cell = { route, width, context: contextKind, slug, status: 'ok', startedAt: Date.now() }
  const context = await newContextFor(browser, width, { storageState, reducedMotion: args['reduced-motion'], fixture: args.fixture })
  let page = await context.newPage()
  let consoleRecord = attachConsoleCapture(page)
  const attempt = async () => {
    const resolved = await resolveRoute(route, page)
    if (!resolved) {
      cell.status = 'skipped'
      cell.reason = 'no listing available to open'
      return
    }
    const url = `${args.base}${resolved}`
    await page.goto(url, { waitUntil: 'load', timeout: 90000 })
    await settle(page)
    await scrollSweep(page)
    await page.waitForTimeout(300)
    cell.url = page.url().replace(args.base, '')
    cell.redirectedToLogin = page.url().includes('/login')
    const metrics = await page.evaluate(collectMetrics, { width, tapTargets: width <= 430 })
    Object.assign(cell, metrics)
    cell.overlaps = await probeOverlaps(page, width)
    const shot = path.join(phaseDir, `${slug}-${width}.png`)
    await page.screenshot({ path: shot, fullPage: true })
    cell.screenshot = path.relative(process.cwd(), shot)
    // First-screen capture for quick visual review (full-page shots can be 10k+ px tall).
    const topShot = path.join(phaseDir, `${slug}-${width}-top.png`)
    await page.screenshot({ path: topShot, fullPage: false })
    cell.screenshotTop = path.relative(process.cwd(), topShot)
  }
  try {
    await attempt()
  } catch (error) {
    cell.firstError = String(error.message).split('\n')[0].slice(0, 200)
    try {
      await page.close().catch(() => {})
      page = await context.newPage()
      consoleRecord = attachConsoleCapture(page)
      await attempt()
      cell.status = 'retried'
    } catch (error2) {
      cell.status = 'failed'
      cell.error = String(error2.message).split('\n')[0].slice(0, 200)
    }
  }
  cell.console = { errors: consoleRecord.errors, pageErrors: consoleRecord.pageErrors, ignored: consoleRecord.ignored, dialogs: consoleRecord.dialogs }
  cell.durationMs = Date.now() - cell.startedAt
  delete cell.startedAt
  await context.close()
  results.cells.push(cell)
  persist()
  log(formatRow(cell))
}

function formatRow(c) {
  const ov = c.overflow ? `${c.overflow.docOverflow ? 'DOC' : 'ok'}/${c.overflow.offenderCount}` : '-'
  const sticky = c.overlaps?.stickyNavbar?.present ? `${c.overlaps.stickyNavbar.overlapPx}` : '-'
  const bottom = c.overlaps?.bottomNavFooter?.present ? `${c.overlaps.bottomNavFooter.overlapPx}` : '-'
  const rows = c.cardRows ? c.cardRows.reduce((a, g) => a + g.flaggedRows, 0) : '-'
  const tap = c.tapTargets ? c.tapTargets.count : '-'
  const clip = c.textClip ? `${c.textClip.clipped}/${c.textClip.total}` : '-'
  const a11y = c.a11y ? `${c.a11y.imgNoAlt}/${c.a11y.unnamedControls}/${c.a11y.unlabeledInputs}/${c.a11y.hasMain ? 'M' : '-'}/${c.a11y.h1Count}` : '-'
  const cons = c.console ? `${c.console.errors.length}+${c.console.pageErrors.length}` : '-'
  return [
    pad(c.slug, 34),
    pad(c.width, 5),
    pad(c.status, 8),
    pad(ov, 8),
    pad(sticky, 7),
    pad(bottom, 7),
    pad(rows, 5),
    pad(tap, 5),
    pad(clip, 9),
    pad(a11y, 14),
    pad(cons, 6),
  ].join(' | ')
}

function header() {
  return [
    pad('route', 34),
    pad('W', 5),
    pad('status', 8),
    pad('ovfl', 8),
    pad('stkOvl', 7),
    pad('btmOvl', 7),
    pad('rows', 5),
    pad('tap', 5),
    pad('clip', 9),
    pad('img/name/lbl/main/h1', 14),
    pad('cons', 6),
  ].join(' | ')
}

try {
  let storageState = null
  if (hasCreds()) {
    try {
      storageState = await ensureAuthState(browser, args.base)
      const ctx = await newContextFor(browser, 1280, { storageState })
      const p = await ctx.newPage()
      const ok = await verifyLoggedIn(p, args.base)
      await ctx.close()
      results.auth = ok ? 'ok' : 'failed (storage state rejected)'
      if (!ok) storageState = null
    } catch (error) {
      results.auth = `failed (${String(error.message).split('\n')[0].slice(0, 120)})`
      storageState = null
    }
  }
  log(`[qa] phase=${args.phase} auth=${results.auth} fixture=${results.fixture} browser=${results.browser}`)

  if (!args['only-journeys']) {
    // Warm-up at 1280 so webpack compile time does not count against cells.
    const warm = await newContextFor(browser, 1280, { fixture: args.fixture })
    const wp = await warm.newPage()
    for (const route of args.routes) {
      const resolved = await resolveRoute(route, wp)
      if (!resolved) continue
      await wp.goto(`${args.base}${resolved}`, { waitUntil: 'load', timeout: 120000 }).catch((e) => log(`[warm] ${route}: ${e.message.split('\n')[0]}`))
    }
    if (storageState) {
      for (const route of AUTH_ROUTES) {
        await wp.goto(`${args.base}${route}`, { waitUntil: 'load', timeout: 120000 }).catch(() => {})
      }
    }
    await warm.close()

    log(header())
    for (const width of args.widths) {
      for (const route of args.routes) {
        await runCell({ route, width, contextKind: 'guest', storageState: null })
      }
      if (storageState) {
        for (const route of AUTH_ROUTES) {
          await runCell({ route, width, contextKind: 'auth', storageState })
        }
      }
    }
  }

  if (args.journeys || args['only-journeys']) {
    results.journeys = await runJourneys(browser, { base: args.base, storageState, log, phaseDir, fixture: args.fixture })
  }
} finally {
  await browser.close()
  results.finishedAt = new Date().toISOString()
  persist()
  if (!args['keep-auth'] && fs.existsSync(AUTH_STATE_PATH)) fs.unlinkSync(AUTH_STATE_PATH)
  log(`[qa] wrote ${path.relative(process.cwd(), path.join(phaseDir, 'results.json'))}`)
}

function compare() {
  const before = readJson(path.join(OUT_ROOT, 'before', 'results.json'))
  const after = readJson(path.join(OUT_ROOT, 'after', 'results.json'))
  const key = (c) => `${c.slug}@${c.width}`
  const afterMap = new Map(after.cells.map((c) => [key(c), c]))
  const metric = (c) => ({
    ovfl: c.overflow ? c.overflow.offenderCount : null,
    doc: c.overflow ? (c.overflow.docOverflow ? 1 : 0) : null,
    stk: c.overlaps?.stickyNavbar?.present ? c.overlaps.stickyNavbar.overlapPx : null,
    btm: c.overlaps?.bottomNavFooter?.present ? c.overlaps.bottomNavFooter.overlapPx : null,
    rows: c.cardRows ? c.cardRows.reduce((a, g) => a + g.flaggedRows, 0) : null,
    tap: c.tapTargets ? c.tapTargets.count : null,
    clip: c.textClip ? c.textClip.clipped : null,
    img: c.a11y ? c.a11y.imgNoAlt : null,
    name: c.a11y ? c.a11y.unnamedControls : null,
    lbl: c.a11y ? c.a11y.unlabeledInputs : null,
    main: c.a11y ? (c.a11y.hasMain ? 1 : 0) : null,
    h1: c.a11y ? c.a11y.h1Count : null,
    cons: c.console ? c.console.errors.length + c.console.pageErrors.length : null,
  })
  const fmt = (b, a) => (b === a ? String(a ?? '-') : `${b ?? '-'}→${a ?? '-'}`)
  console.log(
    [pad('route', 34), pad('W', 5), 'ovfl', 'doc', 'stk', 'btm', 'rows', 'tap', 'clip', 'img', 'name', 'lbl', 'main', 'h1', 'cons'].join(' | '),
  )
  for (const b of before.cells) {
    const a = afterMap.get(key(b))
    if (!a) continue
    const mb = metric(b)
    const ma = metric(a)
    console.log(
      [pad(b.slug, 34), pad(b.width, 5), ...Object.keys(mb).map((k) => fmt(mb[k], ma[k]))].join(' | '),
    )
  }
  const jb = new Map(before.journeys.map((j) => [`${j.name}@${j.width}`, j]))
  console.log('\nJourneys (before → after):')
  for (const ja of after.journeys) {
    const b = jb.get(`${ja.name}@${ja.width}`)
    const okB = b ? b.steps.filter((s) => s.ok).length + '/' + b.steps.length : '-'
    const okA = ja.steps.filter((s) => s.ok).length + '/' + ja.steps.length
    console.log(`${pad(ja.name, 28)} ${pad(ja.width, 5)} ${okB} → ${okA}`)
  }
}
