import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { DOUBLE_SLASH_GUARD } from '../src/lib/doubleSlashGuard.js'

// Runs the inline script against a fake `location` and returns where it sent
// the browser (null when it left the address alone).
const run = (pathname, search = '', hash = '') => {
  let target = null
  const location = { pathname, search, hash, replace: (url) => { target = url } }
  new Function('location', DOUBLE_SLASH_GUARD)(location)
  return target
}

test('an address starting with two slashes is sent to the single-slash address', () => {
  assert.equal(run('//admin/', '?tab=payment-links'), '/admin/?tab=payment-links')
  assert.equal(run('//admin', '?tab=payments', '#top'), '/admin?tab=payments#top')
  assert.equal(run('///pay/', '?c=ABCDEFGH23'), '/pay/?c=ABCDEFGH23')
  assert.equal(run('//bd//property-listing/'), '/bd/property-listing/')
  assert.equal(run('//'), '/')
})

test('normal addresses are left alone', () => {
  assert.equal(run('/'), null)
  assert.equal(run('/admin/', '?tab=payments'), null)
  assert.equal(run('/pay/', '?c=ABCDEFGH23'), null)
  // Only a leading double slash breaks the router; an inner one is harmless.
  assert.equal(run('/bd//property-listing/'), null)
})

test('the guard never throws, even without a usable location', () => {
  assert.doesNotThrow(() => new Function('location', DOUBLE_SLASH_GUARD)(undefined))
})

test('the layout runs the guard before anything else', () => {
  const layout = readFileSync(fileURLToPath(new URL('../app/layout.js', import.meta.url)), 'utf8')
  const guard = layout.indexOf('${DOUBLE_SLASH_GUARD}')
  const rest = layout.indexOf("localStorage.getItem('appLanguage')")
  assert.ok(guard > 0, 'app/layout.js does not include the double-slash guard')
  assert.ok(rest > guard, 'the guard must come first in the beforeInteractive script')
})
