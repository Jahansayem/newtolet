import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FiAlertCircle, FiCheckCircle, FiClock, FiLoader } from 'react-icons/fi'
import { verifyPayment } from '../../services/paymentService'
import { invalidateUserOrdersCache } from '../../services/orderService'
import { supabase } from '../../services/supabaseClient'
import { useLanguage } from '../../i18n/useLanguage'
import LanguageToggle from '../../components/LanguageToggle.jsx'

const AUTO_APPROVAL_THRESHOLD_BDT = 3000

const STATUS_STYLES = {
  awaiting_admin_approval: {
    icon: FiClock,
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
    panel: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    titleKey: 'payments.confirm.status.awaiting_admin_approval.title',
    descriptionKey: 'payments.confirm.status.awaiting_admin_approval.description',
  },
  pending: {
    icon: FiClock,
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
    panel: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    titleKey: 'payments.confirm.status.pending.title',
    descriptionKey: 'payments.confirm.status.pending.description',
  },
  credited: {
    icon: FiCheckCircle,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    panel: 'bg-green-50 border-green-200 text-green-800',
    titleKey: 'payments.confirm.status.credited.title',
    descriptionKey: 'payments.confirm.status.credited.description',
  },
  cancelled: {
    icon: FiAlertCircle,
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-200',
    panel: 'bg-gray-50 border-gray-200 text-gray-700',
    titleKey: 'payments.confirm.status.cancelled.title',
    descriptionKey: 'payments.confirm.status.cancelled.description',
  },
  failed: {
    icon: FiAlertCircle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    panel: 'bg-red-50 border-red-200 text-red-800',
    titleKey: 'payments.confirm.status.failed.title',
    descriptionKey: 'payments.confirm.status.failed.description',
  },
}

// Order Home payments reuse the page with their own wording where the credit
// text would be wrong (a paid order adds no credits).
const ORDER_STATUS_KEYS = {
  awaiting_admin_approval: {
    titleKey: 'payments.confirm.order.status.awaiting_admin_approval.title',
    descriptionKey: 'payments.confirm.order.status.awaiting_admin_approval.description',
  },
  credited: {
    titleKey: 'payments.confirm.order.status.credited.title',
    descriptionKey: 'payments.confirm.order.status.credited.description',
  },
}

const resolveStatusKeys = (status, isOrderPayment) => {
  const base = STATUS_STYLES[status] || STATUS_STYLES.failed
  return (isOrderPayment && ORDER_STATUS_KEYS[status]) || base
}

