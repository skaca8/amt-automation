import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get, del } from '../utils/api'

const styles = {
  page: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: 'calc(var(--header-height) + 32px) 20px 60px',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginBottom: '24px',
    background: 'none',
    border: 'none',
    padding: 0,
    transition: 'var(--transition)',
  },
  card: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-light)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '28px 32px',
    background: 'linear-gradient(135deg, #0d47a1, #1a73e8)',
    color: 'var(--white)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  headerLeft: {},
  bookingTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    opacity: 0.8,
    marginBottom: '6px',
  },
  bookingNum: {
    fontSize: '1.4rem',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  statusBadge: {
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardBody: {
    padding: '32px',
  },
  sectionTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border-light)',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '32px',
  },
  infoItem: {},
  infoLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    marginBottom: '4px',
  },
  infoValue: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  timeline: {
    position: 'relative',
    paddingLeft: '28px',
    marginBottom: '32px',
  },
  timelineLine: {
    position: 'absolute',
    left: '8px',
    top: '4px',
    bottom: '4px',
    width: '2px',
    background: 'var(--border)',
  },
  timelineItem: {
    position: 'relative',
    paddingBottom: '20px',
  },
  timelineDot: {
    position: 'absolute',
    left: '-24px',
    top: '2px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid var(--white)',
  },
  timelineContent: {},
  timelineTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '2px',
  },
  timelineDate: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  voucherBox: {
    padding: '24px',
    background: 'linear-gradient(135deg, #e8eaf6, #f3e5f5)',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center',
    marginBottom: '32px',
  },
  voucherLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  voucherCode: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--secondary)',
    letterSpacing: '3px',
    marginBottom: '16px',
  },
  qrBox: {
    width: '100px',
    height: '100px',
    margin: '0 auto',
    background: 'var(--white)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed var(--border)',
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  priceSection: {
    marginBottom: '32px',
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: '0.9rem',
  },
  priceLabel: {
    color: 'var(--text-secondary)',
  },
  priceValue: {
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '14px 0',
    borderTop: '2px solid var(--border)',
    marginTop: '8px',
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  totalAmount: {
    color: 'var(--accent)',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-light)',
  },
}

