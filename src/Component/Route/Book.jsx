'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import useCachedPanelResource from '../../hooks/useCachedPanelResource'
import { createPaymentTransaction, getCreditPackages } from '../../services/paymentService'
import { getUserCredits } from '../../services/creditService'
import UserPanelShell from '../../components/user-panel/UserPanelShell.jsx'
import { EmptyState, PanelCard, PanelCardHeader } from '../../components/user-panel/UserPanelPrimitives.jsx'
import { useLanguage } from '../../i18n/useLanguage'
import { translate, readStoredLanguage } from '../../i18n'

const calculateFinalPrice = (package_) => {
  const price = Number(package_?.price || 0)
  const discount = Number(package_?.discount || 0)
  return price - (price * discount) / 100
}

const Book = () => {
  const { t } = useLanguage()
  const { user, isLoading } = useAuth()
  const [creditPackages, setCreditPackages] = useState([])
  const [loadingPackageId, setLoadingPackageId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const {
    data: currentCredits = 0,
    isRefreshing: isRefreshingCredits,
  } = useCachedPanelResource({
    userId: user?.id,
    resourceKey: 'credit-balance',
    loader: () => getUserCredits(user.id),
    enabled: !isLoading && Boolean(user?.id),
  })

  const loadPackages = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const packages = await getCreditPackages()

      setCreditPackages(packages || [])
    } catch (loadError) {
      console.error('Error loading credit packages:', loadError)
      setError(loadError.message || translate(readStoredLanguage(), 'payments.book.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isLoading) {
      void loadPackages()
    }
  }, [isLoading, loadPackages])

  const handleStartCheckout = async (package_) => {
    if (!package_ || !user?.id) {
      return
    }

    setLoadingPackageId(package_.id)
    setError('')

    try {
      const { data, error: checkoutError } = await createPaymentTransaction(package_.id)

      if (checkoutError || !data?.payment_url) {
        throw checkoutError || new Error(t('payments.book.errors.checkoutFailed'))
      }

      window.location.assign(data.payment_url)
    } catch (paymentError) {
      console.error('Payment checkout error:', paymentError)
      setError(paymentError.message || t('payments.book.errors.continueFailed'))
      setLoadingPackageId(null)
    }
  }

  return (
    <UserPanelShell activeKey="buy-credits">
      <PanelCard>
        <PanelCardHeader
          title={t('payments.book.title')}
          subtitle={t('payments.book.subtitle')}
        />

        <div className="px-6 py-6">
          <div className="mb-6 rounded-3xl bg-slate-50 px-5 py-4">
            <p className="text-sm text-slate-500">{t('payments.book.currentCredits')}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{currentCredits}</p>
            {isRefreshingCredits ? <p className="mt-2 text-xs font-medium text-slate-400">{t('payments.book.refreshing')}</p> : null}
          </div>

          {error ? <p className="mb-4 text-sm font-medium text-red-600">{error}</p> : null}

          {isLoading || loading ? (
            <p className="text-slate-500">{t('payments.book.loading')}</p>
          ) : creditPackages.length === 0 ? (
            <EmptyState
              title={t('payments.book.emptyTitle')}
              description={t('payments.book.emptyDescription')}
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              {creditPackages.map((package_) => (
                <div
                  key={package_.id}
                  className="rounded-3xl border border-slate-200 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-lg font-semibold text-slate-900">{package_.name}</p>
                  <p className="mt-4 text-5xl font-bold text-slate-900">{package_.credits}</p>
                  <p className="mt-1 text-sm text-slate-500">{t('payments.book.credits')}</p>

                  <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-sm text-slate-500">{t('payments.book.price')}</p>
                    {Number(package_.discount || 0) > 0 ? (
                      <p className="mt-1 text-sm text-slate-400 line-through">
                        ৳{Number(package_.price || 0).toLocaleString('en-BD')}
                      </p>
                    ) : null}
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      ৳{calculateFinalPrice(package_).toLocaleString('en-BD')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartCheckout(package_)}
                    disabled={loadingPackageId === package_.id}
                    className="mt-6 w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingPackageId === package_.id ? t('payments.book.redirecting') : t('payments.book.buyNow')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </PanelCard>
    </UserPanelShell>
  )
}

export default Book
