// ============================================================================
// MyBookings — 내 예약 리스트 페이지 (/my-bookings)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 로그인된 사용자의 예약 전부를 /bookings/my 로 조회해 카드 목록으로
//     보여 준다. 카드 클릭 시 /my-bookings/:id 상세로 이동.
//   - pending / confirmed 예약 카드에는 인라인 취소 버튼(PUT
//     /bookings/:id/cancel)이 노출된다.
//   - 비로그인 상태면 로그인 유도 박스 + 비회원 OrderLookup 링크 안내.
//
// 렌더 위치: /my-bookings. lazy-loaded.
//
// 주의:
//   - booking 필드는 모두 snake_case(check_in/check_out/visit_date/created_at/
//     booking_number/total_price/product_type). sql.js row 직결.
//   - 취소는 DELETE 가 아니라 PUT /bookings/:id/cancel 이다(e504ce7).
// ============================================================================

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

/**
 * 내 예약 리스트 페이지.
 * 부작용: 로그인 상태가 true 가 되는 즉시 /bookings/my GET 1회.
 */
export default function MyBookings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // 지금 취소 중인 예약의 id. 버튼을 개별로 disabled 처리하는 용도.
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => {
    // AuthContext 가 아직 /auth/me 를 확인 중이면 결정 대기.
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

  /**
   * 개별 예약 취소.
   * e.stopPropagation() 으로 카드 클릭(상세 navigate) 이벤트 전파를 막고,
   * 확인 다이얼로그 통과 시 서버에 취소 요청을 보낸다.
   * 성공하면 해당 카드만 'cancelled' 로 로컬 상태를 갱신한다.
   */
  const handleCancel = async (e, bookingId) => {
    e.stopPropagation()
    if (!window.confirm(t('myBookings.confirmCancel'))) return

    setCancellingId(bookingId)
    try {
      // 백엔드 계약: PUT /bookings/:id/cancel (authenticated).
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

  // 카드 요약 줄에 표시할 날짜를 고른다.
  // 호텔은 check_in/check_out, 티켓·패키지는 visit_date, 그도 없으면
  // 예약 생성일(created_at)로 fallback. 모두 snake_case 컬럼이다.
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
