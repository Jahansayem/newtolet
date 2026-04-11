import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FiAlertCircle, FiCheckCircle, FiClock, FiLoader } from 'react-icons/fi'
import { verifyPayment } from '../../services/paymentService'

const AUTO_APPROVAL_THRESHOLD_BDT = 3000

const STATUS_STYLES = {
  awaiting_admin_approval: {
    icon: FiClock,
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
    panel: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    title: 'Payment Under Review',
    description:
      'Your payment was verified successfully and is waiting for admin review before credits are granted.',
  },
  pending: {
    icon: FiClock,
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
    panel: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    title: 'Payment Pending',
    description:
      'The payment is still pending confirmation from the gateway. Please check again shortly.',
  },
  credited: {
    icon: FiCheckCircle,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    panel: 'bg-green-50 border-green-200 text-green-800',
    title: 'Credits Added',
    description: 'Your verified payment has been credited to your account.',
  },
  cancelled: {
    icon: FiAlertCircle,
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-200',
    panel: 'bg-gray-50 border-gray-200 text-gray-700',
    title: 'Payment Cancelled',
    description: 'The payment was cancelled before it was completed.',
  },
  failed: {
    icon: FiAlertCircle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    panel: 'bg-red-50 border-red-200 text-red-800',
    title: 'Payment Failed',
    description: 'The payment could not be verified. Please try again or contact support.',
  },
}

const formatDate = (value) => {
  if (!value) {
    return 'N/A'
  }

  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const PaymentConfirmPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [pageState, setPageState] = useState('processing')
  const [paymentData, setPaymentData] = useState(null)
  const [message, setMessage] = useState('Verifying your payment...')

  const invoiceId = searchParams.get('invoice_id') || searchParams.get('invoiceId')
  const explicitState = searchParams.get('state')

  const statusConfig = useMemo(() => {
    if (pageState === 'processing') {
      return null
    }

    return STATUS_STYLES[pageState] || STATUS_STYLES.failed
  }, [pageState])

  useEffect(() => {
    if (explicitState === 'cancelled') {
      setPageState('cancelled')
      setMessage(STATUS_STYLES.cancelled.description)
      return
    }

    if (!invoiceId) {
      setPageState('failed')
      setMessage('No invoice ID was returned from the payment gateway.')
      return
    }

    const runVerification = async () => {
      setPageState('processing')
      setMessage('Verifying your payment...')

      const result = await verifyPayment(invoiceId)

      if (result.error) {
        setPageState('failed')
        setMessage(result.error.message || 'Unable to verify this payment.')
        return
      }

      const payment = result.data?.payment || null
      const nextStatus = payment?.status || 'pending'
      const resolvedConfig = STATUS_STYLES[nextStatus] || STATUS_STYLES.failed

      setPaymentData(payment)
      setPageState(nextStatus)
      setMessage(resolvedConfig.description)
    }

    runVerification()
  }, [explicitState, invoiceId])

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  const handleTryAgain = () => {
    navigate('/book/buy-credits')
  }

  if (pageState === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1E73B8]/10 to-blue-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-600 animate-spin"></div>
              <FiLoader className="text-[#1E73B8] text-3xl animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{message}</h2>
          {invoiceId ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-gray-600 mb-2">Invoice ID</p>
              <p className="font-mono text-gray-900 text-sm break-all">{invoiceId}</p>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const StatusIcon = statusConfig?.icon || FiAlertCircle

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E73B8]/10 to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-2xl p-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className={`${statusConfig.iconBg} rounded-full p-4`}>
              <StatusIcon className={`${statusConfig.iconColor} text-6xl`} />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{statusConfig.title}</h2>
            <p className="text-gray-600">{message}</p>
          </div>

          <div className={`rounded-lg border p-4 text-left ${statusConfig.panel}`}>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-medium">Invoice ID</span>
                <span className="font-mono break-all text-right">{invoiceId || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">Transaction ID</span>
                <span className="font-mono break-all text-right">
                  {paymentData?.transaction_id || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">Status</span>
                <span className="capitalize text-right">
                  {(paymentData?.status || pageState).replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">Amount</span>
                <span className="text-right">৳{Number(paymentData?.amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">Credits</span>
                <span className="text-right">{Number(paymentData?.credits_to_add || 0)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">Payment Method</span>
                <span className="capitalize text-right">{paymentData?.payment_method || 'N/A'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-medium">Created At</span>
                <span className="text-right">{formatDate(paymentData?.created_at)}</span>
              </div>
            </div>
          </div>

          {pageState === 'awaiting_admin_approval' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <p className="text-sm text-blue-900 font-medium mb-2">What happens next</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>Your payment has been verified and logged.</li>
                <li>Verified payments above ৳{AUTO_APPROVAL_THRESHOLD_BDT} require admin approval.</li>
                <li>You can monitor the status from your dashboard payment history.</li>
              </ul>
            </div>
          ) : null}

          <div className="space-y-3">
            <button
              onClick={handleGoToDashboard}
              className="w-full rounded-lg bg-[#1E73B8] px-6 py-3 font-medium text-white transition hover:bg-[#155a90]"
            >
              Go to Dashboard
            </button>
            {pageState === 'failed' || pageState === 'cancelled' ? (
              <button
                onClick={handleTryAgain}
                className="w-full px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Try Again
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentConfirmPage
