'use client'

import { useCallback, useRef, useState } from 'react'
import { useToast } from '../../ui/ToastProvider'
import { invalidateAdminSnapshots } from '../../../services/admin/adminCache'

/**
 * Runs an admin data-layer mutation and reports the outcome through toasts.
 * The mutation must return the standard result shape; `run` never throws.
 *
 * run(...args) -> result; `busyKey` is the first argument (usually a row id)
 * so callers can show a per-row spinner.
 */
export const useAdminMutation = (
  mutationFn,
  { successMessage = null, errorMessage = null, invalidate = [], onSuccess = null, onError = null, showAuditRef = true } = {}
) => {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [busyKey, setBusyKey] = useState(null)
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const runningRef = useRef(false)

  const run = useCallback(
    async (...args) => {
      if (runningRef.current) return { data: null, error: { code: 'BUSY', message: 'Another action is still running.', retryable: false, permissionDenied: false } }
      runningRef.current = true
      setBusy(true)
      setBusyKey(args[0] ?? null)
      setError(null)
      let result
      try {
        result = await mutationFn(...args)
      } catch (caught) {
        result = { data: null, error: { code: 'UNKNOWN', message: caught?.message || 'Something went wrong.', retryable: false, permissionDenied: false }, auditId: null }
      }
      runningRef.current = false
      setBusy(false)
      setBusyKey(null)
      setLastResult(result)

      if (result?.error) {
        setError(result.error)
        const title = typeof errorMessage === 'function' ? errorMessage(result.error, ...args) : errorMessage || 'Action failed'
        toast.error(title, {
          description: result.error.message,
          action: result.error.retryable ? { label: 'Retry', onClick: () => run(...args) } : null,
        })
        onError?.(result.error, ...args)
        return result
      }

      for (const domain of invalidate.length ? invalidate : [null]) invalidateAdminSnapshots(domain)
      if (successMessage) {
        const title = typeof successMessage === 'function' ? successMessage(result, ...args) : successMessage
        const ref = showAuditRef && result.auditId ? `Audit ref ${result.auditId}` : null
        toast.success(title, { description: ref })
      }
      onSuccess?.(result, ...args)
      return result
    },
    [mutationFn, successMessage, errorMessage, invalidate, onSuccess, onError, showAuditRef, toast]
  )

  return { run, busy, busyKey, error, lastResult }
}

export default useAdminMutation
