'use client'

import React from 'react'
import { Link } from 'react-router-dom'
import { FiLock, FiRefreshCw } from 'react-icons/fi'

export const AdminLoadingState = ({ label = 'Checking your access…' }) => (
  <div className="flex min-h-screen items-center justify-center bg-canvas px-4" role="status" aria-live="polite">
    <div className="flex items-center gap-3 text-muted">
      <span className="loading loading-spinner loading-md" aria-hidden="true" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  </div>
)

export const AdminAccessDenied = ({
  title = 'Access denied',
  description = "You don't have permission to open the admin panel. Ask a super admin to grant you a role.",
  error = null,
  onRetry = null,
}) => (
  <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
    <div className="ui-panel w-full max-w-md p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
        <FiLock className="text-xl" />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">{description}</p>
      {error?.message ? (
        <p className="ui-note ui-note-danger mt-4 text-left" role="alert">
          {error.message}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {onRetry ? (
          <button type="button" onClick={onRetry} className="ui-btn ui-btn-secondary">
            <FiRefreshCw aria-hidden="true" />
            Try again
          </button>
        ) : null}
        <Link to="/" className="ui-btn ui-btn-primary">
          Go to homepage
        </Link>
      </div>
    </div>
  </main>
)
