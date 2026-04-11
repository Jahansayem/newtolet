import React, { useEffect, useState } from 'react'
import { FiEye } from 'react-icons/fi'
import { getPaymentHistory } from '../../services/paymentService'

const STATUS_STYLES = {
  awaiting_admin_approval: 'bg-yellow-100 text-yellow-800',
  credited: 'bg-green-100 text-green-800',
  pending: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-purple-100 text-purple-800',
}

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const titleCaseStatus = (status) => (status || 'pending').replace(/_/g, ' ')

const PaymentHistory = ({ userId }) => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      const result = await getPaymentHistory(userId)
      setPayments(result.data || [])
      setLoading(false)
    }

    fetchHistory()
  }, [userId])

  const filteredPayments =
    filter === 'all' ? payments : payments.filter((payment) => payment.status === filter)

  const totalSpent = payments
    .filter((payment) => ['awaiting_admin_approval', 'credited'].includes(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

  const totalCredits = payments
    .filter((payment) => payment.status === 'credited')
    .reduce((sum, payment) => sum + Number(payment.credits_to_add || 0), 0)

  const filters = [
    ['all', 'All'],
    ['awaiting_admin_approval', 'Awaiting Approval'],
    ['credited', 'Credited'],
    ['pending', 'Pending'],
    ['failed', 'Failed'],
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
          <p className="text-gray-600 text-sm font-medium">Total Transactions</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{payments.length}</p>
          <p className="text-xs text-gray-600 mt-1">All recorded purchases</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm font-medium">Paid Amount</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">৳{totalSpent.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mt-1">Verified or credited purchases</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
          <p className="text-gray-600 text-sm font-medium">Credits Granted</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{totalCredits}</p>
          <p className="text-xs text-gray-600 mt-1">Approved credit top-ups</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => {
          const count =
            value === 'all'
              ? payments.length
              : payments.filter((payment) => payment.status === value).length

          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-full transition ${
                filter === value
                  ? 'bg-[#1E73B8]600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E73B8]600"></div>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg font-medium">No transactions yet</p>
          <p className="text-gray-500 mt-1">Start by purchasing a credit package.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">
                    Transaction ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Method</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Credits</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{formatDate(payment.created_at)}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">
                      {payment.transaction_id?.substring(0, 12)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 capitalize">
                      {payment.payment_method || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ৳{Number(payment.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-block px-3 py-1 bg-[#1E73B8]100 text-[#1E73B8]800 rounded-full text-xs font-bold">
                        +{payment.credits_to_add} Credits
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          STATUS_STYLES[payment.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {titleCaseStatus(payment.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="text-[#1E73B8]600 hover:text-[#1E73B8]800 font-medium flex items-center gap-1"
                      >
                        <FiEye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedPayment ? (
        <PaymentDetailModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />
      ) : null}
    </div>
  )
}

const PaymentDetailModal = ({ payment, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
          ×
        </button>
      </div>

      <div className="space-y-4 pb-6 border-b">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Transaction ID</span>
          <span className="font-mono text-gray-900 text-right break-all">{payment.transaction_id}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Invoice ID</span>
          <span className="font-mono text-gray-900 text-right break-all">
            {payment.invoice_id || 'Pending'}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Date &amp; Time</span>
          <span className="text-gray-900 text-right">{formatDate(payment.created_at)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Payment Method</span>
          <span className="capitalize text-gray-900 text-right">{payment.payment_method || 'N/A'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Amount</span>
          <span className="font-bold text-gray-900 text-right">৳{Number(payment.amount || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Credits Purchased</span>
          <span className="font-bold text-[#1E73B8]600 text-right">{payment.credits_to_add}</span>
        </div>
      </div>

      <div className="py-6 space-y-2">
        <h4 className="font-bold text-gray-900">Status</h4>
        <div
          className={`p-4 rounded-lg text-center font-bold ${
            STATUS_STYLES[payment.status] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {titleCaseStatus(payment.status)}
        </div>
      </div>

      {payment.description ? (
        <div className="py-4 border-t border-b">
          <h4 className="font-bold text-gray-900 mb-2">Package</h4>
          <p className="text-gray-600">{payment.description}</p>
        </div>
      ) : null}

      <div className="mt-6">
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-[#1E73B8]600 text-white rounded-lg hover:bg-[#1E73B8]700 transition font-medium"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)

export default PaymentHistory
