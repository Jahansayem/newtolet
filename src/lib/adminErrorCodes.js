// Classifies Supabase / PostgREST / RPC errors into a small, stable code set
// that the admin UI can act on (retry, show permission state, show a
// transition message). Pure module: no Supabase import, safe for node --test.
//
// RPC convention (see the admin roles migration): admin RPCs raise
//   errcode P0001, message 'ADMIN_<CODE>: <user-safe text>', hint 'k=v;k=v'
// The prefix becomes the code, the text becomes the message and the hint is
// parsed into `details`.

export const ADMIN_ERROR_CODES = Object.freeze({
  ABORTED: 'ABORTED',
  UNAVAILABLE: 'UNAVAILABLE',
  RESTRICTED: 'RESTRICTED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  NOT_FOUND: 'NOT_FOUND',
  CHECK_VIOLATION: 'CHECK_VIOLATION',
  FK_VIOLATION: 'FK_VIOLATION',
  MISSING_TABLE: 'MISSING_TABLE',
  MISSING_COLUMN: 'MISSING_COLUMN',
  MISSING_RPC: 'MISSING_RPC',
  INVALID_INPUT: 'INVALID_INPUT',
  TIMEOUT: 'TIMEOUT',
  TRANSIENT: 'TRANSIENT',
  RPC_ERROR: 'RPC_ERROR',
  UNKNOWN: 'UNKNOWN',
})

const C = ADMIN_ERROR_CODES

const RETRYABLE = new Set([C.UNAVAILABLE, C.TIMEOUT, C.TRANSIENT])
const PERMISSION = new Set([C.AUTH_EXPIRED, C.PERMISSION_DENIED])

export const CONNECTION_UNAVAILABLE_MESSAGE =
  'The server is currently unreachable. Check your connection and try again.'
export const PROJECT_RESTRICTED_MESSAGE =
  'The database is temporarily restricted. Please try again in a few minutes.'

const DEFAULT_MESSAGES = Object.freeze({
  [C.ABORTED]: 'The request was cancelled.',
  [C.UNAVAILABLE]: CONNECTION_UNAVAILABLE_MESSAGE,
  [C.RESTRICTED]: PROJECT_RESTRICTED_MESSAGE,
  [C.AUTH_EXPIRED]: 'Your session has expired. Please sign in again.',
  [C.PERMISSION_DENIED]: "You don't have permission to do this.",
  [C.INVALID_TRANSITION]: 'This status change is not allowed from the current state.',
  [C.VALIDATION]: 'Some of the submitted values are invalid.',
  [C.CONFLICT]: 'This record was changed by someone else. Reload and try again.',
  [C.INSUFFICIENT_CREDITS]: 'The user does not have enough credits for this action.',
  [C.NOT_FOUND]: 'The record could not be found. It may have been removed.',
  [C.CHECK_VIOLATION]: 'The change violates a data rule.',
  [C.FK_VIOLATION]: 'The record is referenced by other data and cannot be changed this way.',
  [C.MISSING_TABLE]: 'A required database table is missing. Apply the latest migration.',
  [C.MISSING_COLUMN]: 'A required database column is missing. Apply the latest migration.',
  [C.MISSING_RPC]: 'A required database function is missing. Apply the latest migration.',
  [C.INVALID_INPUT]: 'The request contained an invalid value.',
  [C.TIMEOUT]: 'The request took too long and timed out. Please try again.',
  [C.TRANSIENT]: 'A temporary server error occurred. Please try again.',
  [C.RPC_ERROR]: 'The operation failed.',
  [C.UNKNOWN]: 'Something went wrong. Please try again.',
})

const ADMIN_PREFIX_PATTERN = /^ADMIN_([A-Z_]+):\s*([\s\S]*)$/

const toNumber = (value) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

const readMessage = (err) => {
  if (!err) return ''
  if (typeof err === 'string') return err
  return String(err.message || err.error_description || err.error || err.msg || '')
}

const readCode = (err) => {
  if (!err || typeof err === 'string') return ''
  return String(err.code ?? err.error_code ?? '')
}

const readStatus = (err) => {
  if (!err || typeof err === 'string') return null
  return toNumber(err.status) ?? toNumber(err.statusCode) ?? toNumber(err.httpStatus)
}

/** Parses an RPC hint like 'from=credited;to=failed' into an object. */
export const parseHintDetails = (hint) => {
  if (!hint || typeof hint !== 'string') return null
  const details = {}
  for (const pair of hint.split(';')) {
    const index = pair.indexOf('=')
    if (index > 0) {
      details[pair.slice(0, index).trim()] = pair.slice(index + 1).trim()
    }
  }
  return Object.keys(details).length ? details : null
}

