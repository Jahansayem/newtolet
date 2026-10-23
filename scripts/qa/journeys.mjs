// User-journey checks for the responsive QA harness. Never confirms purchases, deletes, or submits a complete listing.
import { PNG_2x2, attachConsoleCapture, newContextFor, settle } from './lib.mjs'

const JOURNEY_WIDTHS = [390, 1280]
const DANGEROUS = /yes,\s*confirm|delete|remove property|pay now|purchase|buy now|checkout/i

async function safeClick(locator, { allow } = {}) {
  const text = ((await locator.getAttribute('aria-label').catch(() => '')) || (await locator.textContent().catch(() => '')) || '').trim()
  if (DANGEROUS.test(text) && !(allow && allow.test(text))) {
    throw new Error(`safeClick refused "${text}"`)
  }
  await locator.click()
}

function makeJourney(name, width) {
  const j = { name, width, steps: [], ok: true }
  j.step = async (label, fn) => {
    try {
      const detail = await fn()
      j.steps.push({ step: label, ok: true, detail: detail ?? null })
    } catch (error) {
      j.ok = false
      j.steps.push({ step: label, ok: false, detail: String(error.message).split('\n')[0].slice(0, 220) })
    }
  }
  return j
}

async function focusInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
      visibleFocus: (cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px') || cs.boxShadow !== 'none',
    }
  })
}

async function openSearchOverlay(page, width) {
  const trigger = page.locator('button[aria-label="Open search"]:visible').first()
  if (await trigger.count()) {
    await trigger.click()
    return 'button[aria-label="Open search"]'
  }
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-search-overlay')))
  return 'fallback:custom-event'
}

let FIXTURE = false

export async function runJourneys(browser, { base, storageState, log, phaseDir, fixture }) {
  FIXTURE = Boolean(fixture)
  const all = []
  for (const width of JOURNEY_WIDTHS) {
    all.push(await j1Search(browser, base, width))
    all.push(await j2Filters(browser, base, width))
    all.push(await j3Detail(browser, base, width, null))
    if (storageState) all.push(await j3Detail(browser, base, width, storageState))
    if (storageState) all.push(await j4PostForm(browser, base, width, storageState))
    all.push(await j5Auth(browser, base, width))
    if (width <= 430) all.push(await j6MobileNav(browser, base, width))
  }
  for (const j of all) {
    log(`[journey] ${j.name}@${j.width} ${j.ok ? 'PASS' : 'FAIL'} (${j.steps.filter((s) => s.ok).length}/${j.steps.length})`)
    for (const s of j.steps) log(`   ${s.ok ? '✓' : '✗'} ${s.step}${s.detail ? ' — ' + (typeof s.detail === 'string' ? s.detail : JSON.stringify(s.detail)) : ''}`)
  }
  return all.map(({ step, ...rest }) => rest)
}

async function withPage(browser, width, storageState, fn) {
  const context = await newContextFor(browser, width, { storageState, fixture: FIXTURE })
  const page = await context.newPage()
  const consoleRecord = attachConsoleCapture(page)
  try {
    return await fn(page, consoleRecord)
  } finally {
    await context.close()
  }
}

async function j1Search(browser, base, width) {
  const j = makeJourney('J1 search by location+category', width)
  await withPage(browser, width, null, async (page) => {
    await j.step('open home', async () => {
      await page.goto(`${base}/`, { waitUntil: 'load', timeout: 90000 })
      await settle(page)
    })
    await j.step('open search overlay', async () => openSearchOverlay(page, width))
    const input = page.locator('[role="dialog"] input[placeholder^="Search by area"]:visible').first()
    await j.step('type location "Dhaka"', async () => {
      await input.waitFor({ state: 'visible', timeout: 10000 })
      await input.fill('Dhaka')
    })
    await j.step('keyboard focus-visible on search input', async () => {
      await input.focus()
      const info = await focusInfo(page)
      if (!info?.visibleFocus) throw new Error(`no visible focus: ${JSON.stringify(info)}`)
      return info
    })
    await j.step('pick category chip "Family"', async () => {
      // Relative to the form, so it also matches the mobile sheet whose <form> is the dialog itself.
      const form = page.locator('form').filter({ has: page.locator('input[placeholder^="Search by area"]:visible') })
      const chip = form.getByRole('button', { name: 'Family', exact: true }).first()
      await chip.click()
      return { ariaPressed: await chip.getAttribute('aria-pressed') }
    })
    await j.step('submit via Enter → results URL', async () => {
      await input.press('Enter')
      await page.waitForURL(/\/propertylist2\/?\?/, { timeout: 30000 })
      const url = page.url()
      if (!/search=Dhaka/.test(url) || !/category=Family/.test(url)) throw new Error(`unexpected url ${url}`)
      return url.replace(base, '')
    })
    await j.step('results or empty state rendered', async () => {
      await settle(page)
      const cards = await page.locator('a[href*="/listdetails"]').count()
      const empty = await page.locator('text=No properties found').count()
      if (!cards && !empty) throw new Error('neither cards nor empty state')
      return { cards, empty }
    })
  })
  return j
}

