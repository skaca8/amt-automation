// ============================================================================
// Admin — 결제 관리 페이지 PaymentManagement
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) /admin/payments 엔드포인트로 결제 이력을 조회(페이지네이션 + 필터).
//   2) 행 클릭 시 Modal 로 결제 상세 정보를 보여 준다(게이트웨이 응답 포함).
//   3) 상태(Paid/Unpaid/Refunded/Failed/Pending) 와 결제 수단(Credit Card,
//      Alipay, WeChat Pay, Bank Transfer, PayPal) 필터, 기간 필터 제공.
//
// 렌더링 위치: /payments 라우트.
//
// 주의:
//   - 날짜 필터 파라미터는 반드시 from_date / to_date 여야 한다.
//     과거에 start_date / end_date 로 보냈을 때 서버가 조용히 무시해
//     필터가 "작동하는 것처럼" 보였던 이슈가 있었다(e504ce7 에서 수정).
//   - 환불/취소 버튼은 이 페이지에 없다. 실제 환불 액션은 BookingDetail 에서
//     수행하고, 여기서는 결제 상태의 "보기 전용" 뷰만 제공한다.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { get } from '../utils/api'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'

/**
 * PaymentManagement — 결제 목록 + 필터 + 상세 모달.
 *
 * 부작용: GET /admin/payments, 상세 모달 open/close.
 */
export default function PaymentManagement() {
  // payments       : 현재 페이지의 결제 행
  // filters        : 상태/결제수단/기간 필터 값
  // selectedPayment: 상세 모달에 띄울 결제
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
      // 백엔드 routes/admin/payments.js 는 `from_date` / `to_date` 쿼리
      // 파라미터를 받는다. 예전 코드에서 start_date/end_date 를 사용했을 때는
      // 서버가 조용히 무시해서 필터가 안 먹히는 버그가 있었다(e504ce7 수정).
      if (filters.startDate) params.set('from_date', filters.startDate)
      if (filters.endDate) params.set('to_date', filters.endDate)

      const res = await get(`/admin/payments?${params.toString()}`)
      setPayments(res.payments || res.data || [])
      setTotalPages(res.pagination?.total_pages || res.totalPages || 1)
      setTotalItems(res.pagination?.total || res.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  // 필터 변경: 1페이지로 리셋. useEffect → loadPayments 순으로 재조회.
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  // 행 클릭 → 상세 모달 오픈. 모달 close 시 selectedPayment 도 초기화한다.
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
      key: 'booking_number',
      label: 'Booking #',
      render: (val, row) => (
        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
          {val || row.bookingNumber || '-'}
        </span>
      ),
    },
    {
      key: 'guest_name',
      label: 'Customer',
      render: (val, row) => val || row.guestName || row.user?.name || '-',
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (val, row) => (
        <span style={{ fontWeight: 600 }}>
          {formatCurrency(val || row.total_amount || row.totalAmount)}
        </span>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      render: (val, row) => (
        <span style={{ textTransform: 'capitalize' }}>
          {val || row.payment_method || row.paymentMethod || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => <StatusBadge status={val || row.payment_status || row.paymentStatus} type="payment" />,
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (val, row) => formatDateTime(val || row.createdAt || row.paidAt),
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
                {selectedPayment.booking_number || selectedPayment.bookingNumber || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Customer</span>
              <span className="value">
                {selectedPayment.guest_name || selectedPayment.guestName || selectedPayment.user?.name || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Amount</span>
              <span className="value" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                {formatCurrency(selectedPayment.amount || selectedPayment.total_amount || selectedPayment.totalAmount)}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Status</span>
              <span className="value">
                <StatusBadge status={selectedPayment.status || selectedPayment.payment_status || selectedPayment.paymentStatus} type="payment" />
              </span>
            </div>
            <div className="info-item">
              <span className="label">Payment Method</span>
              <span className="value" style={{ textTransform: 'capitalize' }}>
                {selectedPayment.method || selectedPayment.payment_method || selectedPayment.paymentMethod || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Transaction ID</span>
              <span className="value" style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {selectedPayment.stripe_payment_id || selectedPayment.transaction_id || selectedPayment.transactionId || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Currency</span>
              <span className="value">{selectedPayment.currency || 'KRW'}</span>
            </div>
            <div className="info-item">
              <span className="label">Date</span>
              <span className="value">
                {formatDateTime(selectedPayment.created_at || selectedPayment.createdAt || selectedPayment.paidAt)}
              </span>
            </div>
            {(selectedPayment.refunded_at || selectedPayment.refundedAt) && (
              <div className="info-item">
                <span className="label">Refunded At</span>
                <span className="value">{formatDateTime(selectedPayment.refunded_at || selectedPayment.refundedAt)}</span>
              </div>
            )}
            {(selectedPayment.refund_reason || selectedPayment.refundReason) && (
              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Refund Reason</span>
                <span className="value">{selectedPayment.refund_reason || selectedPayment.refundReason}</span>
              </div>
            )}
            {(selectedPayment.gateway_response || selectedPayment.gatewayResponse) && (
              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Gateway Response</span>
                <span className="value" style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {typeof (selectedPayment.gateway_response || selectedPayment.gatewayResponse) === 'object'
                    ? JSON.stringify(selectedPayment.gateway_response || selectedPayment.gatewayResponse, null, 2)
                    : (selectedPayment.gateway_response || selectedPayment.gatewayResponse)}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
