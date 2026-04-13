// ============================================================================
// TicketDetail — 티켓 상세 페이지 (/tickets/:id)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - /tickets/:id 에서 티켓 1건을 받아 히어로 이미지, 카테고리 배지, 설명,
//     메타(기간/장소)를 렌더한다.
//   - 사이드바에 "방문 날짜 + 수량" 선택 UI 를 두고, 단가×수량을 실시간으로
//     Total 에 반영한다.
//   - "Book Now" 를 누르면 /booking/ticket/:id?date=..&quantity=.. 로 이동.
//
// 렌더 위치: /tickets/:id 라우트. lazy-loaded.
//
// 주의:
//   - 가격 필드는 price / basePrice / base_price 세 가지 위치를 모두 읽어
//     백엔드 응답 변천사에 대응한다.
//   - description 은 HTML 여부를 감지해 dangerouslySetInnerHTML 로 렌더.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'
import SingleDatePicker from '../components/SingleDatePicker'

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
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '40px',
    alignItems: 'start',
  },
  imageArea: {
    width: '100%',
    height: '360px',
    borderRadius: 'var(--radius-lg)',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '28px',
  },
  imageIcon: {
    fontSize: '5rem',
    opacity: 0.8,
  },
  name: {
    fontSize: '1.8rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  meta: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  categoryBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: 'rgba(26, 115, 232, 0.1)',
    color: 'var(--primary)',
    marginBottom: '16px',
  },
  description: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
    marginBottom: '24px',
  },
  bookingCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '28px',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-light)',
    position: 'sticky',
    top: 'calc(var(--header-height) + 32px)',
  },
  priceDisplay: {
    textAlign: 'center',
    marginBottom: '24px',
    padding: '16px',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-sm)',
  },
  priceAmount: {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  priceCurrency: {
    fontSize: '1rem',
    fontWeight: 500,
    marginRight: '4px',
  },
  priceUnit: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    display: 'block',
    marginTop: '4px',
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
  quantityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  quantityBtn: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--border)',
    background: 'var(--white)',
    fontSize: '1.2rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition)',
  },
  quantityDisplay: {
    fontSize: '1.2rem',
    fontWeight: 600,
    minWidth: '40px',
    textAlign: 'center',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0',
    borderTop: '1px solid var(--border)',
    marginTop: '16px',
    marginBottom: '20px',
  },
  totalLabel: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  totalAmount: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  bookBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent)',
    color: 'var(--white)',
    fontWeight: 700,
    fontSize: '1rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
}

/** images 를 배열로 정규화(배열/JSON 문자열/null 모두 허용). */
function parseImages(images) {
  if (!images) return []
  if (Array.isArray(images)) return images
  if (typeof images === 'string') {
    try { return JSON.parse(images) } catch { return [] }
  }
  return []
}

/**
 * 티켓 상세 페이지.
 *
 * 내부 state:
 *   - ticket    : 티켓 본체
 *   - visitDate : 방문 희망일('YYYY-MM-DD')
 *   - quantity  : 구매 수량(1~20)
 *   - heroIdx   : 히어로 썸네일 인덱스
 *
 * 부작용: 마운트 시 /tickets/:id GET, "Book Now" 시 navigate.
 */
export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [visitDate, setVisitDate] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [heroIdx, setHeroIdx] = useState(0)

  useEffect(() => {
    const fetchTicket = async () => {
      setLoading(true)
      try {
        const data = await get(`/tickets/${id}`)
        setTicket(data.ticket || data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchTicket()
  }, [id])

  // 방문일/수량을 쿼리 파라미터로 넘기며 예약 페이지로 이동.
  // BookingPage 가 type='ticket' 분기에서 이 값을 읽어 초기 상태로 세팅한다.
  const handleBook = () => {
    const params = new URLSearchParams()
    if (visitDate) params.set('date', visitDate)
    params.set('quantity', quantity.toString())
    navigate(`/booking/ticket/${id}?${params.toString()}`)
  }

  const price = ticket?.price || ticket?.basePrice || ticket?.base_price || 0
  const total = price * quantity
  const ticketImages = parseImages(ticket?.images)
  const ticketName = (lang === 'cn' || lang === 'zh') ? (ticket?.name_cn || ticket?.name_en || ticket?.name) : (ticket?.name_en || ticket?.name)
  const ticketDesc = (lang === 'cn' || lang === 'zh') ? (ticket?.description_cn || ticket?.description_en || ticket?.description) : (ticket?.description_en || ticket?.description)
  const isHtmlDesc = ticketDesc && typeof ticketDesc === 'string' && /<[a-z][\s\S]*>/i.test(ticketDesc)

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (error || !ticket) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error || 'Ticket not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/tickets')}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <button
        style={styles.backBtn}
        onClick={() => navigate('/tickets')}
        onMouseEnter={e => { e.target.style.color = 'var(--primary)' }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-secondary)' }}
      >
        &larr; {t('common.back')}
      </button>

      <div style={styles.layout} className="ticket-detail-layout">
        <div>
          {ticketImages.length > 0 ? (
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                ...styles.imageArea,
                backgroundImage: `url(${ticketImages[heroIdx]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }} />
              {ticketImages.length > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                  {ticketImages.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setHeroIdx(i)}
                      style={{
                        width: 64, height: 44, borderRadius: 6, cursor: 'pointer',
                        border: i === heroIdx ? '2px solid var(--primary)' : '2px solid transparent',
                        backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center',
                        opacity: i === heroIdx ? 1 : 0.6, transition: 'all 0.2s ease',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.imageArea}>
              <span style={styles.imageIcon}>&#127903;</span>
            </div>
          )}

          {ticket.category && (
            <span style={styles.categoryBadge}>{ticket.category}</span>
          )}
          {/* is_restricted=1 티켓은 상단에 inline "Invite only" 배지 노출.
              예약 페이지에서 access_code 입력 필드가 나타난다. */}
          {ticket.is_restricted === 1 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 20,
              background: 'rgba(124, 58, 237, 0.1)',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              color: '#6d28d9',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginLeft: 8,
            }}>
              {'\u{1F512}'} {t('booking.restrictedBadge')}
            </div>
          )}

          <h1 style={styles.name}>{ticketName}</h1>

          <div style={styles.meta}>
            {ticket.duration && (
              <span style={styles.metaItem}>&#9200; {t('ticket.duration')}: {ticket.duration}</span>
            )}
            {ticket.location && (
              <span style={styles.metaItem}>&#128205; {t('ticket.location')}: {ticket.location}</span>
            )}
          </div>

          {isHtmlDesc ? (
            <div style={styles.description} dangerouslySetInnerHTML={{ __html: ticketDesc }} />
          ) : (
            <p style={styles.description}>{ticketDesc || ''}</p>
          )}
        </div>

        <div style={styles.bookingCard}>
          <div style={styles.priceDisplay}>
            <span style={styles.priceAmount}>
              <span style={styles.priceCurrency}>{t('common.currency')}</span>
              {price.toLocaleString()}
            </span>
            <span style={styles.priceUnit}>/ {t('common.person')}</span>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('ticket.visitDate')}</label>
            <SingleDatePicker
              value={visitDate}
              onChange={setVisitDate}
              placeholder="Select visit date"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('ticket.quantity')}</label>
            <div style={styles.quantityRow}>
              <button
                style={styles.quantityBtn}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.color = 'var(--primary)' }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-primary)' }}
              >-</button>
              <span style={styles.quantityDisplay}>{quantity}</span>
              <button
                style={styles.quantityBtn}
                onClick={() => setQuantity(Math.min(20, quantity + 1))}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.color = 'var(--primary)' }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-primary)' }}
              >+</button>
            </div>
          </div>

          <div style={{
            background: '#f8fafc', borderRadius: 12, padding: 20,
            border: '1px solid #e2e8f0', marginTop: 16, marginBottom: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem', color: '#475569' }}>
              <span>Unit Price</span>
              {/* 통화 기호는 i18n 키로 분리 (common.currencySymbol). */}
              <span>{t('common.currencySymbol')}{price.toLocaleString()} / person</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem', color: '#475569' }}>
              <span>Quantity</span>
              <span>{'\u00D7'} {quantity}</span>
            </div>
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 12, marginTop: 8,
              display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
              <span>Total</span>
              <span style={{ color: '#1a73e8' }}>{t('common.currencySymbol')}{total.toLocaleString()}</span>
            </div>
          </div>

          <button
            style={styles.bookBtn}
            onClick={handleBook}
            disabled={!visitDate}
            onMouseEnter={e => { if (visitDate) { e.target.style.background = 'var(--accent-dark)'; e.target.style.boxShadow = '0 4px 12px rgba(255,111,0,0.3)' } }}
            onMouseLeave={e => { e.target.style.background = 'var(--accent)'; e.target.style.boxShadow = 'none' }}
          >
            {t('ticket.bookNow')}
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .ticket-detail-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