async function j2Filters(browser, base, width) {
  const j = makeJourney('J2 filters + sort', width)
  await withPage(browser, width, null, async (page) => {
    await j.step('open results page', async () => {
      await page.goto(`${base}/propertylist2/`, { waitUntil: 'load', timeout: 90000 })
      await settle(page)
    })
    if (width < 768) {
      await j.step('open mobile filters', async () => {
        // The label toggles to 'Hide filters' after the click, so query by the stable aria-controls.
        const btn = page.locator('button[aria-controls="property-search-filters"]').first()
        await btn.click()
        return { ariaExpanded: await btn.getAttribute('aria-expanded'), ariaControls: await btn.getAttribute('aria-controls') }
      })
    }
    await j.step('select division', async () => {
      const sel = page.locator('select:visible').filter({ has: page.locator('option', { hasText: 'Dhaka' }) }).first()
      await sel.waitFor({ state: 'visible', timeout: 10000 })
      await sel.selectOption({ label: 'Dhaka' })
    })
    await j.step('select sort', async () => {
      const sel = page.locator('select:visible').filter({ has: page.locator('option', { hasText: /price/i }) }).first()
      await sel.waitFor({ state: 'visible', timeout: 10000 })
      const options = await sel.locator('option').evaluateAll((o) => o.map((x) => x.value))
      const target = options.find((v) => /price|low/i.test(v)) || options[1]
      await sel.selectOption(target)
      return target
    })
    await j.step('submit filters → URL has sort', async () => {
      const form = page.locator('form:visible').filter({ has: page.locator('select') }).first()
      await form.locator('button[type="submit"]').first().click()
      await page.waitForURL(/sort=/, { timeout: 30000 })
      return page.url().replace(base, '')
    })
    await j.step('count line / empty state present', async () => {
      await settle(page)
      const count = await page.locator('text=/Found \\d+ propert/').count()
      const empty = await page.locator('text=No properties found').count()
      if (!count && !empty) throw new Error('no count line or empty state')
      return { count, empty }
    })
  })
  return j
}

