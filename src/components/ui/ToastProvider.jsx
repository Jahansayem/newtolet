'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi'

/**
 * Toast notifications.
 * - success/info announce politely (role=status); errors use role=alert
 * - success/info auto-dismiss (default 5 s, paused on hover/focus); errors persist
 * - at most `max` visible, oldest dropped first
 * - never moves focus
 */
const ToastContext = createContext(null)

const ICONS = { success: FiCheckCircle, error: FiAlertCircle, info: FiInfo }
const TONE = {
  success: 'border-success/30',
  error: 'border-danger/40',
  info: 'border-line',
}
const ICON_TONE = { success: 'text-success', error: 'text-danger', info: 'text-brand' }

let nextId = 1

export function ToastProvider({ children, max = 3, successDuration = 5000 }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const map = timers.current
    return () => {
      map.forEach((timer) => clearTimeout(timer.handle))
      map.clear()
    }
  }, [])

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer.handle)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const schedule = useCallback(
    (id, remaining) => {
      const handle = setTimeout(() => dismiss(id), remaining)
      timers.current.set(id, { handle, startedAt: Date.now(), remaining })
    },
    [dismiss]
  )

  const pause = useCallback((id) => {
    const timer = timers.current.get(id)
    if (!timer) return
    clearTimeout(timer.handle)
    timers.current.set(id, { ...timer, handle: null, remaining: Math.max(1000, timer.remaining - (Date.now() - timer.startedAt)) })
  }, [])

  const resume = useCallback(
    (id) => {
      const timer = timers.current.get(id)
      if (!timer || timer.handle) return
      schedule(id, timer.remaining)
    },
    [schedule]
  )

  const push = useCallback(
    (type, title, { description = null, action = null, duration } = {}) => {
      const id = nextId++
      setToasts((current) => [...current, { id, type, title, description, action }].slice(-max))
      const ms = duration ?? (type === 'error' ? null : successDuration)
      if (ms) schedule(id, ms)
      return id
    },
    [max, schedule, successDuration]
  )

  const api = useMemo(
    () => ({
      success: (title, options) => push('success', title, options),
      error: (title, options) => push('error', title, options),
      info: (title, options) => push('info', title, options),
      dismiss,
      clear: () => setToasts([]),
    }),
    [push, dismiss]
  )

  const polite = toasts.filter((toast) => toast.type !== 'error')
  const alerts = toasts.filter((toast) => toast.type === 'error')

  const renderToast = (toast) => {
    const Icon = ICONS[toast.type] || FiInfo
    return (
      <div
        key={toast.id}
        className={`ui-card pointer-events-auto flex items-start gap-3 border p-4 shadow-raised motion-safe:animate-fade-in-up ${TONE[toast.type] || TONE.info}`}
        onMouseEnter={() => pause(toast.id)}
        onMouseLeave={() => resume(toast.id)}
        onFocus={() => pause(toast.id)}
        onBlur={() => resume(toast.id)}
      >
        <Icon className={`mt-0.5 shrink-0 ${ICON_TONE[toast.type] || ''}`} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-ink">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-muted">{toast.description}</p> : null}
          {toast.action ? (
            <button
              type="button"
              className="ui-btn ui-btn-secondary ui-btn-sm mt-3"
              onClick={() => {
                toast.action.onClick?.()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-icon -mr-2 -mt-2 shrink-0" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
          <FiX aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[var(--z-toast)] flex flex-col gap-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:w-[min(24rem,calc(100vw-2rem))]">
              <div role="status" aria-live="polite" aria-atomic="false" className="flex flex-col gap-3">
                {polite.map(renderToast)}
              </div>
              <div role="alert" className="flex flex-col gap-3">
                {alerts.map(renderToast)}
              </div>
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export default ToastProvider
