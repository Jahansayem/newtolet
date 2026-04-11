import React, { useCallback, useEffect, useState } from 'react'
import { FiCheckCircle, FiFilter, FiRefreshCw, FiSearch, FiUsers } from 'react-icons/fi'
import {
  approvePaymentTransaction,
  getAllPaymentTransactions,
  getDashboardStats,
  getPaymentTransactionsByStatus,
  updateTransactionStatus,
} from '../../services/adminService'

const STATUS_STYLES = {
  awaiting_admin_approval: 'bg-yellow-100 text-yellow-800',
  credited: 'bg-green-100 text-green-800',
  pending: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-purple-100 text-purple-800',
}

const STATUS_OPTIONS = [
  ['all', 'All Transactions'],
  ['awaiting_admin_approval', 'Awaiting Approval'],
  ['credited', 'Credited'],
  ['pending', 'Pending'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
  ['refunded', 'Refunded'],
]

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const titleizeStatus = (status) => (status || 'pending').replace(/_/g, ' ')

const PaymentMonitoring = () => {
  const [transactions, setTransactions] = useState([])
  const [filteredTransactions, setFilteredTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [totalUsers, setTotalUsers] = useState(0)
  const [busyId, setBusyId] = useState(null)

  const fetchUserStats = useCallback(async () => {
    const result = await getDashboardStats()
    if (result.data) {
      setTotalUsers(result.data.totalUsers || 0)
    }
  }, [])

  const applySearch = useCallback((items, value) => {
    const query = value.trim().toLowerCase()

    if (!query) {
      setFilteredTransactions(items)
      return
    }

    setFilteredTransactions(
      items.filter((transaction) =>
        [
          transaction.users?.email,
          transaction.users?.name,
          transaction.id,
          transaction.transaction_id,
          transaction.invoice_id,
          transaction.amount?.toString(),
          transaction.payment_method,
        ]
          .filter(Boolean)
          .some((entry) => String(entry).toLowerCase().includes(query))
      )
    )
  }, [])

  const fetchTransactions = useCallback(async (status = 'all') => {
    setLoading(true)
    const result =
      status === 'all'
        ? await getAllPaymentTransactions()
        : await getPaymentTransactionsByStatus(status)

    const items = result.data || []
    setTransactions(items)
    setFilteredTransactions(items)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTransactions(statusFilter)
    fetchUserStats()
  }, [fetchTransactions, fetchUserStats, statusFilter])

  useEffect(() => {
    applySearch(transactions, searchTerm)
  }, [applySearch, searchTerm, transactions])

  const handleSearch = (value) => {
    setSearchTerm(value)
    applySearch(transactions, value)
  }

  const handleApprove = async (transactionId) => {
    setBusyId(transactionId)
    const result = await approvePaymentTransaction(transactionId)

    if (result.data) {
      setFeedback({ type: 'success', text: 'Payment approved and credits granted successfully.' })
      await fetchTransactions(statusFilter)
      setSelectedTransaction(null)
    } else {
      setFeedback({
        type: 'error',
        text: result.error?.message || 'Unable to approve this payment.',
      })
    }

    setBusyId(null)
  }

  const handleStatusChange = async (transactionId, nextStatus) => {
    setBusyId(transactionId)
    const result = await updateTransactionStatus(transactionId, nextStatus)

    if (result.data) {
      setFeedback({ type: 'success', text: 'Payment status updated successfully.' })
      await fetchTransactions(statusFilter)
      setSelectedTransaction(null)
    } else {
      setFeedback({
        type: 'error',
        text: result.error?.message || 'Unable to update this payment.',
      })
    }

    setBusyId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <FiUsers className="text-white text-xl" />
          </div>
          <div>
            <p className="text-gray-900 text-xs font-medium uppercase tracking-wide">Total Users</p>
            <p className="text-xl font-bold text-white leading-tight">{totalUsers}</p>
          </div>
        </div>
      </div>

      {feedback.text ? (
        <div
          className={`px-4 py-3 rounded-lg flex justify-between items-center ${
            feedback.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback({ type: '', text: '' })}>×</button>
        </div>
      ) : null}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, invoice, transaction, or amount..."
              value={searchTerm}
              onChange={(event) => handleSearch(event.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchTransactions(statusFilter)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium inline-flex items-center justify-center gap-2"
          >
            <FiRefreshCw />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg">No transactions found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">
                      {transaction.transaction_id?.substring(0, 16)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        <p className="font-medium">{transaction.users?.name || 'N/A'}</p>
                        <p className="text-gray-600 text-xs">{transaction.users?.email || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ৳{Number(transaction.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          STATUS_STYLES[transaction.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {titleizeStatus(transaction.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {transaction.invoice_id || 'Pending'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(transaction.created_at)}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => setSelectedTransaction(transaction)}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTransaction ? (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onApprove={handleApprove}
          onClose={() => setSelectedTransaction(null)}
          onStatusChange={handleStatusChange}
          busy={busyId === selectedTransaction.id}
        />
      ) : null}
    </div>
  )
}

const TransactionDetailModal = ({ transaction, onApprove, onClose, onStatusChange, busy }) => {
  const [nextStatus, setNextStatus] = useState(transaction.status)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">
            ×
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 pb-6 border-b">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Transaction ID</label>
              <p className="font-mono text-gray-900 break-all">{transaction.transaction_id}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Invoice ID</label>
              <p className="font-mono text-gray-900 break-all">{transaction.invoice_id || 'Pending'}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Amount</label>
              <p className="text-2xl font-bold text-green-600">৳{Number(transaction.amount || 0).toFixed(2)}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Credits to Add</label>
              <p className="font-bold text-[#1E73B8]600">{transaction.credits_to_add}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">User</label>
              <p className="font-medium text-gray-900">{transaction.users?.name || 'N/A'}</p>
              <p className="text-sm text-gray-600">{transaction.users?.email || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Payment Method</label>
              <p className="text-gray-900 capitalize">{transaction.payment_method || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date</label>
              <p className="text-gray-900">{formatDate(transaction.created_at)}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Status</label>
              <span
                className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                  STATUS_STYLES[transaction.status] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {titleizeStatus(transaction.status)}
              </span>
            </div>
          </div>

          {transaction.description ? (
            <div className="pb-6 border-b">
              <label className="block text-sm text-gray-600 mb-2">Description</label>
              <p className="text-gray-700">{transaction.description}</p>
            </div>
          ) : null}

          {transaction.status === 'awaiting_admin_approval' ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <FiCheckCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-yellow-900">Ready for approval</p>
                  <p className="text-sm text-yellow-800">
                    The gateway verification has completed. Approving this purchase will add credits to the user.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-semibold text-gray-900 mb-3">Update Status</label>
            <div className="flex gap-3">
              <select
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              >
                <option value="pending">Pending</option>
                <option value="awaiting_admin_approval">Awaiting approval</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
              <button
                onClick={() => onStatusChange(transaction.id, nextStatus)}
                disabled={busy || transaction.status === 'credited'}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Close
            </button>
            {transaction.status === 'awaiting_admin_approval' ? (
              <button
                onClick={() => onApprove(transaction.id)}
                disabled={busy}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Approving...' : 'Approve & Grant Credits'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentMonitoring
