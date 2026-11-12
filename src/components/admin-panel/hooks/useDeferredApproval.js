'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../../ui/ToastProvider'

/**
 * One-click approve with an Undo window.
 *
 * approve(item) hides the listing at once and shows a toast with "Undo". The
 * approval is only sent to the server when that toast closes (its timer, its
 * dismiss button, leaving the screen); Undo cancels it and nothing is sent.
 * Approving is not reverted afterwards because the server awards points on
 * every approval and never takes them back.
 *
 * commit(ids) -> standard admin result ({ data, error })
 * `heldIds` are the listings approved here: hide them while their row still
 * shows another status.
 */
export const useDeferredApproval = ({ commit, labelOf = (item) => item?.id, delayMs = 5000 }) => {
  const toast = useToast()
  const entriesRef = useRef(new Map())
  const mountedRef = useRef(true)
  const commitRef = useRef(commit)
  const approveRef = useRef(null)
  const [heldIds, setHeldIds] = useState(() => new Set())

  useEffect(() => {
    commitRef.current = commit
  }, [commit])

  const release = useCallback((id) => {
    if (!mountedRef.current) return
    setHeldIds((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }, [])

  const settle = useCallback(
    async (id) => {
      const entry = entriesRef.current.get(id)
      if (!entry) return
      entriesRef.current.delete(id)
      if (entry.undone) {
        release(id)
        toast.info(`Approval undone for ${entry.label}`, { description: 'The listing is still pending.' })
        return
      }
      let result
      try {
        result = await commitRef.current([id])
      } catch (caught) {
        result = { data: null, error: { message: caught?.message || 'Something went wrong.', retryable: false } }
      }
      if (result?.error) {
        release(id)
        toast.error(`${entry.label} was not approved`, {
          description: result.error.message,
          action: result.error.retryable ? { label: 'Retry', onClick: () => approveRef.current?.(entry.item) } : null,
        })
      }
    },
    [release, toast]
  )

  const approve = useCallback(
    (item) => {
      const id = item?.id
      if (!id || entriesRef.current.has(id)) return
      const label = labelOf(item)
      const entry = { item, label, undone: false, toastId: null }
      entriesRef.current.set(id, entry)
      setHeldIds((current) => new Set(current).add(id))
      entry.toastId = toast.success(`Approved ${label}`, {
        description: `Goes live in ${Math.round(delayMs / 1000)} seconds unless you undo.`,
        duration: delayMs,
        pauseOnHover: false,
        action: {
          label: 'Undo',
          onClick: () => {
            entry.undone = true
          },
        },
        onClose: () => void settle(id),
      })
    },
    [delayMs, labelOf, settle, toast]
  )

  useEffect(() => {
    approveRef.current = approve
  }, [approve])

  /** Sends every waiting approval now (closing its toast). */
  const flush = useCallback(() => {
    for (const entry of Array.from(entriesRef.current.values())) {
      if (entry.toastId !== null) toast.dismiss(entry.toastId)
    }
  }, [toast])

  useEffect(() => {
    mountedRef.current = true
    window.addEventListener('pagehide', flush)
    return () => {
      mountedRef.current = false
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  return { approve, flush, heldIds }
}

export default useDeferredApproval
