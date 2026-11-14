// Query normalisation shared by the listing search (browser) and its unit tests (node --test).
// Unicode-aware: Bangla letters and vowel signs are combining marks (\p{M}), so they must be kept.

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯'

export const toAsciiDigits = (value = '') =>
  String(value).replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)))

/**
 * Lower-cased query with punctuation turned into spaces and Bangla digits made ASCII.
 * "  Mirpur-10, Dhaka!! " -> "mirpur 10 dhaka"; "!!!" -> "".
 */
export const normalizeQuery = (raw = '') =>
  toAsciiDigits(String(raw ?? '').normalize('NFKC'))
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** True when the user typed something but none of it is a letter or digit (e.g. "!!!"). */
export const isPunctuationOnly = (raw = '') => String(raw ?? '').trim() !== '' && normalizeQuery(raw) === ''

/**
 * Comparison key for place names: case, spaces and punctuation removed, so
 * "Bashundhara R.A" == "Bashundhara R/A" and "Chawk Bazar" == "Chawkbazar".
 */
export const placeKey = (name = '') =>
  toAsciiDigits(String(name ?? '').normalize('NFKC'))
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '')

/** Classic Levenshtein distance, early exit above `max`. */
export function editDistance(left = '', right = '', max = Infinity) {
  if (left === right) return 0
  if (Math.abs(left.length - right.length) > max) return max + 1
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i]
    let rowMin = current[0]
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      rowMin = Math.min(rowMin, current[j])
    }
    if (rowMin > max) return max + 1
    previous = current
  }
  return previous[right.length]
}
