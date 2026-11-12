// PostgREST `or` filter selecting the rows that come AFTER a given row when a
// table is ordered by created_at desc, id desc. The id tie-break keeps rows
// that share a timestamp from being skipped or revisited.

const quote = (value) => `"${String(value).replace(/"/g, '')}"`

/**
 * @param {{ createdAt?: string | null, id?: string | null }} row - the current row
 * @returns {string} filter for `.or()`, or '' when there is no usable position
 */
export const buildAfterRowFilter = ({ createdAt, id } = {}) => {
  if (!createdAt) {
    return ''
  }

  const older = `created_at.lt.${quote(createdAt)}`

  return id
    ? `${older},and(created_at.eq.${quote(createdAt)},id.lt.${quote(id)})`
    : older
}
