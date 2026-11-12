// PostgREST `or` filter selecting the rows that come AFTER a given row in the
// admin list order: <column> asc|desc with nulls last, then id ascending. The
// id tie-break keeps rows that share a value from being skipped or revisited.

const quote = (value) => `"${String(value).replace(/"/g, '')}"`

const isEmpty = (value) => value === null || value === undefined || value === ''

/**
 * @param {{ column?: string, dir?: 'asc'|'desc', value?: any, id?: string | null }} position
 *   column and direction of the list sort, and the current row's value and id
 * @returns {string} filter for `.or()`, or '' when there is no usable position
 */
export const buildAfterInListFilter = ({ column, dir = 'desc', value, id } = {}) => {
  if (!column || !id || !/^[a-z_]+$/.test(column)) {
    return ''
  }

  const laterId = `id.gt.${quote(id)}`

  // Rows without a value sort last; only other empty rows can follow one.
  if (isEmpty(value)) {
    return `and(${column}.is.null,${laterId})`
  }

  const beyond = `${column}.${dir === 'asc' ? 'gt' : 'lt'}.${quote(value)}`

  return `${beyond},and(${column}.eq.${quote(value)},${laterId}),${column}.is.null`
}
