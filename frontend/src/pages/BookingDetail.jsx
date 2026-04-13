// ============================================================================
// BookingDetail — 내 예약 상세 페이지 (/my-bookings/:id)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - /bookings/:id 에서 단건 예약을 다시 조회해 상품/객실/게스트 정보/상태
//     타임라인/바우처/가격 내역을 카드 형태로 렌더한다.
//   - 상태가 pending 또는 confirmed 인 예약은 "취소" 버튼을 활성화하고,
//     PUT /bookings/:id/cancel 로 취소 요청을 보낸다. 성공 시 UI 상태를
//     'cancelled' 로 업데이트한다.
//
// 렌더 위치: /my-bookings/:id. MyBookings 리스트에서 진입. lazy-loaded.
//
// 주의:
//   - 이 페이지는 로그인 사용자가 진입하는 라우트라서 api.js 의 Authorization
//     헤더만으로 ownership 이 검증된다. guest_email 쿼리 forwarding 은 필요 없음.
//   - 백엔드는 PUT /bookings/:id/cancel 을 쓴다. DELETE /bookings/:id 는 없다.
//   - booking 객체의 필드는 모두 snake_case (check_in, check_out, visit_date,
//     guest_name, guest_email, guest_phone, special_requests, total_price,
//     product_type, booking_number) — sql.js row 직결.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get, put } from '../utils/api'

/**
 * 상품 객체에서 현재 언어 필드를 꺼내는 헬퍼.
 * BookingPage/BookingConfirmation 과 동일 구현을 페이지마다 복제한다 —
 * 아직 공용 util 모듈이 없어서 그렇게 두었다.
 */
function pickLocalized(obj, field, lang) {
  if (!obj) return ''
  const key = `${field}_${lang === 'cn' ? 'cn' : 'en'}`
  return obj[key] || obj[`${field}_en`] || obj[field] || ''
}

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

/**
 * 내 예약 상세.
 *
 * 내부 state:
 *   - data       : { booking, product, room_type, voucher, ... } 응답 전체
 *   - cancelling : 취소 요청 중 버튼 비활성화 용
 *
 * 부작용:
 *   - 마운트 시 /bookings/:id GET
 *   - "취소" 클릭 시 PUT /bookings/:id/cancel
 */
export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = i18n.language && i18n.language.startsWith('zh') ? 'cn' : (i18n.language || 'en')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    const fetchBooking = async () => {
      setLoading(true)
      try {
        // 이 페이지는 /my-bookings 에서 진입하므로 사용자는 반드시 로그인
        // 상태다. api.js 가 붙여 주는 Authorization 헤더만으로 백엔드의
        // ownership 체크를 통과한다 — guest_email 쿼리는 불필요.
        const res = await get(`/bookings/${id}`)
        setData(res || null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchBooking()
  }, [id])

  /**
   * 예약 취소. window.confirm 으로 사용자 확인 후 PUT /bookings/:id/cancel.
   * 성공하면 화면 상태만 'cancelled' 로 바꿔 자연스럽게 뱃지/타임라인/버튼을
   * 갱신한다. (리스트 재조회는 /my-bookings 로 돌아갈 때 발생.)
   */
  const handleCancel = async () => {
    if (!window.confirm(t('myBookings.confirmCancel'))) return
    setCancelling(true)
    try {
      // 백엔드는 PUT /bookings/:id/cancel 을 노출한다. DELETE /bookings/:id
      // 는 존재하지 않으므로 PUT 으로 명시적 취소 엔드포인트를 호출해야 한다.
      const res = await put(`/bookings/${id}/cancel`, {})
      setData(prev => ({
        ...(prev || {}),
        booking: { ...(prev?.booking || {}), ...(res?.booking || {}), status: 'cancelled' }
      }))
    } catch (err) {
      alert(err.message || t('common.error'))
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  const booking = data?.booking || null
  const product = data?.product || null
  const roomType = data?.room_type || null
  const voucher = data?.voucher || null

  if (error || !booking) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error || t('common.error')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/my-bookings')}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  const status = booking.status || 'pending'
  // pending / confirmed 상태만 사용자가 직접 취소할 수 있다.
  // cancelled / refunded 는 이미 종결 상태라 버튼을 감춘다.
  const canCancel = status === 'pending' || status === 'confirmed'
  const bkn = booking.booking_number || id
  const voucherCode = voucher?.code || ''
  // 이름은 bilingual 필드를 우선 시도하고, 상품 row 자체가 비어 있으면
  // product_type(원시 enum) 이라도 표시해 완전히 빈 화면을 피한다.
  const productName = pickLocalized(product, 'name', lang) || booking.product_type || 'Booking'
  const totalPrice = Number(booking.total_price || 0)
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
          {/* Product Info — reads snake_case fields straight from the
              bookings row and optional joined product/room_type rows. */}
          <h3 style={styles.sectionTitle}>{t('booking.product')}</h3>
          <div style={styles.infoGrid} className="detail-info-grid">
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.product')}</div>
              <div style={styles.infoValue}>{productName}</div>
            </div>
            {booking.product_type && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('common.type') || 'Type'}</div>
                <div style={styles.infoValue}>{booking.product_type}</div>
              </div>
            )}
            {roomType && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('hotel.roomType')}</div>
                <div style={styles.infoValue}>{pickLocalized(roomType, 'name', lang)}</div>
              </div>
            )}
            {booking.check_in && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('hotel.checkIn')}</div>
                <div style={styles.infoValue}>{new Date(booking.check_in).toLocaleDateString()}</div>
              </div>
            )}
            {booking.check_out && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('hotel.checkOut')}</div>
                <div style={styles.infoValue}>{new Date(booking.check_out).toLocaleDateString()}</div>
              </div>
            )}
            {booking.visit_date && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('ticket.visitDate')}</div>
                <div style={styles.infoValue}>{new Date(booking.visit_date).toLocaleDateString()}</div>
              </div>
            )}
            {booking.quantity && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('ticket.quantity')}</div>
                <div style={styles.infoValue}>{booking.quantity}</div>
              </div>
            )}
            {booking.nights && booking.product_type === 'hotel' && (
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>{t('booking.nights')}</div>
                <div style={styles.infoValue}>{booking.nights}</div>
              </div>
            )}
          </div>

          {/* Guest Info */}
          <h3 style={styles.sectionTitle}>{t('booking.guestInfo')}</h3>
          <div style={styles.infoGrid} className="detail-info-grid">
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.name')}</div>
              <div style={styles.infoValue}>{booking.guest_name || '-'}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.email')}</div>
              <div style={styles.infoValue}>{booking.guest_email || '-'}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>{t('booking.phone')}</div>
              <div style={styles.infoValue}>{booking.guest_phone || '-'}</div>
            </div>
          </div>

          {booking.special_requests && (
            <>
              <h3 style={styles.sectionTitle}>{t('booking.specialRequests')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '32px' }}>
                {booking.special_requests}
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
