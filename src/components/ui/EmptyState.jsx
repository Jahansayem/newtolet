'use client'

import React from 'react'

/**
 * Shared empty state: icon (optional) + title + one-line next step + optional action.
 * Labels are passed in by the caller so this stays usable from admin (English) and user panels (t()).
 */
const EmptyState = ({ icon = null, title, description, action = null, role = 'status', className = '' }) => (
  <div role={role} className={`rounded-[var(--radius-panel)] border border-dashed border-line bg-canvas px-6 py-10 text-center ${className}`}>
    {icon ? (
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
        {icon}
      </div>
    ) : null}
    <h3 className="text-lg font-semibold text-ink">{title}</h3>
    {description ? <p className="mx-auto mt-2 max-w-xl text-caption text-muted">{description}</p> : null}
    {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
  </div>
)

export default EmptyState
