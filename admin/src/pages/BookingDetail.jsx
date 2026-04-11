import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { get, put, post } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)
  const [statusValue, setStatusValue] = useState('')
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundProcessing, setRefundProcessing] = useState(false)

  useEffect(() => {
    loadBooking()
  }, [id])

  const loadBooking = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get(`/admin/bookings/${id}`)
      const data = res.booking || res.data || res
      setBooking(data)
      setStatusValue(data.status || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async () => {
    if (!statusValue || statusValue === booking.status) return
    setUpdating(true)
    try {
      await put(`/admin/bookings/${id}/status`, { status: statusValue })
      await loadBooking()
    } catch (err) {
      alert('Failed to update status: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleCancelBooking = async () => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return
    setUpdating(true)
    try {
      await put(`/admin/bookings/${id}/status`, { status: 'cancelled' })
      await loadBooking()
    } catch (err) {
      alert('Failed to cancel booking: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleRefund = async () => {
    setRefundProcessing(true)
    try {
      await post(`/admin/bookings/${id}/refund`, { reason: refundReason })
      setShowRefundModal(false)
      setRefundReason('')
      await loadBooking()
    } catch (err) {
      alert('Refund failed: ' + err.message)
    } finally {
      setRefundProcessing(false)
    }
  }

  const formatCurrency = (val) => {
    if (val == null) return '-'
    return '\u20a9' + Number(val).toLocaleString()
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  const formatDateTime = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div>
        <div className="back-link" onClick={() => navigate('/bookings')}>
          {'\u2190'} Back to Bookings
        </div>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 16, color: '#64748b' }}>Loading booking details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="back-link" onClick={() => navigate('/bookings')}>
          {'\u2190'} Back to Bookings
        </div>
        <div className="alert alert-error">{error}</div>
      </div>
    )
  }

  if (!booking) return null

  const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed'
  const canRefund = (booking.payment_status === 'paid' || booking.paymentStatus === 'paid') &&
    booking.status !== 'refunded'

  return (
    <div>
      <div className="back-link" onClick={() => navigate('/bookings')}>
        {'\u2190'} Back to Bookings
      </div>

      <div className="page-header">
        <div>
          <h1>Booking #{booking.booking_number || booking.bookingNumber}</h1>
          <p>Created {formatDateTime(booking.created_at || booking.createdAt)}</p>
        </div>
        <div className="btn-group">
          {canCancel && (
            <button
              className="btn btn-danger"
              onClick={handleCancelBooking}
              disabled={updating}
            >
              Cancel Booking
            </button>
          )}
          {canRefund && (
            <button
              className="btn btn-warning"
              onClick={() => setShowRefundModal(true)}
            >
              Process Refund
            </button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* Booking Info */}
        <div className="card">
          <h3 className="section-title">Booking Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Booking Number</span>
              <span className="value">{booking.booking_number || booking.bookingNumber || '-'}</span>
            </div>
            <div className="info-item">
              <span className="label">Status</span>
              <span className="value"><StatusBadge status={booking.status} type="booking" /></span>
            </div>
            <div className="info-item">
              <span className="label">Check-in</span>
              <span className="value">{formatDate(booking.check_in || booking.checkInDate || booking.date)}</span>
            </div>
            <div className="info-item">
              <span className="label">Check-out</span>
              <span className="value">{formatDate(booking.check_out || booking.checkOutDate)}</span>
            </div>
            <div className="info-item">
              <span className="label">Product Type</span>
              <span className="value" style={{ textTransform: 'capitalize' }}>
                {booking.product_type || booking.productType || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Created</span>
              <span className="value">{formatDateTime(booking.created_at || booking.createdAt)}</span>
            </div>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 8, display: 'block' }}>
              Update Status
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="form-control"
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                className="btn btn-primary"
                onClick={handleStatusUpdate}
                disabled={updating || statusValue === booking.status}
              >
                {updating ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>

        {/* Guest Info */}
        <div className="card">
          <h3 className="section-title">Guest Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Name</span>
              <span className="value">
                {booking.guest_name || booking.guestName || booking.user?.name || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Email</span>
              <span className="value">
                {booking.guest_email || booking.guestEmail || booking.user?.email || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Phone</span>
              <span className="value">
                {booking.guest_phone || booking.guestPhone || booking.user?.phone || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Nationality</span>
              <span className="value">
                {booking.guest_nationality || booking.guestNationality || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Guests</span>
              <span className="value">
                {booking.guests || booking.guest_count || booking.guestCount || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Special Requests</span>
              <span className="value">
                {booking.special_requests || booking.specialRequests || 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Product Info */}
        <div className="card">
          <h3 className="section-title">Product Details</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Product Name</span>
              <span className="value">
                {booking.product_name || booking.productName || booking.product?.name_en || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Product Type</span>
              <span className="value" style={{ textTransform: 'capitalize' }}>
                {booking.product_type || booking.productType || '-'}
              </span>
            </div>
            {(booking.room_type || booking.roomType) && (
              <div className="info-item">
                <span className="label">Room Type</span>
                <span className="value">{booking.room_type || booking.roomType}</span>
              </div>
            )}
            {(booking.quantity || booking.ticket_count) && (
              <div className="info-item">
                <span className="label">Quantity</span>
                <span className="value">{booking.quantity || booking.ticket_count}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Info */}
        <div className="card">
          <h3 className="section-title">Payment Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Total Amount</span>
              <span className="value" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#3b82f6' }}>
                {formatCurrency(booking.total_price || booking.total_amount)}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Payment Status</span>
              <span className="value">
                <StatusBadge
                  status={booking.payment_status || booking.paymentStatus}
                  type="payment"
                />
              </span>
            </div>
            <div className="info-item">
              <span className="label">Payment Method</span>
              <span className="value" style={{ textTransform: 'capitalize' }}>
                {booking.payment_method || booking.paymentMethod || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Transaction ID</span>
              <span className="value" style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                {booking.transaction_id || booking.transactionId || '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Voucher Info */}
      {(booking.voucher || booking.voucher_code || booking.voucherCode) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="section-title">Voucher Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Voucher Code</span>
              <span className="value" style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.05em' }}>
                {booking.voucher?.code || booking.voucher_code || booking.voucherCode || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Voucher Status</span>
              <span className="value">
                <StatusBadge
                  status={booking.voucher?.status || booking.voucher_status || booking.voucherStatus || 'active'}
                />
              </span>
            </div>
            {(booking.voucher?.qr_code || booking.qr_code || booking.qrCode) && (
              <div className="info-item">
                <span className="label">QR Code</span>
                <img
                  src={booking.voucher?.qr_code || booking.qr_code || booking.qrCode}
                  alt="QR Code"
                  style={{ width: 120, height: 120, marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 8, padding: 4 }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refund Modal */}
      <Modal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        title="Process Refund"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowRefundModal(false)}>
              Cancel
            </button>
            <button
              className="btn btn-warning"
              onClick={handleRefund}
              disabled={refundProcessing}
            >
              {refundProcessing ? 'Processing...' : 'Confirm Refund'}
            </button>
          </>
        }
      >
        <p style={{ marginBottom: 16, color: '#64748b' }}>
          This will refund the full amount of{' '}
          <strong>{formatCurrency(booking.total_price || booking.total_amount)}</strong>{' '}
          to the customer.
        </p>
        <div className="form-group">
          <label>Reason for Refund</label>
          <textarea
            className="form-control"
            rows={3}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Enter reason for refund..."
          />
        </div>
        <div className="alert alert-warning" style={{ marginBottom: 0 }}>
          This action cannot be undone. The booking status will be updated to "refunded".
        </div>
      </Modal>
    </div>
  )
}
