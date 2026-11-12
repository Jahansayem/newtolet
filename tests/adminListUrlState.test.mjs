import test from 'node:test'
import assert from 'node:assert/strict'
import { LIST_STATE_DEFAULTS, applyListUrlState, parseListUrlState } from '../src/lib/adminListUrlState.js'

const parse = (query) => parseListUrlState(new URLSearchParams(query))

test('an empty URL is the default view', () => {
  assert.deepEqual(parse(''), { ...LIST_STATE_DEFAULTS, sort: { column: 'created_at', dir: 'desc' } })
})

test('the default view writes no parameters and keeps unrelated ones', () => {
  const params = applyListUrlState(new URLSearchParams('tab=properties&edit=abc'), parse(''))
  assert.equal(params.toString(), 'tab=properties&edit=abc')
})

test('state survives a round trip through the URL', () => {
  const state = {
    tab: 'approved',
    page: 3,
    pageSize: 50,
    sort: { column: 'rent_amount_bdt', dir: 'asc' },
    search: 'mirpur flat',
    featured: 'true',
    archived: 'archived',
    phoneKey: '01712345678',
    category: 'Family',
    district: 'Dhaka',
    source: 'ai',
    photos: 'no',
    incomplete: '1',
    from: '2026-11-01',
    to: '2026-11-12',
  }
  const params = applyListUrlState(new URLSearchParams('tab=properties'), state)
  assert.deepEqual(parseListUrlState(params), state)
  assert.equal(params.get('tab'), 'properties')
})

test('the All tab is written as status=all', () => {
  const params = applyListUrlState(new URLSearchParams(), { ...parse(''), tab: '' })
  assert.equal(params.toString(), 'status=all')
  assert.equal(parseListUrlState(params).tab, '')
})

test('going back to defaults removes the parameters again', () => {
  const params = applyListUrlState(new URLSearchParams('tab=properties&status=rejected&page=4&q=x&by=ai&sort=status.asc'), parse(''))
  assert.equal(params.toString(), 'tab=properties')
})

test('invalid values fall back to defaults', () => {
  const state = parse('status=deleted&page=-2&size=7&sort=id.asc&by=robots&photos=maybe&from=yesterday&incomplete=yes&phone=017-1234%205678')
  assert.equal(state.tab, 'pending')
  assert.equal(state.page, 1)
  assert.equal(state.pageSize, 20)
  assert.deepEqual(state.sort, { column: 'created_at', dir: 'desc' })
  assert.equal(state.source, '')
  assert.equal(state.photos, '')
  assert.equal(state.from, '')
  assert.equal(state.incomplete, '')
  assert.equal(state.phoneKey, '01712345678')
})
