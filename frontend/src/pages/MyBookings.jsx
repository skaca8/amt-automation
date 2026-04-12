import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { get, put } from '../utils/api'

const styles = {
  page: {
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: 'calc(var(--header-height) + 32px) 20px 60px',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  bookingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  bookingCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '20px',
    alignItems: 'center',
    transition: 'var(--transition-slow)',
    cursor: 'pointer',
  },
  bookingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  bookingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  bookingId: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--primary)',
    background: 'rgba(26, 115, 232, 0.08)',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  productName: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  bookingMeta: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  metaItem: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  rightSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '12px',
  },
  totalPrice: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  actionBtns: {
    display: 'flex',
    gap: '8px',
  },
  viewBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary)',
    color: 'var(--white)',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--error)',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: '1px solid var(--error)',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  loginPrompt: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  loginTitle: {
    fontSize: '1.2rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  loginText: {
    color: 'var(--text-muted)',
    marginBottom: '24px',
  },
}

export default function MyBookings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    const fetchBookings = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await get('/bookings/my')
        setBookings(data.bookings || data.data || data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchBookings()
  }, [isAuthenticated, authLoading])

  const handleCancel = async (e, bookingId) => {
    e.stopPropagation()
    if (!window.confirm(t('myBookings.confirmCancel'))) return

    setCancellingId(bookingId)
    try {
      // Backend contract: PUT /bookings/:id/cancel (authenticated).
      await put(`/bookings/${bookingId}/cancel`, {})
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, status: 'cancelled' } : b
      ))
    } catch (err) {
      alert(err.message || t('common.error'))
    } finally {
      setCancellingId(null)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: 'badge-pending',
      confirmed: 'badge-confirmed',
      cancelled: 'badge-cancelled',
      refunded: 'badge-refunded',
    }
    return statusMap[status] || 'badge-pending'
  }

  // Reads the most relevant date for the booking card summary. All source
  // columns are snake_case because they come straight from the bookings
  // row on the backend.
  const getDisplayDate = (booking) => {
    if (booking.check_in && booking.check_out) {
      return `${new Date(booking.check_in).toLocaleDateString()} - ${new Date(booking.check_out).toLocaleDateString()}`
    }
    if (booking.visit_date) return new Date(booking.visit_date).toLocaleDateString()
    if (booking.created_at) return new Date(booking.created_at).toLocaleDateString()
    return '-'
  }

  if (authLoading || loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (!isAuthenticated) {
    return (
      <div style={styles.page}>
        <div style={styles.loginPrompt}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>&#128221;</div>
          <h2 style={styles.loginTitle}>{t('auth.loginRequired')}</h2>
          <p style={styles.loginText}>{t('myBookings.noBookings')}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/login" className="btn btn-primary">{t('auth.loginBtn')}</Link>
            <Link to="/order-lookup" className="btn btn-outline">{t('auth.orderLookup')}</Link>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>{t('common.retry')}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t('myBookings.title')}</h1>
      </div>

      {bookings.length > 0 ? (
        <div style={styles.bookingList}>
          {bookings.map(booking => {
            const bid = booking.id
            const canCancel = booking.status === 'pending' || booking.status === 'confirmed'

            return (
              <div
                key={bid}
                style={styles.bookingCard}
                className="my-booking-card"
                onClick={() => navigate(`/my-bookings/${bid}`)}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--primary-light)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
              >
                <div style={styles.bookingInfo}>
                  <div style={styles.bookingHeader}>
                    <span style={styles.bookingId}>
                      {booking.booking_number || `#${bid}`}
                    </span>
                    <span className={`badge ${getStatusBadge(booking.status)}`}>
                      {t(`statuses.${booking.status || 'pending'}`)}
                    </span>
                  </div>
                  <div style={styles.productName}>
                    {t(`nav.${booking.product_type}s`, booking.product_type || 'Booking')}
                  </div>
                  <div style={styles.bookingMeta}>
                    <span style={styles.metaItem}>&#128197; {getDisplayDate(booking)}</span>
                    {booking.product_type && (
                      <span style={styles.metaItem}>&#128196; {booking.product_type}</span>
                    )}
                  </div>
                </div>

                <div style={styles.rightSection}>
                  <div style={styles.totalPrice}>
                    {t('common.currency')} {Number(booking.total_price || 0).toLocaleString()}
                  </div>
                  <div style={styles.actionBtns}>
                    <Link
                      to={`/my-bookings/${bid}`}
                      style={styles.viewBtn}
                      onClick={e => e.stopPropagation()}
                      onMouseEnter={e => { e.target.style.background = 'var(--primary-dark)' }}
                      onMouseLeave={e => { e.target.style.background = 'var(--primary)' }}
                    >
                      {t('myBookings.details')}
                    </Link>
                    {canCancel && (
                      <button
                        style={styles.cancelBtn}
                        onClick={e => handleCancel(e, bid)}
                        disabled={cancellingId === bid}
                        onMouseEnter={e => { e.target.style.background = 'var(--error)'; e.target.style.color = 'var(--white)' }}
                        onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--error)' }}
                      >
                        {cancellingId === bid ? '...' : t('myBookings.cancel')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">&#128221;</div>
          <p className="empty-state-title">{t('myBookings.noBookings')}</p>
          <Link to="/hotels" className="btn btn-primary" style={{ marginTop: '16px' }}>
            {t('myBookings.browseHotels')}
          </Link>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .my-booking-card {
            grid-template-columns: 1fr !important;
            text-align: left;
          }
          .my-booking-card > div:last-child {
            align-items: flex-start !important;
            flex-direction: row !important;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  )
}
