import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { get, post } from '../utils/api'

// Picks the locale-appropriate field off a backend product object.
// The API stores bilingual fields as `<field>_en` / `<field>_cn`.
// Falls back to the English value so Chinese callers still see content
// when a row is missing its `_cn` translation.
function pickLocalized(obj, field, lang) {
  if (!obj) return ''
  const key = `${field}_${lang === 'cn' ? 'cn' : 'en'}`
  return obj[key] || obj[`${field}_en`] || obj[field] || ''
}

// Reads the product's base price regardless of which product type it is.
// Backend schema uses `base_price` on hotels/tickets/packages/room_types.
function readBasePrice(obj) {
  if (!obj) return 0
  return Number(obj.base_price ?? obj.price ?? obj.basePrice ?? 0)
}

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
  const { t, i18n } = useTranslation()
  // Normalize the active i18n locale so pickLocalized() can select the
  // right `_en` / `_cn` column from bilingual backend records.
  const lang = i18n.language && i18n.language.startsWith('zh') ? 'cn' : (i18n.language || 'en')
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
        // Hotel detail returns `{ hotel, room_types }` — merge the
        // room_types array onto the product so the summary/totalling code
        // only has to look in one place. Tickets/packages return a single
        // wrapped object.
        let resolved
        if (type === 'hotel') {
          resolved = data.hotel ? { ...data.hotel, room_types: data.room_types || [] } : null
        } else if (type === 'ticket') {
          resolved = data.ticket || null
        } else if (type === 'package') {
          resolved = data.package || null
        } else {
          resolved = data
        }
        if (!resolved) throw new Error('Product not found')
        setProduct(resolved)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [type, id])

  // Resolves the currently selected room_type object from the hotel's
  // room_types array. Coerces both sides to string because URL params are
  // always strings but backend ids are integers.
  const getSelectedRoom = () => {
    if (!product) return null
    const roomTypes = product.room_types || []
    if (roomTypeId) {
      return roomTypes.find(r => String(r.id) === String(roomTypeId)) || null
    }
    return roomTypes[0] || null
  }

  const calculateTotal = () => {
    if (!product) return 0

    if (type === 'hotel') {
      const room = getSelectedRoom()
      const roomPrice = room ? readBasePrice(room) : readBasePrice(product)

      if (checkIn && checkOut) {
        const nights = Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)))
        return roomPrice * nights
      }
      return roomPrice
    }

    if (type === 'ticket' || type === 'package') {
      return readBasePrice(product) * quantity
    }

    return readBasePrice(product)
  }

  const getNights = () => {
    if (checkIn && checkOut) {
      return Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)))
    }
    return 1
  }

  // Returns the currently selected room type's localized name, or '' if
  // the user hasn't picked a room.
  const getRoomTypeName = () => {
    const room = roomTypeId ? getSelectedRoom() : null
    if (!room) return ''
    return pickLocalized(room, 'name', lang)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone) {
      setSubmitError(t('booking.requiredFieldsMissing'))
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      // Backend contract (backend/src/routes/bookings.js POST /) is strict
      // snake_case — sending camelCase previously caused a 400 before any
      // DB work ran. Keep this payload aligned with that route handler.
      const bookingData = {
        product_type: type,
        product_id: Number(id),
        guest_name: form.name,
        guest_email: form.email,
        guest_phone: form.phone,
        special_requests: form.specialRequests || null,
      }

      if (type === 'hotel') {
        bookingData.check_in = checkIn
        bookingData.check_out = checkOut
        if (roomTypeId) bookingData.room_type_id = Number(roomTypeId)
      } else if (type === 'ticket') {
        bookingData.visit_date = visitDate
        bookingData.quantity = quantity
      } else if (type === 'package') {
        bookingData.visit_date = visitDate
        bookingData.quantity = quantity
      }

      const result = await post('/bookings', bookingData)
      // sql.js returns integer ids under `id`; there is no `_id`.
      const bookingId = result.booking?.id || result.id
      if (!bookingId) throw new Error('Booking created but response was missing id')
      // Forward the guest email so the confirmation page can re-fetch the
      // booking even when the user is not logged in — the backend's
      // ownership check accepts `guest_email` as an authorization signal
      // for guest bookings.
      const emailParam = encodeURIComponent(form.email)
      navigate(`/booking/confirmation/${bookingId}?email=${emailParam}`)
    } catch (err) {
      setSubmitError(err.message || t('booking.failedToCreate'))
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
                <div style={styles.productName}>{pickLocalized(product, 'name', lang)}</div>
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
                  <span style={styles.summaryLabel}>{t('booking.quantity')}</span>
                  <span style={styles.summaryValue}>
                    {quantity} {quantity === 1 ? t('common.person') : t('common.persons')}
                  </span>
                </div>
              </>
            )}

            <div style={styles.divider} />

            {(type === 'ticket' || type === 'package') && (
              <div style={{ marginBottom: 8 }}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('booking.unitPrice')}</span>
                  <span style={styles.summaryValue}>
                    {'\u20A9'}{readBasePrice(product).toLocaleString()} / {t('common.person')}
                  </span>
                </div>
                {quantity > 1 && (
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>
                      {'\u00D7'} {quantity} {t('common.persons')}
                    </span>
                    <span style={styles.summaryValue}>{'\u20A9'}{total.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {type === 'hotel' && checkIn && checkOut && (
              <div style={{ marginBottom: 8 }}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('booking.roomRate')}</span>
                  <span style={styles.summaryValue}>
                    {'\u20A9'}{(getSelectedRoom() ? readBasePrice(getSelectedRoom()) : readBasePrice(product)).toLocaleString()}{' '}
                    / {t('hotel.perNight')}
                  </span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>
                    {getNights()} {getNights() > 1 ? t('common.nights') : t('common.night')}
                  </span>
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
