import test from 'node:test'
import assert from 'node:assert/strict'
import { buildIlikeOrFilter, escapePostgrestPatternValue, getKeywordSearchTerms } from '../src/lib/postgrestSearch.js'

test('escapes wildcards and strips or-syntax characters', () => {
  assert.equal(escapePostgrestPatternValue('100%_a*'), '100\\%\\_a\\*')
  assert.equal(escapePostgrestPatternValue('a(b),c'), 'a b  c')
})

test('terms: phrase plus words, min 2 chars, de-duplicated', () => {
  assert.deepEqual(getKeywordSearchTerms('Mirpur 10'), ['Mirpur 10', 'Mirpur', '10'])
  assert.deepEqual(getKeywordSearchTerms('a'), [])
  assert.deepEqual(getKeywordSearchTerms(''), [])
  assert.deepEqual(getKeywordSearchTerms('flat flat'), ['flat flat', 'flat'])
})

test('or filter covers every term and column', () => {
  assert.equal(buildIlikeOrFilter('dipto', ['name', 'email']), 'name.ilike.%dipto%,email.ilike.%dipto%')
  assert.equal(buildIlikeOrFilter('', ['name']), null)
  assert.equal(buildIlikeOrFilter('x', ['name']), null)
  assert.equal(buildIlikeOrFilter('abc', []), null)
})
