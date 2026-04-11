import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { get, post } from '../utils/api'

const styles = {
  page: {
    maxWidth: 'var(--max-width)',
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
  title: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '32px',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: '40px',
    alignItems: 'start',
  },
  formCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '32px',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
  },
  formTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '24px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border)',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
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
  textarea: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    transition: 'var(--transition)',
    resize: 'vertical',
    minHeight: '100px',
    fontFamily: 'inherit',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  summaryCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '28px',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-light)',
    position: 'sticky',
    top: 'calc(var(--header-height) + 32px)',
  },
  summaryTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border)',
  },
  summaryProduct: {
    display: 'flex',
    gap: '14px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border-light)',
  },
  productThumb: {
    width: '80px',
    height: '60px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  productMeta: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: '0.9rem',
  },
  summaryLabel: {
    color: 'var(--text-secondary)',
  },
  summaryValue: {
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '12px 0',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 0 0',
  },
  totalLabel: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  totalAmount: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  paymentNote: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: '12px',
    marginBottom: '20px',
    padding: '10px',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-sm)',
  },
  confirmBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent)',
    color: 'var(--white)',
    fontWeight: 700,
    fontSize: '1.05rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  errorMsg: {
    color: 'var(--error)',
    fontSize: '0.85rem',
    marginBottom: '12px',
    padding: '10px 14px',
    background: 'var(--error-bg)',
    borderRadius: 'var(--radius-sm)',
  },
}

const typeGradients = {
  hotel: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  ticket: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  package: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
}

const typeIcons = {
  hotel: '\u{1F3E8}',
  ticket: '\u{1F3BF}',
  package: '\u{1F381}',
}

