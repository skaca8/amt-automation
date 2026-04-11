import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'

const styles = {
  page: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: 'calc(var(--header-height) + 60px) 20px 60px',
  },
  successCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-lg)',
    padding: '48px 40px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-light)',
    textAlign: 'center',
    animation: 'fadeIn 0.5s ease',
  },
  checkmark: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00c853, #69f0ae)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    fontSize: '2.5rem',
    color: 'var(--white)',
    boxShadow: '0 4px 20px rgba(0, 200, 83, 0.3)',
  },
  successTitle: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  successSubtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
    marginBottom: '32px',
  },
  bookingNumberBox: {
    background: 'var(--bg)',
    borderRadius: 'var(--radius-md)',
    padding: '20px',
    marginBottom: '28px',
  },
  bookingNumberLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  bookingNumber: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--primary)',
    letterSpacing: '2px',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    textAlign: 'left',
    marginBottom: '28px',
    padding: '20px',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-md)',
  },
  detailItem: {
    padding: '8px 0',
  },
  detailLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    marginBottom: '4px',
  },
  detailValue: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  voucherSection: {
    padding: '24px',
    background: 'linear-gradient(135deg, #e3f2fd, #f3e5f5)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '28px',
  },
  voucherTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  voucherCode: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: 'var(--secondary)',
    letterSpacing: '3px',
    marginBottom: '16px',
  },
  qrPlaceholder: {
    width: '120px',
    height: '120px',
    margin: '0 auto',
    background: 'var(--white)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed var(--border)',
  },
  qrText: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '8px',
  },
  actionBtn: {
    padding: '12px 28px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
    transition: 'var(--transition)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    border: 'none',
  },
}

export default function BookingConfirmation() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchBooking = async () => {
      setLoading(true)
      try {
        const data = await get(`/bookings/${bookingId}`)
        setBooking(data.booking || data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchBooking()
  }, [bookingId])

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>{t('common.backToHome')}</button>
        </div>
      </div>
    )
  }

  const bkn = booking?.bookingNumber || booking?.confirmationNumber || bookingId
  const voucherCode = booking?.voucherCode || booking?.voucher?.code || ''
  const productName = booking?.productName || booking?.product?.name || booking?.hotel?.name || booking?.ticket?.name || booking?.package?.name || ''
  const totalPrice = booking?.totalPrice || booking?.total || 0
  const status = booking?.status || 'confirmed'
  const bookingQuantity = booking?.quantity || 1
  const bookingType = booking?.type || ''

  return (
    <div style={styles.page}>
      <div style={styles.successCard}>
        <div style={styles.checkmark}>&#10003;</div>
        <h1 style={styles.successTitle}>{t('booking.success')}</h1>
        <p style={styles.successSubtitle}>Your booking has been confirmed. A confirmation email will be sent shortly.</p>

        <div style={styles.bookingNumberBox}>
          <div style={styles.bookingNumberLabel}>{t('booking.bookingNumber')}</div>
          <div style={styles.bookingNumber}>{bkn}</div>
        </div>

        <div style={styles.detailsGrid} className="confirm-details-grid">
          {productName && (
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>{t('booking.product')}</div>
              <div style={styles.detailValue}>{productName}</div>
            </div>
          )}
          <div style={styles.detailItem}>
            <div style={styles.detailLabel}>{t('myBookings.status')}</div>
            <div style={styles.detailValue}>
              <span className={`badge badge-${status}`}>{t(`statuses.${status}`)}</span>
            </div>
          </div>
          {(booking?.checkIn || booking?.visitDate || booking?.startDate) && (
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>{t('booking.dates')}</div>
              <div style={styles.detailValue}>
                {booking.checkIn && booking.checkOut
                  ? `${new Date(booking.checkIn).toLocaleDateString()} - ${new Date(booking.checkOut).toLocaleDateString()}`
                  : new Date(booking.visitDate || booking.startDate).toLocaleDateString()
                }
              </div>
            </div>
          )}
          {bookingQuantity > 1 && (bookingType === 'ticket' || bookingType === 'package') && (
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Quantity</div>
              <div style={styles.detailValue}>{bookingQuantity} {bookingQuantity === 1 ? 'person' : 'persons'}</div>
            </div>
          )}
          {totalPrice > 0 && (
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>{t('booking.grandTotal')}</div>
              <div style={{ ...styles.detailValue, color: 'var(--accent)' }}>
                {t('common.currency')} {totalPrice.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {voucherCode && (
          <div style={styles.voucherSection}>
            <div style={styles.voucherTitle}>{t('voucher.code')}</div>
            <div style={styles.voucherCode}>{voucherCode}</div>
            <div style={styles.qrPlaceholder}>
              <span style={styles.qrText}>{t('voucher.qrCode')}<br />&#128274;</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              {t('voucher.presentAtCheckIn')}
            </p>
          </div>
        )}

        <div style={styles.actions} className="confirm-actions">
          <Link
            to="/my-bookings"
            style={{
              ...styles.actionBtn,
              background: 'var(--primary)',
              color: 'var(--white)',
            }}
            onMouseEnter={e => { e.target.style.background = 'var(--primary-dark)' }}
            onMouseLeave={e => { e.target.style.background = 'var(--primary)' }}
          >
            {t('nav.myBookings')}
          </Link>
          <Link
            to="/"
            style={{
              ...styles.actionBtn,
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
            onMouseEnter={e => { e.target.style.background = 'var(--bg-dark)' }}
            onMouseLeave={e => { e.target.style.background = 'var(--bg)' }}
          >
            {t('common.backToHome')}
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .confirm-details-grid { grid-template-columns: 1fr !important; }
          .confirm-actions { flex-direction: column !important; }
        }
      `}</style>
    </div>
  )
}
