// Runs public/sw.js in a sandbox with a fake Cache API and network, and drives
// its fetch handler the way a browser would.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const SOURCE = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const API = 'https://api.newtolet.com/rest/v1'
const ANON_KEY = 'anon-key'

const createWorker = ({ network }) => {
  const listeners = {}
  const stored = new Map()
  const putCalls = []
  const cache = {
    match: async (request) => stored.get(request.url)?.clone(),
    put: async (request, response) => {
      putCalls.push(response.status)
      // Same rule as the browser Cache API.
      if (response.status === 206) throw new TypeError('Partial response (status code 206) is unsupported')
      stored.set(request.url, response)
    },
  }
  const sandbox = {
    self: {
      location: { hostname: 'www.newtolet.com', origin: 'https://www.newtolet.com' },
      addEventListener: (type, handler) => {
        listeners[type] = handler
      },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
      registration: { unregister: async () => {} },
    },
    caches: { open: async () => cache, match: async () => undefined, keys: async () => [], delete: async () => true },
    fetch: network,
    Response,
    Request,
    URL,
    Promise,
    Set,
  }
  vm.runInNewContext(SOURCE, sandbox)

  /** Returns the worker's response, or null when it leaves the request to the browser. */
  const dispatch = async (request) => {
    let responded = null
    const pending = []
    listeners.fetch({ request, respondWith: (promise) => (responded = promise), waitUntil: (promise) => pending.push(promise) })
    const response = responded ? await responded : null
    await Promise.all(pending)
    return response
  }

  return { dispatch, stored, putCalls }
}

const apiRequest = (query, { token = ANON_KEY } = {}) =>
  new Request(`${API}/${query}`, { headers: { apikey: ANON_KEY, authorization: `Bearer ${token}` } })

const pagedResponse = () =>
  new Response('[{"id":1}]', { status: 206, headers: { 'content-type': 'application/json', 'content-range': '0-0/4512' } })

test('a 206 paged listing response reaches the page instead of a made-up 504', async () => {
  const worker = createWorker({ network: async () => pagedResponse() })
  const response = await worker.dispatch(apiRequest('properties?select=id&status=eq.approved&offset=0&limit=20'))
  assert.equal(response.status, 206)
  assert.equal(await response.text(), '[{"id":1}]')
  assert.equal(worker.stored.size, 0, 'partial responses are not cached')
})

test('a cache write failure never replaces a good network response', async () => {
  const worker = createWorker({ network: async () => new Response('[]', { status: 200 }) })
  const failing = createWorker({ network: async () => new Response('[]', { status: 200 }) })
  // Baseline: a plain 200 is cached.
  assert.equal((await worker.dispatch(apiRequest('properties?select=id&status=eq.approved'))).status, 200)
  assert.equal(worker.stored.size, 1)
  // Same request when the cache itself is broken (quota, storage error).
  failing.stored.set = () => {
    throw new Error('QuotaExceededError')
  }
  const response = await failing.dispatch(apiRequest('properties?select=id&status=eq.approved'))
  assert.equal(response.status, 200)
})

test('signed-in requests are left to the browser and never cached', async () => {
  let networkCalls = 0
  const worker = createWorker({
    network: async () => {
      networkCalls += 1
      return new Response('[]', { status: 200 })
    },
  })
  const response = await worker.dispatch(apiRequest('properties?select=id,internal_note&status=eq.approved', { token: 'user-jwt' }))
  assert.equal(response, null, 'the worker does not call respondWith')
  assert.equal(networkCalls, 0)
  assert.equal(worker.stored.size, 0)
})

test('anonymous approved listings are still cached and served stale-while-revalidate', async () => {
  let version = 1
  const worker = createWorker({ network: async () => new Response(`[${version++}]`, { status: 200 }) })
  const request = () => apiRequest('properties?select=id&status=eq.approved')
  assert.equal(await (await worker.dispatch(request())).text(), '[1]')
  assert.equal(await (await worker.dispatch(request())).text(), '[1]', 'second visit is answered from the cache')
  assert.equal(await (await worker.dispatch(request())).text(), '[2]', 'and was refreshed in the background')
})

test('a real network failure is reported as a network error, not as HTTP 504', async () => {
  const worker = createWorker({
    network: async () => {
      throw new TypeError('Failed to fetch')
    },
  })
  const response = await worker.dispatch(apiRequest('properties?select=id&status=eq.approved'))
  assert.equal(response.type, 'error')
  assert.notEqual(response.status, 504)
})

test('requests the worker never handled stay untouched', async () => {
  const worker = createWorker({ network: async () => new Response('[]', { status: 200 }) })
  assert.equal(await worker.dispatch(apiRequest('properties?select=id&status=eq.pending')), null)
  assert.equal(await worker.dispatch(new Request(`${API}/properties?status=eq.approved`, { method: 'HEAD', headers: { apikey: ANON_KEY } })), null)
})
