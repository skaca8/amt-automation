// ============================================================================
// BookingPage — 예약 입력 페이지 (/booking/:type/:id)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - URL 파라미터 :type('hotel'|'ticket'|'package') 과 :id, 그리고 상세
//     페이지에서 넘어온 쿼리(checkIn/checkOut/roomType/date/quantity)를
//     읽어 해당 상품을 fetch 한다.
//   - 호텔 응답은 { hotel, room_types } 형태이므로 room_types 를 hotel
//     객체로 평탄화해 이후 코드가 한 군데만 보면 되도록 정규화한다.
//   - 고객 정보 입력 폼(이름/이메일/전화/국적/특이사항)을 받고 요약 카드
//     에 상품/날짜/인원/총액을 실시간 표시한다.
//   - 제출 시 백엔드 스펙에 맞춘 snake_case payload 를 POST /bookings 로
//     전송하고, 성공하면 confirmation 페이지로 guest_email 과 함께 이동.
//
// 렌더 위치: /booking/:type/:id 라우트. lazy-loaded.
//
// 주의:
//   - 백엔드(bookings.js)는 strict snake_case 계약이다(e504ce7 정합화).
//     product_type, product_id, guest_name, guest_email, check_in, check_out,
//     room_type_id, visit_date, quantity, special_requests — 한 필드라도
//     camelCase 로 보내면 즉시 400.
//   - sql.js 백엔드는 정수 id 만 쓰므로 result.booking?.id 또는 result.id
//     둘 다 허용한다. '_id' 는 없다.
//   - 로그인 상태가 아니어도 예약을 받을 수 있다. 그래서 confirmation URL
//     에 guest_email 을 쿼리로 넘겨 ownership 검증에 쓰도록 한다.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { get, post } from '../utils/api'

/**
 * 백엔드 상품 객체에서 언어별 필드를 골라 읽는 헬퍼.
 *
 * API 는 bilingual 필드를 `<field>_en` / `<field>_cn` 로 저장한다.
 * cn 사용자라도 해당 행에 _cn 번역이 비어 있으면 영어로 fallback 해서
 * 최소한 내용이 빈 칸이 되지 않도록 한다.
 */
function pickLocalized(obj, field, lang) {
  if (!obj) return ''
  const key = `${field}_${lang === 'cn' ? 'cn' : 'en'}`
  return obj[key] || obj[`${field}_en`] || obj[field] || ''
}

/**
 * 상품/객실 객체에서 기준 가격을 꺼낸다.
 * 백엔드 스키마는 hotels/tickets/packages/room_types 모두 `base_price` 를
 * 정식 컬럼으로 쓰지만, 과거 응답 혼재를 위해 price / basePrice 도 fallback.
 */
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

/**
 * 예약 입력 페이지.
 *
 * 내부 state:
 *   - product     : 현재 예약 대상 상품(호텔/티켓/패키지)
 *   - submitting  : 제출 중(더블클릭 방지/버튼 비활성화)
 *   - submitError : 서버가 돌려준 에러 메시지
 *   - form        : 이름/이메일/전화/국적/특이사항 입력값
 *
 * 부작용:
 *   - 마운트 시 상품 fetch
 *   - 로그인 상태면 user 정보로 form prefill
 *   - 제출 시 POST /bookings, 성공하면 confirmation 페이지로 navigate
 */
export default function BookingPage() {
  const { type, id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  // 활성 i18n locale 을 'cn' | 'en' 두 값으로 정규화해 pickLocalized() 가
  // 올바른 `_en` / `_cn` 컬럼을 고를 수 있게 한다.
  const lang = i18n.language && i18n.language.startsWith('zh') ? 'cn' : (i18n.language || 'en')
  const { user, isAuthenticated } = useAuth()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // URL 쿼리에서 상세 페이지가 넘겨 준 예약 컨텍스트를 꺼낸다.
  // 호텔: checkIn/checkOut/roomType, 티켓·패키지: date/quantity.
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

  // 로그인된 사용자면 프로필 정보로 폼을 미리 채워 준다.
  // 타이핑 중에 auth 정보가 덮어쓰지 않도록 빈 값일 때만 세팅.
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

  // --------------------------------------------------------------------------
  // 상품 fetch + 응답 정규화
  // --------------------------------------------------------------------------
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
        // 호텔 상세는 `{ hotel, room_types }` 로 내려오므로 room_types 를
        // hotel 객체 안으로 병합해 아래 요약/합계 계산 로직이 한 군데만
        // 들여다보면 되게 한다. 티켓/패키지는 { ticket } / { package }
        // 단일 wrapper 객체를 돌려준다.
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

  // --------------------------------------------------------------------------
  // 파생 값 계산 헬퍼
  // --------------------------------------------------------------------------

  /**
   * URL 의 roomTypeId 에 해당하는 room_type 객체를 호텔 내부 배열에서 찾는다.
   * URL 파라미터는 항상 문자열이지만 백엔드 id 는 정수이므로 String()
   * 으로 양쪽을 맞춘 뒤 비교한다.
   */
  const getSelectedRoom = () => {
    if (!product) return null
    const roomTypes = product.room_types || []
    if (roomTypeId) {
      return roomTypes.find(r => String(r.id) === String(roomTypeId)) || null
    }
    return roomTypes[0] || null
  }

  /**
   * 총액 계산.
   * - 호텔: 선택된 객실 단가 × 박수.
   * - 티켓/패키지: 단가 × quantity.
   * - 그 외: 단가 하나 그대로.
   */
  const calculateTotal = () => {
    if (!product) return 0

    if (type === 'hotel') {
      const room = getSelectedRoom()
      const roomPrice = room ? readBasePrice(room) : readBasePrice(product)

      if (checkIn && checkOut) {
        // 체크인/아웃 차이를 일수로 환산. Math.ceil 로 부분일도 1박 처리.
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

  /** 선택된 체크인/아웃 기반 박 수(최소 1). 요약 카드에서 표시용. */
  const getNights = () => {
    if (checkIn && checkOut) {
      return Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)))
    }
    return 1
  }

  /**
   * 선택된 객실 타입의 현재 locale 이름.
   * roomTypeId 가 없으면 빈 문자열(요약 카드에서 객실 줄을 숨기기 위함).
   */
  const getRoomTypeName = () => {
    const room = roomTypeId ? getSelectedRoom() : null
    if (!room) return ''
    return pickLocalized(room, 'name', lang)
  }

  // --------------------------------------------------------------------------
  // 폼 제출 → POST /bookings
  // --------------------------------------------------------------------------
  /**
   * 예약 폼 제출.
   *
   * 백엔드 계약(backend/src/routes/bookings.js POST /) 은 strict snake_case
   * 이다. 과거에 camelCase 로 보냈다가 DB 작업 전에 400 이 떨어지던 버그를
   * e504ce7 커밋에서 정합화했다. 이 payload 구성은 해당 라우트 핸들러와
   * 1:1 로 맞춰야 한다.
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone) {
      setSubmitError(t('booking.requiredFieldsMissing'))
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      // 공통 필드. 모든 상품 유형에 필요하다.
      const bookingData = {
        product_type: type,
        product_id: Number(id),
        guest_name: form.name,
        guest_email: form.email,
        guest_phone: form.phone,
        special_requests: form.specialRequests || null,
      }

      // 상품 유형별 추가 필드. 호텔은 체크인/아웃/객실, 티켓·패키지는 날짜/수량.
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
      // sql.js 는 정수 id 를 `id` 키로만 돌려준다. '_id' 는 없다.
      // 응답 shape 차이에 대비해 result.booking?.id 와 result.id 둘 다 본다.
      const bookingId = result.booking?.id || result.id
      if (!bookingId) throw new Error('Booking created but response was missing id')
      // 비로그인 고객도 예약 직후 confirmation 페이지에서 내역을 다시 조회해야
      // 한다. 백엔드의 ownership 체크는 비로그인 상태에서 guest_email 쿼리를
      // 소유 증명으로 받아 주므로, email 을 URL 에 싣고 이동한다.
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