const PaymentConfirmPage = () => {
  const { t, tv, fdt } = useLanguage()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [pageState, setPageState] = useState('processing')
  const [paymentData, setPaymentData] = useState(null)
  // Component messages are stored as translation keys so they follow the active
  // language; gateway/service error text is stored verbatim in messageText.
  const [messageKey, setMessageKey] = useState('payments.confirm.verifying')
  const [messageText, setMessageText] = useState('')
  const message = messageText || t(messageKey)

  const formatDate = (value) => fdt(value, { month: 'long' }) || t('common.na')

  const statusLabel = (status) => {
    const label = tv('paymentStatus', status)
    return label === status ? status.replace(/_/g, ' ') : label
  }

  const invoiceId = searchParams.get('invoice_id') || searchParams.get('invoiceId')
  const paymentId = searchParams.get('paymentId') || searchParams.get('payment_id')
  const provider = searchParams.get('provider')
  const reference = searchParams.get('reference') || searchParams.get('slug')
  const explicitState = searchParams.get('state')
  const kind = searchParams.get('kind')
  const displayReference = invoiceId || paymentId || reference
  const isOrderPayment = kind === 'order' || Boolean(paymentData?.order_id)

  const statusConfig = useMemo(() => {
    if (pageState === 'processing') {
      return null
    }

    return STATUS_STYLES[pageState] || STATUS_STYLES.failed
  }, [pageState])

  useEffect(() => {
    if (explicitState === 'cancelled') {
      setPageState('cancelled')
      setMessageText('')
      setMessageKey(STATUS_STYLES.cancelled.descriptionKey)
      return
    }

    if (!invoiceId && !paymentId && !reference) {
      setPageState('failed')
      setMessageText('')
      setMessageKey('payments.confirm.noReference')
      return
    }

    const runVerification = async () => {
      setPageState('processing')
      setMessageText('')
      setMessageKey('payments.confirm.verifying')

      const result = await verifyPayment({
        invoiceId,
        paymentId,
        provider,
        reference,
      })

      if (result.error) {
        setPageState('failed')
        setMessageText(result.error.message || '')
        setMessageKey('payments.confirm.unableToVerify')
        return
      }

      const payment = result.data?.payment || null
      const nextStatus = payment?.status || 'pending'
      const orderPayment = kind === 'order' || Boolean(payment?.order_id)

      if (orderPayment) {
        // The server has just changed the order; drop the cached order list.
        const { data } = await supabase.auth.getSession()
        invalidateUserOrdersCache(data?.session?.user?.id)
      }

      setPaymentData(payment)
      setPageState(nextStatus)
      setMessageText('')
      setMessageKey(resolveStatusKeys(nextStatus, orderPayment).descriptionKey)
    }

    runVerification()
  }, [explicitState, invoiceId, paymentId, provider, reference, kind])

  // Order payments go back to My Orders, where an unpaid order has "Pay now".
  const handleGoToDashboard = () => {
    navigate(isOrderPayment ? '/my-orders' : '/dashboard')
  }

  const handleTryAgain = () => {
    navigate(isOrderPayment ? '/my-orders' : '/book/buy-credits')
  }

  if (pageState === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand/10 to-blue-50 flex items-center justify-center px-4 py-12">
        <div className="relative max-w-md w-full bg-white rounded-lg shadow-2xl p-8 text-center space-y-6">
          <LanguageToggle size="sm" className="absolute right-4 top-4" />
          <div className="flex justify-center">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-600 animate-spin"></div>
              <FiLoader className="text-brand text-3xl animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{message}</h2>
          {displayReference ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-gray-600 mb-2">{t('payments.confirm.reference')}</p>
              <p className="font-mono text-gray-900 text-sm break-all">{displayReference}</p>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const StatusIcon = statusConfig?.icon || FiAlertCircle

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand/10 to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="relative max-w-lg w-full bg-white rounded-lg shadow-2xl p-8">
        <LanguageToggle size="sm" className="absolute right-4 top-4" />
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className={`${statusConfig.iconBg} rounded-full p-4`}>
              <StatusIcon className={`${statusConfig.iconColor} text-6xl`} />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t(resolveStatusKeys(pageState, isOrderPayment).titleKey)}
            </h2>
            <p className="text-gray-600">{message}</p>
          </div>

          <div className={`rounded-lg border p-4 text-left ${statusConfig.panel}`}>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-medium">{t('payments.confirm.fields.invoiceId')}</span>
                <span className="font-mono break-all text-right">
                  {paymentData?.invoice_id || invoiceId || t('common.na')}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">{t('payments.confirm.fields.transactionId')}</span>
                <span className="font-mono break-all text-right">
                  {paymentData?.transaction_id || t('common.na')}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">{t('common.status')}</span>
                <span className="capitalize text-right">
                  {statusLabel(paymentData?.status || pageState)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">{t('common.amount')}</span>
                <span className="text-right">৳{Number(paymentData?.amount || 0).toFixed(2)}</span>
              </div>
              {isOrderPayment ? null : (
                <div className="flex justify-between gap-4">
                  <span className="font-medium">{t('payments.confirm.fields.credits')}</span>
                  <span className="text-right">{Number(paymentData?.credits_to_add || 0)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="font-medium">{t('payments.confirm.fields.method')}</span>
                <span className="capitalize text-right">{paymentData?.payment_method || t('common.na')}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">{t('payments.confirm.fields.createdAt')}</span>
                <span className="text-right">{formatDate(paymentData?.created_at)}</span>
              </div>
            </div>
          </div>

          {pageState === 'awaiting_admin_approval' && !isOrderPayment ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <p className="text-sm text-blue-900 font-medium mb-2">{t('payments.confirm.nextSteps.title')}</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>{t('payments.confirm.nextSteps.verified')}</li>
                <li>{t('payments.confirm.nextSteps.threshold', { amount: AUTO_APPROVAL_THRESHOLD_BDT })}</li>
                <li>{t('payments.confirm.nextSteps.monitor')}</li>
              </ul>
            </div>
          ) : null}

          <div className="space-y-3">
            <button
              onClick={handleGoToDashboard}
              className="ui-btn ui-btn-primary w-full"
            >
              {isOrderPayment ? t('payments.confirm.order.goToMyOrders') : t('payments.confirm.goToDashboard')}
            </button>
            {pageState === 'failed' || pageState === 'cancelled' ? (
              <button
                onClick={handleTryAgain}
                className="w-full px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                {t('payments.confirm.tryAgain')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentConfirmPage
