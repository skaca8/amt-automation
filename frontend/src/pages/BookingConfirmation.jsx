// ============================================================================
// BookingConfirmation — 예약 완료 페이지 (/booking/confirmation/:bookingId)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 방금 생성된 예약 1건을 /bookings/:id 로 다시 조회해 예약 번호, 상품,
//     날짜, 수량, 총액, 상태, 바우처 코드를 카드 형태로 보여 준다.
//   - 비로그인 예약도 완료 화면으로 넘어오기 때문에, BookingPage 가 URL 쿼리
//     로 넘겨 준 guest_email 을 그대로 서버로 전달해 ownership 검증을 통과시킨다.
//
// 렌더 위치: /booking/confirmation/:bookingId. lazy-loaded.
//
// 주의:
//   - 백엔드 응답은 { booking, voucher, payment, product, room_type } 이며
//     booking 의 모든 컬럼명은 snake_case(sql.js row 직결).
//   - 응답에서 guest_email 소지자 확인이 실패하면 404/403 을 돌려주는데,
//     이 페이지는 그 경우 단순 에러 메시지만 표시한다.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'

/**
 * 백엔드 상품 객체에서 현재 언어에 맞는 필드를 골라 읽는다.
 * _cn 번역이 비어 있으면 _en 으로 fallback. (BookingPage 와 동일한 정책.)
 */
function pickLocalized(obj, field, lang) {
  if (!obj) return ''
  const key = `${field}_${lang === 'cn' ? 'cn' : 'en'}`
  return obj[key] || obj[`${field}_en`] || obj[field] || ''
}

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

/**
 * 예약 완료 페이지.
 *
 * 내부 state:
 *   - data    : { booking, voucher, payment, product, room_type } 응답 전체
 *   - loading : 초기 조회 스피너
 *   - error   : 조회 실패 메시지
 *
 * 부작용: 마운트 시 /bookings/:id (+ guest_email 쿼리) GET.
 */
export default function BookingConfirmation() {
  const { bookingId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = i18n.language && i18n.language.startsWith('zh') ? 'cn' : (i18n.language || 'en')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchBooking = async () => {
      setLoading(true)
      try {
        // 백엔드 /bookings/:id 는 로그인된 소유자이거나 guest_email 쿼리가
        // 일치해야 응답을 돌려 준다. BookingPage 에서 결제 직후 URL 로
        // email 을 넘겨 주므로 비회원 예약도 이 페이지가 정상 동작한다.
        const emailParam = searchParams.get('email')
        const url = emailParam
          ? `/bookings/${bookingId}?guest_email=${encodeURIComponent(emailParam)}`
          : `/bookings/${bookingId}`
        const res = await get(url)
        setData(res || null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchBooking()
  }, [bookingId, searchParams])

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

  // 백엔드 응답 shape: { booking, voucher, payment, product, room_type }.
  // booking 내부 모든 컬럼은 sqlite row 에서 직접 오기 때문에 snake_case 다.
  const booking = data?.booking || null
  const voucher = data?.voucher || booking?.voucher || null
  const product = data?.product || null
  const roomType = data?.room_type || null

  // UI 에 보여줄 파생 값. 빈 응답이어도 안전하게 '-' 로 fallback 되도록 준비.
  const bkn = booking?.booking_number || bookingId
  const voucherCode = voucher?.code || ''
  const productName = pickLocalized(product, 'name', lang)
  const totalPrice = Number(booking?.total_price || 0)
  const status = booking?.status || 'confirmed'
  const bookingQuantity = booking?.quantity || 1
  const bookingType = booking?.product_type || ''
  const checkIn = booking?.check_in || ''
  const checkOut = booking?.check_out || ''
  const visitDate = booking?.visit_date || ''

  return (
    <div style={styles.page}>
      <div style={styles.successCard}>
        <div style={styles.checkmark}>&#10003;</div>
        <h1 style={styles.successTitle}>{t('booking.success')}</h1>
        <p style={styles.successSubtitle}>{t('booking.confirmationMessage')}</p>

        <div style={styles.bookingNumberBox}>
          <div style={styles.bookingNumberLabel}>{t('booking.bookingNumber')}</div>
          <div style={styles.bookingNumber}>{bkn}</div>
        </div>

        <div style={styles.detailsGrid} className="confirm-details-grid">
          {productName && (
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>{t('booking.product')}</div>
              <div style={styles.detailValue}>
                {productName}
                {roomType && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {pickLocalized(roomType, 'name', lang)}
                  </div>
                )}
              </div>
            </div>
          )}
          <div style={styles.detailItem}>
            <div style={styles.detailLabel}>{t('myBookings.status')}</div>
            <div style={styles.detailValue}>
              <span className={`badge badge-${status}`}>{t(`statuses.${status}`)}</span>
            </div>
          </div>
          {(checkIn || visitDate) && (
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>{t('booking.dates')}</div>
              <div style={styles.detailValue}>
                {checkIn && checkOut
                  ? `${new Date(checkIn).toLocaleDateString()} - ${new Date(checkOut).toLocaleDateString()}`
                  : visitDate ? new Date(visitDate).toLocaleDateString() : '-'
                }
              </div>
            </div>
          )}
          {bookingQuantity > 1 && (bookingType === 'ticket' || bookingType === 'package') && (
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>{t('booking.quantity')}</div>
              <div style={styles.detailValue}>
                {bookingQuantity} {bookingQuantity === 1 ? t('common.person') : t('common.persons')}
              </div>
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
