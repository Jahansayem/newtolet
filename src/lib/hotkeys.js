// Keyboard shortcut matching. Pure module: works on plain objects shaped like
// KeyboardEvent / Element, so it is safe for node --test.
//
// A combo is 'j', 'enter', '?', 'shift+s', 'mod+s' or 'mod+shift+s'. `mod` is
// Ctrl on Windows/Linux and Cmd on macOS.

export const parseHotkey = (combo = '') => {
  const parts = String(combo).toLowerCase().split('+').map((part) => part.trim()).filter(Boolean)
  const key = parts.pop() || ''
  return { key, shift: parts.includes('shift'), mod: parts.includes('mod') || parts.includes('ctrl'), alt: parts.includes('alt') }
}

export const matchesHotkey = (event, combo) => {
  const { key, shift, mod, alt } = parseHotkey(combo)
  if (!key || String(event?.key || '').toLowerCase() !== key) return false
  if (Boolean(event.ctrlKey || event.metaKey) !== mod) return false
  if (Boolean(event.altKey) !== alt) return false
  // Symbols such as '?' need Shift on most layouts, so Shift is not compared for them.
  const shiftMatters = key.length > 1 || /^[a-z0-9]$/.test(key)
  return shiftMatters ? Boolean(event.shiftKey) === shift : true
}

const tagOf = (target) => String(target?.tagName || '').toLowerCase()

/** True when the key press is text entry: a single-letter shortcut must not fire. */
export const isTypingTarget = (target) => {
  if (!target) return false
  if (target.isContentEditable) return true
  const tag = tagOf(target)
  if (tag === 'textarea' || tag === 'select') return true
  if (tag !== 'input') return false
  const type = String(target.type || 'text').toLowerCase()
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'].includes(type)
}

/** True when Enter or Space already means "activate this control". */
export const isActivationTarget = (target) => {
  if (!target) return false
  const tag = tagOf(target)
  if (tag === 'button' || tag === 'a' || tag === 'summary' || tag === 'input' || tag === 'select' || tag === 'textarea') return true
  const role = typeof target.getAttribute === 'function' ? target.getAttribute('role') : null
  return ['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch', 'option'].includes(role)
}

/**
 * Picks the binding to run for a key press, or null.
 * bindings: [{ combo, run, allowInInput?, allowInDialog? }]
 * context: { typing, overlayOpen, activation } describe where the key was pressed.
 */
export const pickHotkey = (event, bindings = [], { typing = false, overlayOpen = false, activation = false } = {}) => {
  for (const binding of bindings) {
    if (!binding || !matchesHotkey(event, binding.combo)) continue
    if (typing && !binding.allowInInput) continue
    if (overlayOpen && !binding.allowInDialog) continue
    const { key, mod } = parseHotkey(binding.combo)
    if (activation && !mod && (key === 'enter' || key === ' ')) continue
    return binding
  }
  return null
}
