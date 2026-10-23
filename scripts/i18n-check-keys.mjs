#!/usr/bin/env node
/**
 * Diff translation key sets between English (source of truth) and Bengali.
 * Usage: node scripts/i18n-check-keys.mjs [--strict]
 * Exits non-zero when --strict and any key is missing in bn.
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')

const load = async (relative) => (await import(pathToFileURL(path.join(root, relative)).href)).default

const flatten = (obj, prefix = '', out = []) => {
  for (const [key, value] of Object.entries(obj || {})) {
    const full = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, full, out)
    } else {
      out.push(full)
    }
  }
  return out
}

const en = await load('src/i18n/locales/en.js')
const bn = await load('src/i18n/locales/bn.js')

const enKeys = new Set(flatten(en))
const bnKeys = new Set(flatten(bn))

const missingInBn = [...enKeys].filter((key) => !bnKeys.has(key)).sort()
const extraInBn = [...bnKeys].filter((key) => !enKeys.has(key)).sort()

console.log(`en keys: ${enKeys.size}, bn keys: ${bnKeys.size}`)

if (missingInBn.length) {
  console.log(`\nMissing in bn (${missingInBn.length}):`)
  for (const key of missingInBn) console.log(`  - ${key}`)
}

if (extraInBn.length) {
  console.log(`\nExtra in bn, not in en (${extraInBn.length}):`)
  for (const key of extraInBn) console.log(`  - ${key}`)
}

if (!missingInBn.length && !extraInBn.length) {
  console.log('OK: en and bn key sets match.')
}

if (strict && missingInBn.length) {
  process.exit(1)
}
