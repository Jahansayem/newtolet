'use client'

import React from 'react'

export const PanelCard = ({ className = '', children }) => (
  <div className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}>
    {children}
  </div>
)

export const PanelCardHeader = ({ title, subtitle, action = null, status = null }) => (
  <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      {status ? <p className="mt-2 text-xs font-medium text-slate-400">{status}</p> : null}
    </div>
    {action}
  </div>
)

export const EmptyState = ({ title, description, action = null }) => (
  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
    <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    {action ? <div className="mt-6">{action}</div> : null}
  </div>
)

export const formatPanelDate = (value, withTime = true) => {
  if (!value) {
    return 'N/A'
  }

  const options = withTime
    ? {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    : {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }

  return new Date(value).toLocaleString('en-US', options)
}

export const formatPanelCurrency = (value) =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
