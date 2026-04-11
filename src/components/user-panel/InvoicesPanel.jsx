'use client'

import React from 'react'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { getInvoices } from '../../services/userPanelService'
import { EmptyState, formatPanelDate, PanelCard, PanelCardHeader } from './UserPanelPrimitives'

const InvoicesPanel = () => {
  const { user, isLoading } = useAuth()
  const {
    data: invoices = [],
    isLoading: invoicesLoading,
    isRefreshing,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'invoices',
    loader: () => getInvoices(user.id),
    enabled: !isLoading && Boolean(user?.id),
  })

  if (isLoading || invoicesLoading) {
    return (
      <PanelCard className="p-8">
        <p className="text-slate-500">Loading invoices...</p>
      </PanelCard>
    )
  }

  return (
    <PanelCard>
      <PanelCardHeader
        title="Invoices"
        subtitle="Credit purchases verified through the payment flow appear here."
        status={isRefreshing ? 'Refreshing...' : null}
      />

      <div className="px-6 py-6">
        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Your credit purchases will appear here after checkout is created."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 font-semibold">Invoice Code</th>
                  <th className="pb-3 font-semibold">Package</th>
                  <th className="pb-3 font-semibold">Price</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-100">
                    <td className="py-4 font-mono text-slate-700">
                      {invoice.invoice_id || invoice.transaction_id || invoice.id}
                    </td>
                    <td className="py-4 text-slate-800">{invoice.description || 'Credit Package'}</td>
                    <td className="py-4 font-semibold text-slate-900">
                      BDT {Number(invoice.amount || 0).toFixed(2)}
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          invoice.status === 'credited'
                            ? 'bg-emerald-100 text-emerald-700'
                            : invoice.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {invoice.status || 'pending'}
                      </span>
                    </td>
                    <td className="py-4 text-slate-500">{formatPanelDate(invoice.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PanelCard>
  )
}

export default InvoicesPanel
