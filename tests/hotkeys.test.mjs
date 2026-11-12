import test from 'node:test'
import assert from 'node:assert/strict'
import { isActivationTarget, isTypingTarget, matchesHotkey, parseHotkey, pickHotkey } from '../src/lib/hotkeys.js'

const key = (value, extra = {}) => ({ key: value, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra })

test('parses plain, shifted and modified combos', () => {
  assert.deepEqual(parseHotkey('j'), { key: 'j', shift: false, mod: false, alt: false })
  assert.deepEqual(parseHotkey('Shift+S'), { key: 's', shift: true, mod: false, alt: false })
  assert.deepEqual(parseHotkey('mod+shift+s'), { key: 's', shift: true, mod: true, alt: false })
})

test('letters match regardless of Caps Lock but Shift must agree', () => {
  assert.equal(matchesHotkey(key('j'), 'j'), true)
  assert.equal(matchesHotkey(key('J'), 'j'), true)
  assert.equal(matchesHotkey(key('S', { shiftKey: true }), 's'), false)
  assert.equal(matchesHotkey(key('S', { shiftKey: true }), 'shift+s'), true)
  assert.equal(matchesHotkey(key('s'), 'shift+s'), false)
})

test('Ctrl or Cmd must agree with the combo', () => {
  assert.equal(matchesHotkey(key('s', { ctrlKey: true }), 's'), false)
  assert.equal(matchesHotkey(key('s', { ctrlKey: true }), 'mod+s'), true)
  assert.equal(matchesHotkey(key('s', { metaKey: true }), 'mod+s'), true)
  assert.equal(matchesHotkey(key('S', { ctrlKey: true, shiftKey: true }), 'mod+shift+s'), true)
  assert.equal(matchesHotkey(key('a', { altKey: true }), 'a'), false)
})

test('"?" matches with or without Shift; Enter matches by name', () => {
  assert.equal(matchesHotkey(key('?', { shiftKey: true }), '?'), true)
  assert.equal(matchesHotkey(key('?'), '?'), true)
  assert.equal(matchesHotkey(key('Enter'), 'enter'), true)
  assert.equal(matchesHotkey(key('Enter', { shiftKey: true }), 'enter'), false)
})

test('text fields count as typing; checkboxes and buttons do not', () => {
  assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'text' }), true)
  assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'search' }), true)
  assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'date' }), true)
  assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true)
  assert.equal(isTypingTarget({ tagName: 'SELECT' }), true)
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true)
  assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' }), false)
  assert.equal(isTypingTarget({ tagName: 'BUTTON' }), false)
  assert.equal(isTypingTarget({ tagName: 'BODY' }), false)
  assert.equal(isTypingTarget(null), false)
})

test('controls that Enter already activates are recognised', () => {
  assert.equal(isActivationTarget({ tagName: 'BUTTON' }), true)
  assert.equal(isActivationTarget({ tagName: 'A' }), true)
  assert.equal(isActivationTarget({ tagName: 'DIV', getAttribute: () => 'tab' }), true)
  assert.equal(isActivationTarget({ tagName: 'BODY', getAttribute: () => null }), false)
})

const bindings = [
  { combo: 'j', run: 'down' },
  { combo: 'enter', run: 'open' },
  { combo: 's', run: 'save' },
  { combo: 'mod+s', run: 'save-anywhere', allowInInput: true },
  { combo: '?', run: 'help', allowInDialog: true },
]
const picked = (event, context) => pickHotkey(event, bindings, context)?.run ?? null

test('single letters are ignored while typing; Ctrl combos marked for it still work', () => {
  assert.equal(picked(key('j')), 'down')
  assert.equal(picked(key('j'), { typing: true }), null)
  assert.equal(picked(key('s'), { typing: true }), null)
  assert.equal(picked(key('s', { ctrlKey: true }), { typing: true }), 'save-anywhere')
})

test('shortcuts are ignored while a dialog is open unless they allow it', () => {
  assert.equal(picked(key('j'), { overlayOpen: true }), null)
  assert.equal(picked(key('?', { shiftKey: true }), { overlayOpen: true }), 'help')
})

test('Enter on a focused button is left to the button', () => {
  assert.equal(picked(key('Enter')), 'open')
  assert.equal(picked(key('Enter'), { activation: true }), null)
  assert.equal(picked(key('j'), { activation: true }), 'down')
})
