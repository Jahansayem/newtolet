// Uniform result shape for every admin data-layer function:
//   { data, error: AdminError | null, auditId: string | null, ...paging }
// Nothing in src/services/admin ever returns a bare array/string or converts
// a failure into "success with empty data".

import { classifyError, ADMIN_ERROR_CODES, isMissingSchemaCode } from '../../lib/adminErrorCodes'

const isAdminError = (value) =>
  Boolean(value) && typeof value === 'object' && typeof value.code === 'string' && 'retryable' in value && 'permissionDenied' in value

/** Normalises any thrown/returned error into an AdminError (idempotent). */
export const normalizeSupabaseError = (error) => {
  if (isAdminError(error)) return error
  const classified = classifyError(error)
  const adminError = {
    code: classified.code,
    message: classified.message,
    retryable: classified.retryable,
    permissionDenied: classified.permissionDenied,
    status: classified.status,
    details: classified.details,
    hint: classified.hint,
  }
  // keep the original for debugging without polluting JSON.stringify output
  Object.defineProperty(adminError, 'raw', { value: error, enumerable: false })
  return adminError
}

/**
 * postgrest-js reports the HTTP status on the response, not on `error`; a
 * failure with an empty body arrives as `{ message: '' }`. Copying the status
 * onto the error lets classifyError tell a timeout from a server error.
 */
export const withHttpStatus = (error, status) => {
  if (!error || typeof error !== 'object' || typeof status !== 'number' || status < 400) return error
  if (error.status ?? error.statusCode ?? error.httpStatus) return error
  return { ...error, message: error.message, name: error.name, status }
}

export const ok = (data, { auditId = null, ...paging } = {}) => ({ data, error: null, auditId, ...paging })

export const fail = (error, { paging = {} } = {}) => ({ data: null, error: normalizeSupabaseError(error), auditId: null, ...paging })

export const emptyList = (page = 1, pageSize = 20) => ({ data: [], error: null, auditId: null, page, pageSize, totalCount: 0, hasMore: false })

export const isMissingSchemaError = (error) => Boolean(error) && isMissingSchemaCode(normalizeSupabaseError(error).code)

export const isAbortError = (error) => Boolean(error) && normalizeSupabaseError(error).code === ADMIN_ERROR_CODES.ABORTED

/** Logs an admin-layer error unless it is noise (aborted requests, offline). */
export const logAdminError = (scope, error) => {
  const normalized = normalizeSupabaseError(error)
  if (normalized.code === ADMIN_ERROR_CODES.ABORTED) return
  if (normalized.code === ADMIN_ERROR_CODES.UNAVAILABLE || normalized.code === ADMIN_ERROR_CODES.RESTRICTED) {
    console.warn(`[admin:${scope}] ${normalized.message}`)
    return
  }
  console.error(`[admin:${scope}] ${normalized.code}: ${normalized.message}`, normalized.raw ?? '')
}

/** First row of a PostgREST array result, or the value itself. */
export const unwrapSingle = (rows) => (Array.isArray(rows) ? rows[0] ?? null : rows ?? null)