const statusColors = {
  pending: { bg: 'rgba(255,255,255,0.2)', text: '#fff' },
  confirmed: { bg: '#e8f5e9', text: '#2e7d32' },
  cancelled: { bg: '#ffebee', text: '#c62828' },
  refunded: { bg: '#eceff1', text: '#546e7a' },
}

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const fetchBooking = async () => {
      setLoading(true)
      try {
        const data = await get(`/bookings/${id}`)
        setBooking(data.booking || data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchBooking()
  }, [id])

  const handleCancel = async () => {
    if (!window.confirm(t('myBookings.confirmCancel'))) return
    setCancelling(true)
    try {
      await del(`/bookings/${id}`)
      setBooking(prev => ({ ...prev, status: 'cancelled' }))
    } catch (err) {
      alert(err.message || 'Failed to cancel')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (error || !booking) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error || 'Booking not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/my-bookings')}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  const status = booking.status || 'pending'
  const canCancel = status === 'pending' || status === 'confirmed'
  const bkn = booking.bookingNumber || booking.confirmationNumber || id?.slice(-8)
  const voucherCode = booking.voucherCode || booking.voucher?.code || ''
  const productName = booking.productName || booking.product?.name || booking.hotel?.name || booking.ticket?.name || booking.package?.name || 'Booking'
  const totalPrice = booking.totalPrice || booking.total || 0
  const sc = statusColors[status] || statusColors.pending

  const timelineSteps = [
    { label: t('statuses.pending'), done: true, color: 'var(--warning)' },
    { label: t('statuses.confirmed'), done: status === 'confirmed' || status === 'cancelled' || status === 'refunded', color: 'var(--success)' },
  ]
  if (status === 'cancelled') {
    timelineSteps.push({ label: t('statuses.cancelled'), done: true, color: 'var(--error)' })
  }
  if (status === 'refunded') {
    timelineSteps.push({ label: t('statuses.refunded'), done: true, color: 'var(--text-muted)' })
  }

  return (
    <div style={styles.page}>
      <button
        style={styles.backBtn}
        onClick={() => navigate('/my-bookings')}
        onMouseEnter={e => { e.target.style.color = 'var(--primary)' }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-secondary)' }}
      >
        &larr; {t('common.back')}
      </button>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.headerLeft}>
            <div style={styles.bookingTitle}>{t('booking.bookingNumber')}</div>
            <div style={styles.bookingNum}>#{bkn}</div>
          </div>
          <span style={{
            ...styles.statusBadge,
            background: sc.bg,
            color: sc.text,
          }}>
            {t(`statuses.${status}`)}
          </span>
        </div>

        <div style={styles.cardBody}>
          {/* Product Info */}
          <h3 style={styles.sectionTitle}>{t('booking.product')}</h3>
          <div style={styles.infoGrid} className="detail-info-grid">
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.product')}</div>
              <div style={styles.infoValue}>{productName}</div>
            </div>
            {booking.type && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Type</div>
                <div style={styles.infoValue}>{booking.type}</div>
              </div>
            )}
            {booking.checkIn && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('hotel.checkIn')}</div>
                <div style={styles.infoValue}>{new Date(booking.checkIn).toLocaleDateString()}</div>
              </div>
            )}
            {booking.checkOut && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('hotel.checkOut')}</div>
                <div style={styles.infoValue}>{new Date(booking.checkOut).toLocaleDateString()}</div>
              </div>
            )}
            {booking.visitDate && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('ticket.visitDate')}</div>
                <div style={styles.infoValue}>{new Date(booking.visitDate).toLocaleDateString()}</div>
              </div>
            )}
            {booking.quantity && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('ticket.quantity')}</div>
                <div style={styles.infoValue}>{booking.quantity}</div>
              </div>
            )}
          </div>

          {/* Guest Info */}
          <h3 style={styles.sectionTitle}>{t('booking.guestInfo')}</h3>
          <div style={styles.infoGrid} className="detail-info-grid">
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.name')}</div>
              <div style={styles.infoValue}>{booking.guestName || booking.name || '-'}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.email')}</div>
              <div style={styles.infoValue}>{booking.guestEmail || booking.email || '-'}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.phone')}</div>
              <div style={styles.infoValue}>{booking.guestPhone || booking.phone || '-'}</div>
            </div>
            {(booking.nationality || booking.guestNationality) && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('booking.nationality')}</div>
                <div style={styles.infoValue}>{booking.nationality || booking.guestNationality}</div>
              </div>
            )}
          </div>

          {booking.specialRequests && (
            <>
              <h3 style={styles.sectionTitle}>{t('booking.specialRequests')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '32px' }}>
                {booking.specialRequests}
              </p>
            </>
          )}

          {/* Status Timeline */}
          <h3 style={styles.sectionTitle}>{t('myBookings.status')}</h3>
          <div style={styles.timeline}>
            <div style={styles.timelineLine} />
            {timelineSteps.map((step, i) => (
              <div key={i} style={styles.timelineItem}>
                <div style={{
                  ...styles.timelineDot,
                  background: step.done ? step.color : 'var(--border)',
                  boxShadow: step.done ? `0 0 0 3px ${step.color}33` : 'none',
                }} />
                <div style={styles.timelineContent}>
                  <div style={{
                    ...styles.timelineTitle,
                    color: step.done ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}>{step.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Voucher */}
          {voucherCode && status !== 'cancelled' && (
            <>
              <h3 style={styles.sectionTitle}>{t('voucher.title')}</h3>
              <div style={styles.voucherBox}>
                <div style={styles.voucherLabel}>{t('voucher.code')}</div>
                <div style={styles.voucherCode}>{voucherCode}</div>
                <div style={styles.qrBox}>
                  {t('voucher.qrCode')}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
                  {t('voucher.presentAtCheckIn')}
                </p>
              </div>
            </>
          )}

          {/* Price */}
          <h3 style={styles.sectionTitle}>{t('booking.priceBreakdown')}</h3>
          <div style={styles.priceSection}>
            <div style={styles.priceRow}>
              <span style={styles.priceLabel}>{t('booking.subtotal')}</span>
              <span style={styles.priceValue}>{t('common.currency')} {totalPrice.toLocaleString()}</span>
            </div>
            <div style={styles.totalRow}>
              <span>{t('booking.grandTotal')}</span>
              <span style={styles.totalAmount}>{t('common.currency')} {totalPrice.toLocaleString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <Link to="/my-bookings" className="btn btn-outline btn-sm">{t('common.back')}</Link>
            {canCancel && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? t('common.loading') : t('myBookings.cancel')}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .detail-info-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
