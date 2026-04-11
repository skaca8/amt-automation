import React, { useState, useEffect, useCallback } from 'react'
import { get } from '../utils/api'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'

export default function PaymentManagement() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [filters, setFilters] = useState({
    status: '',
    method: '',
    startDate: '',
    endDate: '',
  })
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showDetail, setShowDetail] = useState(false)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', page)
      params.set('limit', 20)
      if (filters.status) params.set('status', filters.status)
      if (filters.method) params.set('method', filters.method)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)

      const res = await get(`/admin/payments?${params.toString()}`)
      setPayments(res.data || res.payments || [])
      setTotalPages(res.totalPages || res.pagination?.totalPages || 1)
      setTotalItems(res.total || res.pagination?.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleRowClick = (payment) => {
    setSelectedPayment(payment)
    setShowDetail(true)
  }

  const formatCurrency = (val) => {
    if (val == null) return '-'
    return '\u20a9' + Number(val).toLocaleString()
  }

  const formatDateTime = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const columns = [
    {
      key: 'bookingNumber',
      label: 'Booking #',
      render: (val, row) => (
        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
          {val || row.booking_number || row.booking?.bookingNumber || '-'}
        </span>
      ),
    },
    {
      key: 'guestName',
      label: 'Customer',
      render: (val, row) => val || row.guest_name || row.user?.name || row.booking?.guestName || '-',
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (val, row) => (
        <span style={{ fontWeight: 600 }}>
          {formatCurrency(val || row.totalAmount || row.total_amount)}
        </span>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      render: (val, row) => (
        <span style={{ textTransform: 'capitalize' }}>
          {val || row.paymentMethod || row.payment_method || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => <StatusBadge status={val || row.paymentStatus || row.payment_status} type="payment" />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (val, row) => formatDateTime(val || row.created_at || row.paidAt),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Payment Management</h1>
          <p>Track and manage all payment transactions</p>
        </div>
        <button className="btn btn-secondary" onClick={loadPayments}>
          {'\u21BB'} Refresh
        </button>
      </div>

      <div className="filters-bar">
        <select
          className="form-control"
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="refunded">Refunded</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
        <select
          className="form-control"
          value={filters.method}
          onChange={(e) => handleFilterChange('method', e.target.value)}
        >
          <option value="">All Methods</option>
          <option value="credit_card">Credit Card</option>
          <option value="alipay">Alipay</option>
          <option value="wechat_pay">WeChat Pay</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="paypal">PayPal</option>
        </select>
        <input
          type="date"
          className="form-control"
          value={filters.startDate}
          onChange={(e) => handleFilterChange('startDate', e.target.value)}
        />
        <input
          type="date"
          className="form-control"
          value={filters.endDate}
          onChange={(e) => handleFilterChange('endDate', e.target.value)}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={columns}
        data={payments}
        loading={loading}
        onRowClick={handleRowClick}
        emptyMessage="No payments found matching your filters"
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={setPage}
      />

      {/* Payment Detail Modal */}
      <Modal
        isOpen={showDetail}
        onClose={() => { setShowDetail(false); setSelectedPayment(null) }}
        title="Payment Details"
        size="md"
        footer={
          <button className="btn btn-secondary" onClick={() => { setShowDetail(false); setSelectedPayment(null) }}>
            Close
          </button>
        }
      >
        {selectedPayment && (
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Booking Number</span>
              <span className="value" style={{ fontWeight: 600, color: '#3b82f6' }}>
                {selectedPayment.bookingNumber || selectedPayment.booking_number || selectedPayment.booking?.bookingNumber || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Customer</span>
              <span className="value">
                {selectedPayment.guestName || selectedPayment.guest_name || selectedPayment.user?.name || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Amount</span>
              <span className="value" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                {formatCurrency(selectedPayment.amount || selectedPayment.totalAmount || selectedPayment.total_amount)}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Status</span>
              <span className="value">
                <StatusBadge status={selectedPayment.status || selectedPayment.paymentStatus || selectedPayment.payment_status} type="payment" />
              </span>
            </div>
            <div className="info-item">
              <span className="label">Payment Method</span>
              <span className="value" style={{ textTransform: 'capitalize' }}>
                {selectedPayment.method || selectedPayment.paymentMethod || selectedPayment.payment_method || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Transaction ID</span>
              <span className="value" style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {selectedPayment.transactionId || selectedPayment.transaction_id || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Currency</span>
              <span className="value">{selectedPayment.currency || 'KRW'}</span>
            </div>
            <div className="info-item">
              <span className="label">Date</span>
              <span className="value">
                {formatDateTime(selectedPayment.createdAt || selectedPayment.created_at || selectedPayment.paidAt)}
              </span>
            </div>
            {selectedPayment.refundedAt && (
              <div className="info-item">
                <span className="label">Refunded At</span>
                <span className="value">{formatDateTime(selectedPayment.refundedAt)}</span>
              </div>
            )}
            {selectedPayment.refundReason && (
              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Refund Reason</span>
                <span className="value">{selectedPayment.refundReason}</span>
              </div>
            )}
            {selectedPayment.gatewayResponse && (
              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Gateway Response</span>
                <span className="value" style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {typeof selectedPayment.gatewayResponse === 'object'
                    ? JSON.stringify(selectedPayment.gatewayResponse, null, 2)
                    : selectedPayment.gatewayResponse}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