export default function BookingPage() {
  const { type, id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, isAuthenticated } = useAuth()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const checkIn = searchParams.get('checkIn') || ''
  const checkOut = searchParams.get('checkOut') || ''
  const roomTypeId = searchParams.get('roomType') || ''
  const visitDate = searchParams.get('date') || ''
  const quantity = parseInt(searchParams.get('quantity') || '1', 10)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialRequests: '',
    nationality: '',
  })

  useEffect(() => {
    if (isAuthenticated && user) {
      setForm(f => ({
        ...f,
        name: user.name || f.name,
        email: user.email || f.email,
        phone: user.phone || f.phone,
        nationality: user.nationality || f.nationality,
      }))
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      try {
        let endpoint = ''
        if (type === 'hotel') endpoint = `/hotels/${id}`
        else if (type === 'ticket') endpoint = `/tickets/${id}`
        else if (type === 'package') endpoint = `/packages/${id}`
        else throw new Error('Invalid booking type')

        const data = await get(endpoint)
        setProduct(data.hotel || data.ticket || data.package || data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [type, id])

  const calculateTotal = () => {
    if (!product) return 0

    if (type === 'hotel') {
      let roomPrice = 0
      const roomTypes = product.roomTypes || []
      if (roomTypeId) {
        const room = roomTypes.find(r => (r._id || r.id) === roomTypeId)
        roomPrice = room ? (room.price || room.basePrice || 0) : 0
      } else if (roomTypes.length > 0) {
        roomPrice = roomTypes[0].price || roomTypes[0].basePrice || 0
      } else {
        roomPrice = product.price || product.basePrice || 0
      }

      if (checkIn && checkOut) {
        const nights = Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)))
        return roomPrice * nights
      }
      return roomPrice
    }

    if (type === 'ticket') {
      return (product.price || product.basePrice || 0) * quantity
    }

    if (type === 'package') {
      return (product.price || product.basePrice || 0) * quantity
    }

    return product.price || product.basePrice || 0
  }

  const getNights = () => {
    if (checkIn && checkOut) {
      return Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)))
    }
    return 1
  }

  const getRoomTypeName = () => {
    if (!product || !roomTypeId) return ''
    const roomTypes = product.roomTypes || []
    const room = roomTypes.find(r => (r._id || r.id) === roomTypeId)
    return room ? (room.name || room.type || '') : ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone) {
      setSubmitError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const bookingData = {
        type,
        productId: id,
        guestName: form.name,
        guestEmail: form.email,
        guestPhone: form.phone,
        specialRequests: form.specialRequests,
        nationality: form.nationality,
      }

      if (type === 'hotel') {
        bookingData.checkIn = checkIn
        bookingData.checkOut = checkOut
        if (roomTypeId) bookingData.roomTypeId = roomTypeId
      } else if (type === 'ticket') {
        bookingData.visitDate = visitDate
        bookingData.quantity = quantity
      } else if (type === 'package') {
        bookingData.startDate = visitDate
        bookingData.quantity = quantity
      }

      const result = await post('/bookings', bookingData)
      const bookingId = result.booking?._id || result.booking?.id || result._id || result.id
      navigate(`/booking/confirmation/${bookingId}`)
    } catch (err) {
      setSubmitError(err.message || 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInput = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
  }

  const total = calculateTotal()

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (error || !product) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error || 'Product not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <button
        style={styles.backBtn}
        onClick={() => navigate(-1)}
        onMouseEnter={e => { e.target.style.color = 'var(--primary)' }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-secondary)' }}
      >
        &larr; {t('common.back')}
      </button>

      <h1 style={styles.title}>{t('booking.title')}</h1>

      <form onSubmit={handleSubmit}>
        <div style={styles.layout} className="booking-layout">
          {/* Guest Info Form */}
          <div style={styles.formCard}>
            <h2 style={styles.formTitle}>{t('booking.guestInfo')}</h2>

            {submitError && <div style={styles.errorMsg}>{submitError}</div>}

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('booking.name')} *</label>
              <input
                type="text"
                style={styles.input}
                value={form.name}
                onChange={handleInput('name')}
                required
                placeholder={t('booking.name')}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div style={styles.row} className="booking-form-row">
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('booking.email')} *</label>
                <input
                  type="email"
                  style={styles.input}
                  value={form.email}
                  onChange={handleInput('email')}
                  required
                  placeholder={t('booking.email')}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>{t('booking.phone')} *</label>
                <input
                  type="tel"
                  style={styles.input}
                  value={form.phone}
                  onChange={handleInput('phone')}
                  required
                  placeholder={t('booking.phone')}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('booking.nationality')}</label>
              <input
                type="text"
                style={styles.input}
                value={form.nationality}
                onChange={handleInput('nationality')}
                placeholder={t('booking.nationality')}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('booking.specialRequests')}</label>
              <textarea
                style={styles.textarea}
                value={form.specialRequests}
                onChange={handleInput('specialRequests')}
                placeholder={t('booking.specialRequests')}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>
          </div>

          {/* Summary Sidebar */}
          <div style={styles.summaryCard}>
            <h2 style={styles.summaryTitle}>{t('booking.summary')}</h2>

            <div style={styles.summaryProduct}>
              <div style={{ ...styles.productThumb, background: typeGradients[type] || typeGradients.hotel }}>
                {typeIcons[type] || typeIcons.hotel}
              </div>
              <div style={styles.productInfo}>
                <div style={styles.productName}>{product.name || product.title}</div>
                {getRoomTypeName() && (
                  <div style={styles.productMeta}>{getRoomTypeName()}</div>
                )}
              </div>
            </div>

            {type === 'hotel' && (
              <>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('hotel.checkIn')}</span>
                  <span style={styles.summaryValue}>{checkIn || '-'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('hotel.checkOut')}</span>
                  <span style={styles.summaryValue}>{checkOut || '-'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('booking.nights')}</span>
                  <span style={styles.summaryValue}>{getNights()} {t('common.night')}</span>
                </div>
              </>
            )}

            {type === 'ticket' && (
              <>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('ticket.visitDate')}</span>
                  <span style={styles.summaryValue}>{visitDate || '-'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('ticket.quantity')}</span>
                  <span style={styles.summaryValue}>{quantity} {quantity === 1 ? t('common.person') : t('common.persons')}</span>
                </div>
              </>
            )}

            {type === 'package' && (
              <>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('package.startDate')}</span>
                  <span style={styles.summaryValue}>{visitDate || '-'}</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Quantity</span>
                  <span style={styles.summaryValue}>{quantity} {quantity === 1 ? 'person' : 'persons'}</span>
                </div>
              </>
            )}

            <div style={styles.divider} />

            {(type === 'ticket' || type === 'package') && (
              <div style={{ marginBottom: 8 }}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Unit Price</span>
                  <span style={styles.summaryValue}>{'\u20A9'}{(product.price || product.basePrice || 0).toLocaleString()} / person</span>
                </div>
                {quantity > 1 && (
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>{'\u00D7'} {quantity} persons</span>
                    <span style={styles.summaryValue}>{'\u20A9'}{total.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {type === 'hotel' && checkIn && checkOut && (
              <div style={{ marginBottom: 8 }}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Room Rate</span>
                  <span style={styles.summaryValue}>{'\u20A9'}{(() => {
                    const roomTypes = product.roomTypes || []
                    let roomPrice = 0
                    if (roomTypeId) {
                      const room = roomTypes.find(r => (r._id || r.id) === roomTypeId)
                      roomPrice = room ? (room.price || room.basePrice || 0) : 0
                    } else if (roomTypes.length > 0) {
                      roomPrice = roomTypes[0].price || roomTypes[0].basePrice || 0
                    } else {
                      roomPrice = product.price || product.basePrice || 0
                    }
                    return roomPrice.toLocaleString()
                  })()} / room / night</span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{getNights()} night{getNights() > 1 ? 's' : ''}</span>
                  <span style={styles.summaryValue}>{'\u20A9'}{total.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>{t('booking.grandTotal')}</span>
              <span style={styles.totalAmount}>{'\u20A9'}{total.toLocaleString()}</span>
            </div>

            <div style={styles.paymentNote}>{t('booking.paymentNote')}</div>

            <button
              type="submit"
              style={{
                ...styles.confirmBtn,
                ...(submitting ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
              }}
              disabled={submitting}
              onMouseEnter={e => { if (!submitting) { e.target.style.background = 'var(--accent-dark)'; e.target.style.boxShadow = '0 4px 16px rgba(255,111,0,0.3)' } }}
              onMouseLeave={e => { e.target.style.background = 'var(--accent)'; e.target.style.boxShadow = 'none' }}
            >
              {submitting ? t('booking.processing') : t('booking.confirm')}
            </button>
          </div>
        </div>
      </form>

      <style>{`
        @media (max-width: 768px) {
          .booking-layout { grid-template-columns: 1fr !important; }
          .booking-form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