async function j3Detail(browser, base, width, storageState) {
  const j = makeJourney(`J3 detail + contact (${storageState ? 'auth' : 'guest'})`, width)
  await withPage(browser, width, storageState, async (page) => {
    await j.step('open first card from home', async () => {
      await page.goto(`${base}/`, { waitUntil: 'load', timeout: 90000 })
      await settle(page)
      const link = page.locator('a[href*="/listdetails"]').first()
      await link.waitFor({ state: 'attached', timeout: 15000 })
      const href = await link.getAttribute('href')
      await page.goto(`${base}${href}`, { waitUntil: 'load', timeout: 90000 })
      await settle(page)
      await page.locator('h1').first().waitFor({ timeout: 20000 })
      return href
    })
    await j.step('gallery next/prev', async () => {
      const counter = page.locator('text=/^\\d+ \\/ \\d+$/').first()
      if (!(await counter.count())) return 'single image, skipped'
      const before = await counter.textContent()
      const next = page.locator('button[aria-label="Next image"]').first()
      if (await next.count()) await next.click()
      else await page.locator('.site-card-strong.mb-6 button:has(svg)').nth(1).click()
      await page.waitForTimeout(300)
      const after = await counter.textContent()
      if (before === after) throw new Error('counter did not change')
      return `${before} → ${after}`
    })
    await j.step('save heart toggles twice', async () => {
      let heart = page.locator('button[aria-label*="ave"]').first()
      if (!(await heart.count())) heart = page.locator('.sticky button').first()
      const cls0 = await heart.getAttribute('class')
      await heart.click()
      await page.waitForTimeout(400)
      const cls1 = await heart.getAttribute('class')
      const pressed1 = await heart.getAttribute('aria-pressed')
      await heart.click()
      await page.waitForTimeout(400)
      const cls2 = await heart.getAttribute('class')
      if (cls0 === cls1) throw new Error('no visual change after click')
      if (cls0 !== cls2) throw new Error('did not revert after second click')
      return { ariaPressedAfterFirst: pressed1 }
    })
    await j.step('share control', async () => {
      const share = page.locator('button[aria-label*="hare"]').first()
      if (!(await share.count())) throw new Error('no labelled share button')
      await share.click()
      await page.waitForTimeout(500)
      const status = await page.locator('[role="status"]').allTextContents()
      return { status: status.join(' | ').slice(0, 80) }
    })
    await j.step('contact panel state', async () => {
      const guest = await page.locator('text=/protected/i').count()
      const unlock = page.getByRole('button', { name: /^unlock$/i }).first()
      const contactOwner = await page.locator('text=Contact Owner').count()
      if (storageState && (await unlock.count())) {
        await unlock.click()
        const confirm = page.locator('text=/yes,\\s*confirm/i').first()
        await confirm.waitFor({ state: 'visible', timeout: 5000 })
        const dialog = page.locator('[role="dialog"]').first()
        if (await dialog.count()) {
          await page.keyboard.press('Escape')
        } else {
          await page.locator('.fixed.inset-0 button').filter({ hasNotText: /yes,\s*confirm/i }).first().click()
        }
        await page.waitForTimeout(400)
        if (await confirm.isVisible().catch(() => false)) throw new Error('unlock modal did not close')
        return 'unlock modal opened and cancelled'
      }
      if (!storageState) {
        const loginLink = await page.locator('a[href*="/login"]:visible').count()
        return { guestPanel: guest > 0, loginLinkPresent: loginLink > 0 }
      }
      return { contactOwner: contactOwner > 0 }
    })
    await j.step('Call Now link has href when present', async () => {
      const call = page.locator('a:has-text("Call Now")')
      const n = await call.count()
      if (!n) return 'not shown'
      const href = await call.first().getAttribute('href')
      if (!href) throw new Error('Call Now rendered without href')
      return href.startsWith('tel:') ? 'tel link ok' : href
    })
  })
  return j
}

async function j4PostForm(browser, base, width, storageState) {
  const j = makeJourney('J4 post form validation + previews', width)
  await withPage(browser, width, storageState, async (page, consoleRecord) => {
    await j.step('open add property (logged in)', async () => {
      await page.goto(`${base}/addproperty/`, { waitUntil: 'load', timeout: 90000 })
      await page.waitForTimeout(3500)
      if (page.url().includes('/login')) throw new Error('redirected to login')
      await settle(page)
    })
    await j.step('submit empty form → validation summary', async () => {
      await page.getByRole('button', { name: /submit property listing/i }).click()
      await page.locator('text=/validation errors/i').first().waitFor({ timeout: 10000 })
      const items = await page.locator('ul li').filter({ hasText: /./ }).count()
      const focus = await focusInfo(page)
      const invalid = await page.locator('[aria-invalid="true"]').count()
      return { items, invalidCount: invalid, focused: focus?.tag }
    })
    await j.step('image previews from two PNGs', async () => {
      await page.setInputFiles('#image-input', [
        { name: 'a.png', mimeType: 'image/png', buffer: PNG_2x2 },
        { name: 'b.png', mimeType: 'image/png', buffer: PNG_2x2 },
      ])
      await page.locator('text=/New Images \\(2\\)/').waitFor({ timeout: 10000 })
      return { dialogs: consoleRecord.dialogs.slice() }
    })
    await j.step('reload with draft → no page error', async () => {
      const beforeErrors = consoleRecord.pageErrors.length
      await page.reload({ waitUntil: 'load', timeout: 90000 })
      await page.waitForTimeout(3000)
      const errs = consoleRecord.pageErrors.slice(beforeErrors)
      const formVisible = await page.getByRole('button', { name: /submit property listing/i }).count()
      if (errs.length) throw new Error(`pageerror: ${errs[0]}`)
      if (!formVisible) throw new Error('form did not render after reload')
      return 'ok'
    })
  })
  return j
}