const classifyRpcMessage = (message) => {
  const prefixed = ADMIN_PREFIX_PATTERN.exec(message)
  if (prefixed) {
    const code = C[prefixed[1]] || C.RPC_ERROR
    return { code, message: prefixed[2].trim() || DEFAULT_MESSAGES[code] }
  }
  const lower = message.toLowerCase()
  if (lower.startsWith('authentication required')) return { code: C.AUTH_EXPIRED, message: DEFAULT_MESSAGES[C.AUTH_EXPIRED] }
  if (lower.includes('admin access required') || lower.includes('permission denied')) {
    return { code: C.PERMISSION_DENIED, message: DEFAULT_MESSAGES[C.PERMISSION_DENIED] }
  }
  if (lower.includes('already been reviewed') || lower.includes('only verified payments') || lower.includes('already')) {
    return { code: C.INVALID_TRANSITION, message }
  }
  if (lower.includes('not found')) return { code: C.NOT_FOUND, message }
  if (lower.includes('insufficient credits')) return { code: C.INSUFFICIENT_CREDITS, message }
  return { code: C.RPC_ERROR, message: message || DEFAULT_MESSAGES[C.RPC_ERROR] }
}

/**
 * classifyError(err) -> { code, message, retryable, permissionDenied, status, details, hint }
 * Deterministic, first match wins; see the order in the plan.
 */
export const classifyError = (err) => {
  const message = readMessage(err)
  const code = readCode(err)
  const status = readStatus(err)
  const lower = message.toLowerCase()
  const hint = err && typeof err === 'object' ? err.hint || null : null
  const name = err && typeof err === 'object' ? err.name : undefined

  let resolved
  if (name === 'AbortError' || code === '20') {
    resolved = { code: C.ABORTED }
  } else if (
    code === 'SUPABASE_CONNECTION_UNAVAILABLE' ||
    status === 503 ||
    name === 'AuthRetryableFetchError' ||
    /failed to fetch|networkerror|network error|load failed|unreachable|service unavailable|econnrefused/.test(lower)
  ) {
    resolved = { code: C.UNAVAILABLE }
  } else if (code === 'SUPABASE_PROJECT_RESTRICTED' || status === 402 || /quota|restricted/.test(lower)) {
    resolved = { code: C.RESTRICTED }
  } else if (code === 'PGRST301' || status === 401 || /jwt expired|invalid jwt|no authorization|not authenticated/.test(lower)) {
    resolved = { code: C.AUTH_EXPIRED }
  } else if (code === '42501' || status === 403 || /row-level security|permission denied for/.test(lower)) {
    resolved = { code: C.PERMISSION_DENIED }
  } else if (code === 'P0001') {
    resolved = classifyRpcMessage(message)
  } else if (code === 'PGRST116') {
    resolved = { code: C.NOT_FOUND }
  } else if (code === '23505') {
    resolved = { code: C.CONFLICT }
  } else if (code === '23514') {
    resolved = { code: /status/.test(lower) ? C.INVALID_TRANSITION : C.CHECK_VIOLATION }
  } else if (code === '23503') {
    resolved = { code: C.FK_VIOLATION }
  } else if (code === 'PGRST205' || code === '42P01' || /could not find the table/.test(lower)) {
    resolved = { code: C.MISSING_TABLE }
  } else if (code === 'PGRST204' || code === '42703' || /could not find the '.*' column/.test(lower)) {
    resolved = { code: C.MISSING_COLUMN }
  } else if (code === 'PGRST202' || /could not find the function/.test(lower)) {
    resolved = { code: C.MISSING_RPC }
  } else if (code === '22P02' || (status === 400 && /^PGRST1/.test(code))) {
    resolved = { code: C.INVALID_INPUT }
  } else if (code === '57014' || status === 504 || status === 408) {
    // statement_timeout cancelled the query, or a gateway gave up waiting: the
    // server was reached, so this is not a connectivity problem.
    resolved = { code: C.TIMEOUT }
  } else if (['40001', '40P01'].includes(code) || status === 429 || (status !== null && status >= 500)) {
    resolved = { code: C.TRANSIENT }
  } else if (/admin access required/.test(lower)) {
    resolved = { code: C.PERMISSION_DENIED }
  } else {
    resolved = { code: C.UNKNOWN }
  }

  const finalCode = resolved.code
  const finalMessage =
    resolved.message ||
    (finalCode === C.UNKNOWN || finalCode === C.CHECK_VIOLATION || finalCode === C.INVALID_INPUT
      ? message || DEFAULT_MESSAGES[finalCode]
      : DEFAULT_MESSAGES[finalCode])

  return {
    code: finalCode,
    message: finalMessage,
    retryable: RETRYABLE.has(finalCode),
    permissionDenied: PERMISSION.has(finalCode),
    status,
    details: parseHintDetails(hint) || (err && typeof err === 'object' && err.details ? err.details : null),
    hint,
  }
}

export const isRetryableCode = (code) => RETRYABLE.has(code)
export const isPermissionCode = (code) => PERMISSION.has(code)
export const isMissingSchemaCode = (code) => code === C.MISSING_TABLE || code === C.MISSING_COLUMN || code === C.MISSING_RPC
