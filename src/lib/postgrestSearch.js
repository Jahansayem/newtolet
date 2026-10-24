// Helpers for building PostgREST `or=` ilike filters safely.
// Pure module, safe for node --test. (Moved from propertyCatalogService.js.)

/** Escapes LIKE wildcards and strips the characters PostgREST uses as syntax in `.or()`. */
export const escapePostgrestPatternValue = (value = '') =>
  String(value).replace(/[\\%_*]/g, '\\$&').replace(/[(),]/g, ' ')

/** Whole phrase plus individual words, escaped, de-duplicated, at least 2 chars. */
export const getKeywordSearchTerms = (search = '') =>
  Array.from(
    new Set(
      [search, ...String(search || '').split(/\s+/)]
        .map((term) => escapePostgrestPatternValue(term).trim())
        .filter((term) => term.length >= 2)
    )
  )

/**
 * Builds the string for `query.or(...)`: every term against every column.
 * Returns null when there is nothing to search for.
 */
export const buildIlikeOrFilter = (search, columns = []) => {
  const terms = getKeywordSearchTerms(search)
  if (terms.length === 0 || columns.length === 0) return null
  const clauses = []
  for (const column of columns) {
    for (const term of terms) clauses.push(`${column}.ilike.%${term}%`)
  }
  return clauses.join(',')
}