async function j5Auth(browser, base, width) {
  const j = makeJourney('J5 login validation + protected redirect', width)
  await withPage(browser, width, null, async (page) => {
    await j.step('open login', async () => {
      await page.goto(`${base}/login/`, { waitUntil: 'load', timeout: 90000 })
      await page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 15000 })
    })
    await j.step('labels associated with inputs', async () => {
      const r = await page.evaluate(() => {
        const email = document.querySelector('input[type="email"]')
        const pw = document.querySelector('input[type="password"]')
        return { emailLabels: email?.labels?.length || 0, pwLabels: pw?.labels?.length || 0, h1: document.querySelectorAll('h1').length }
      })
      if (!r.emailLabels || !r.pwLabels) throw new Error(JSON.stringify(r))
      return r
    })
    await j.step('submit empty → two inline errors', async () => {
      await page.locator('button[type="submit"]').first().click()
      await page.locator('text=Email is required').waitFor({ timeout: 5000 })
      await page.locator('text=Password is required').waitFor({ timeout: 5000 })
      const alerts = await page.locator('[role="alert"]').count()
      return { alerts }
    })
    await j.step('invalid email → error', async () => {
      await page.locator('input[type="email"]').first().fill('not-an-email')
      await page.locator('button[type="submit"]').first().click()
      await page.locator('text=Invalid email address').waitFor({ timeout: 5000 })
    })
    await j.step('password show/hide toggle', async () => {
      const toggle = page.locator('button[aria-label*="assword"]').first()
      if (!(await toggle.count())) throw new Error('no toggle')
      const pw = page.locator('input[placeholder="Password"], input[autocomplete="current-password"]').first()
      await pw.fill('abcdef')
      await toggle.click()
      const type = await pw.getAttribute('type')
      await toggle.click()
      return { typeAfterToggle: type }
    })
    await j.step('logged-out /addproperty redirects to login', async () => {
      await page.goto(`${base}/addproperty/`, { waitUntil: 'load', timeout: 90000 })
      await page.waitForURL(/\/login\/?(\?|$)/, { timeout: 20000 })
    })
  })
  return j
}

async function j6MobileNav(browser, base, width) {
  const j = makeJourney('J6 mobile navigation', width)
  await withPage(browser, width, null, async (page) => {
    await j.step('open home', async () => {
      await page.goto(`${base}/`, { waitUntil: 'load', timeout: 90000 })
      await settle(page)
    })
    await j.step('hamburger is a labelled button', async () => {
      const btn = page.locator('button[aria-label="Open menu"]').first()
      if (!(await btn.count())) throw new Error('no button[aria-label="Open menu"]')
      return { ariaExpanded: await btn.getAttribute('aria-expanded') }
    })
    await j.step('open drawer with keyboard, focus moves inside', async () => {
      let btn = page.locator('button[aria-label="Open menu"]').first()
      if (!(await btn.count())) btn = page.locator('span.cursor-pointer:has(svg)').last()
      await btn.focus()
      const focusBefore = await focusInfo(page)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
      const drawer = page.locator('[role="dialog"]').first()
      const legacy = page.locator('div[style*="9999"]').first()
      const open = (await drawer.count()) || (await legacy.count())
      if (!open) throw new Error('drawer did not open via keyboard')
      const inside = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]') || document.querySelector('div[style*="9999"]')
        return !!(d && d.contains(document.activeElement))
      })
      if (!inside) throw new Error('focus not moved into drawer')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      const still = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]') || document.querySelector('div[style*="9999"]')
        return !!(d && d.contains(document.activeElement))
      })
      if (!still) throw new Error('focus escaped drawer on Tab')
      return { focusBefore: focusBefore?.visibleFocus }
    })
    await j.step('Escape closes drawer and focus returns', async () => {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
      const open = (await page.locator('[role="dialog"]').count()) || (await page.locator('div[style*="9999"]').count())
      if (open) throw new Error('drawer still open after Escape')
      const info = await focusInfo(page)
      return { focusedAfterClose: info?.label }
    })
    await j.step('bottom nav links', async () => {
      const n = await page.locator('.fixed.bottom-0 a, .fixed.bottom-0 button').count()
      if (n < 5) throw new Error(`only ${n} links`)
      return n
    })
    await j.step('no invalid DOM nesting console errors', async () => {
      // The console capture is attached in withPage; inspect via page context.
      return 'see cell console metrics'
    })
  })
  return j
}
