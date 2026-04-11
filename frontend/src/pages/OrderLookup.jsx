import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'

const styles = {
  page: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: 'calc(var(--header-height) + 60px) 20px 60px',
  },
  card: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-light)',
  },
  icon: {
    textAlign: 'center',
    fontSize: '3rem',
    marginBottom: '16px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textAlign: 'center',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginBottom: '32px',
  },
  searchByText: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '16px',
  },
  formGroup: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    transition: 'var(--transition)',
  },
  dividerOr: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '12px 0',
  },
  orLine: {
    flex: 1,
    height: '1px',
    background: 'var(--border)',
  },
  orText: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  searchBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary)',
    color: 'var(--white)',
    fontWeight: 700,
    fontSize: '1rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    marginTop: '24px',
  },
  resultsList: {
    marginTop: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  resultCard: {
    padding: '18px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'var(--transition)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  resultLeft: {},
  resultId: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--primary)',
    marginBottom: '4px',
  },
  resultName: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '2px',
  },
  resultDate: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  resultRight: {
    textAlign: 'right',
  },
  resultPrice: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: '4px',
  },
  noResults: {
    textAlign: 'center',
    padding: '32px 16px',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  errorMsg: {
    color: 'var(--error)',
    fontSize: '0.85rem',
    textAlign: 'center',
    marginTop: '16px',
    padding: '10px 14px',
    background: 'var(--error-bg)',
    borderRadius: 'var(--radius-sm)',
  },
  loginLink: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
}

export default function OrderLookup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [bookingNumber, setBookingNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!bookingNumber && !email && !phone) return

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const params = new URLSearchParams()
      if (bookingNumber) params.set('bookingNumber', bookingNumber)
      if (email) params.set('email', email)
      if (phone) params.set('phone', phone)

      const data = await get(`/bookings/lookup?${params.toString()}`)
      const bookings = data.bookings || data.data || (Array.isArray(data) ? data : data.booking ? [data.booking] : [data])
      setResults(bookings)
    } catch (err) {
      setError(err.message || 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const map = {
      pending: 'badge-pending',
      confirmed: 'badge-confirmed',
      cancelled: 'badge-cancelled',
      refunded: 'badge-refunded',
    }
    return map[status] || 'badge-pending'
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>&#128270;</div>
        <h1 style={styles.title}>{t('orderLookup.title')}</h1>
        <p style={styles.subtitle}>{t('orderLookup.subtitle')}</p>

        <p style={styles.searchByText}>{t('orderLookup.searchBy')}</p>

        <form onSubmit={handleSearch}>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t('orderLookup.bookingNumber')}</label>
            <input
              type="text"
              style={styles.input}
              value={bookingNumber}
              onChange={e => setBookingNumber(e.target.value)}
              placeholder="e.g. BK-20240101-XXXX"
              onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>

          <div style={styles.dividerOr}>
            <span style={styles.orLine} />
            <span style={styles.orText}>or</span>
            <span style={styles.orLine} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('orderLookup.email')}</label>
            <input
              type="email"
              style={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>

          <div style={styles.dividerOr}>
            <span style={styles.orLine} />
            <span style={styles.orText}>or</span>
            <span style={styles.orLine} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('orderLookup.phone')}</label>
            <input
              type="tel"
              style={styles.input}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+82-xxx-xxxx"
              onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.searchBtn,
              ...(loading ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
            }}
            disabled={loading || (!bookingNumber && !email && !phone)}
            onMouseEnter={e => { if (!loading) { e.target.style.background = 'var(--primary-dark)' } }}
            onMouseLeave={e => { e.target.style.background = 'var(--primary)' }}
          >
            {loading ? t('common.loading') : t('orderLookup.searchBtn')}
          </button>
        </form>

        {error && <div style={styles.errorMsg}>{error}</div>}

        {results !== null && (
          <div style={styles.resultsList}>
            {results.length > 0 ? (
              results.map(booking => {
                const bid = booking._id || booking.id
                return (
                  <div
                    key={bid}
                    style={styles.resultCard}
                    onClick={() => navigate(`/my-bookings/${bid}`)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={styles.resultLeft}>
                      <div style={styles.resultId}>
                        #{booking.bookingNumber || booking.confirmationNumber || bid?.slice(-8)}
                      </div>
                      <div style={styles.resultName}>
                        {booking.productName || booking.product?.name || 'Booking'}
                      </div>
                      <div style={styles.resultDate}>
                        {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <div style={styles.resultRight}>
                      <div style={styles.resultPrice}>
                        {t('common.currency')} {(booking.totalPrice || booking.total || 0).toLocaleString()}
                      </div>
                      <span className={`badge ${getStatusBadge(booking.status)}`}>
                        {t(`statuses.${booking.status || 'pending'}`)}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={styles.noResults}>{t('orderLookup.noResults')}</div>
            )}
          </div>
        )}

        <div style={styles.loginLink}>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            {t('auth.login')}
          </Link>{' '}
          {t('auth.hasAccount')}
        </div>
      </div>
    </div>
  )
}
