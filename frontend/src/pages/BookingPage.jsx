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
  // 백엔드 /availability 엔드포인트에서 가져오는 "정식 가격 견적".
  //   - hotel: { total, perNight, nights }  (객실 1개 기준 per-date 합)
  //   - ticket/package: { total, perUnit }  (1매 기준 per-date 가격)
  // 이 값이 세팅되면 calculateTotal 은 이 값을 우선 사용한다. /availability
  // 가 실패하면 null 로 남겨 두고 base_price 기반 fallback 이 화면을 채운다.
  // 실제 결제 금액은 어쨌든 backend 가 POST /bookings 에서 최종 산출한다.
  const [quote, setQuote] = useState(null)

  // URL 쿼리에서 상세 페이지가 넘겨 준 예약 컨텍스트를 꺼낸다.
  // 호텔: checkIn/checkOut/roomType/rooms, 티켓·패키지: date/quantity.
  const checkIn = searchParams.get('checkIn') || ''
  const checkOut = searchParams.get('checkOut') || ''
  const roomTypeId = searchParams.get('roomType') || ''
  const visitDate = searchParams.get('date') || ''
  const quantity = Math.max(1, parseInt(searchParams.get('quantity') || '1', 10) || 1)
  // 호텔 예약용 객실 수. 기존 URL 스킴에서는 'rooms' 파라미터가 넘어오는데,
  // 호환성을 위해 'quantity' 가 넘어온 경우에도 그 값을 객실 수로 간주한다.
  // 백엔드 bookings 테이블의 quantity 컬럼이 호텔에서는 "객실 수" 의미이기
  // 때문이다. 타입 변환이 실패하거나 음수가 들어오면 최소 1 로 정규화.
  const hotelRooms = Math.max(1, parseInt(searchParams.get('rooms') || searchParams.get('quantity') || '1', 10) || 1)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialRequests: '',
    nationality: '',
    // access_code: 구매 게이트 상품(is_restricted=1)에서만 노출되는 필드.
    // 사용자가 복사해 붙여넣은 관리자 발급 코드(형식: 'ACG-XXXXXXXXXXXX').
    // 백엔드가 POST /bookings 트랜잭션 안에서 검증/소비한다.
    accessCode: '',
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
  // 정식 가격 견적 fetch (/availability)
  // --------------------------------------------------------------------------
  //
  // 왜 이 effect 가 필요한가:
  //   backend POST /bookings 는 예약 생성 시 room_inventory / ticket_inventory
  //   / package_inventory 의 per-date `price` 오버라이드를 사용해 최종 금액을
  //   계산한다 (날짜별 성수기/주말 가격 등). 반면 상품 detail 엔드포인트는
  //   정적인 base_price 만 돌려주므로, 그 값만 쓰면 화면에 표시된 총액과
  //   실제 결제 금액이 달라질 수 있다.
  //
  //   그래서 이 effect 가 /availability 를 호출해 "backend 가 청구할 것과
  //   동일한" 단가/총액을 가져와 quote state 에 저장한다. calculateTotal 은
  //   quote 가 있으면 그 값을 그대로 쓰고, 없을 때에만 base_price fallback
  //   으로 화면을 채운다.
  //
  // 실패 처리:
  //   availability 가 404/400 등을 던지면 quote 는 null 로 남기고 fallback
  //   계산으로 표시한다. 최종 청구는 backend 가 POST /bookings 에서
  //   트랜잭션 안에서 재계산하므로 사용자가 결제 전에 비정상 값을 보는
  //   일은 여전히 예외적인 상황에 한정된다.
  useEffect(() => {
    if (!product) return
    // 각 상품 유형별 필수 조건이 채워져야만 availability 를 쿼리한다.
    if (type === 'hotel' && (!checkIn || !checkOut)) { setQuote(null); return }
    if ((type === 'ticket' || type === 'package') && !visitDate) { setQuote(null); return }

    let cancelled = false
    const fetchQuote = async () => {
      try {
        if (type === 'hotel') {
          const qs = new URLSearchParams({ check_in: checkIn, check_out: checkOut }).toString()
          const data = await get(`/hotels/${id}/availability?${qs}`)
          // 응답 shape: { availability: [{ room_type: {...}, dates: [...],
          //              total_price, nights, min_available, is_available }] }
          // 객실 1개 기준의 total_price / nights 가 반환된다. hotelRooms 와
          // 곱해 전체 객실 수 기준 최종 총액을 만든다.
          const list = Array.isArray(data.availability) ? data.availability : []
          const rtAvail =
            list.find(a => String(a.room_type && a.room_type.id) === String(roomTypeId)) ||
            list[0] ||
            null
          if (cancelled) return
          if (!rtAvail) { setQuote(null); return }
          const perRoom = Number(rtAvail.total_price) || 0
          const nights = Number(rtAvail.nights) || 0
          setQuote({
            total: perRoom * hotelRooms,
            perRoom,                                       // 1 객실 기준 전체 박수 합계
            perNight: nights > 0 ? perRoom / nights : 0,   // 객실당 1박 평균 단가
            nights,
          })
        } else if (type === 'ticket') {
          const data = await get(`/tickets/${id}/availability?date=${encodeURIComponent(visitDate)}`)
          // 응답 shape: { ticket: {...}, date, available, price, is_available }
          const unit = Number(data.price) || 0
          if (cancelled) return
          setQuote({ total: unit * quantity, perUnit: unit })
        } else if (type === 'package') {
          const data = await get(`/packages/${id}/availability?date=${encodeURIComponent(visitDate)}`)
          const unit = Number(data.price) || 0
          if (cancelled) return
          setQuote({ total: unit * quantity, perUnit: unit })
        }
      } catch (err) {
        // availability 엔드포인트가 실패해도 페이지 전체를 깨지 않는다.
        // 사용자는 base_price 기반 fallback 총액을 보게 되고, 실제 결제는
        // backend 가 POST /bookings 시점에 다시 계산한다.
        if (!cancelled) setQuote(null)
        console.error('Failed to fetch price quote from /availability:', err)
      }
    }
    fetchQuote()
    return () => { cancelled = true }
  }, [product, type, id, checkIn, checkOut, visitDate, roomTypeId, quantity, hotelRooms])

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
   *
   * 우선순위:
   *   1. quote.total (backend /availability 에서 받은 정식 합계) — 있으면 무조건 이것.
   *   2. base_price 기반 fallback — availability 가 아직 로드되지 않았거나
   *      해당 상품에 availability 가 없는 예외적 상황용.
   *
   * fallback 규칙:
   *   - 호텔: roomPrice × nights × hotelRooms
   *   - 티켓/패키지: base_price × quantity
   *   - 그 외: base_price 그대로
   *
   * ※ fallback 은 per-date inventory 가격 오버라이드를 반영하지 못하므로
   *   정확하지 않다. 실제 결제 금액은 backend 가 POST /bookings 의
   *   트랜잭션 안에서 재계산하므로 최종 청구액은 항상 올바르다.
   */
  const calculateTotal = () => {
    if (quote && typeof quote.total === 'number') return quote.total

    if (!product) return 0

    if (type === 'hotel') {
      const room = getSelectedRoom()
      const roomPrice = room ? readBasePrice(room) : readBasePrice(product)

      if (checkIn && checkOut) {
        // 체크인/아웃 차이를 일수로 환산. Math.ceil 로 부분일도 1박 처리.
        const nights = Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)))
        // 객실 수(hotelRooms) 곱셈을 반드시 포함 — backend 도 qty 로 곱한다.
        return roomPrice * nights * hotelRooms
      }
      return roomPrice * hotelRooms
    }

    if (type === 'ticket' || type === 'package') {
      return readBasePrice(product) * quantity
    }

    return readBasePrice(product)
  }

  /**
   * 1박당 객실 단가(표시용). quote 가 있으면 quote.perNight 를 그대로 쓰고,
   * 없으면 정적 base_price 로 fallback. Summary 카드의 "Room Rate" 행에서 사용.
   */
  const getPerNightRate = () => {
    if (quote && typeof quote.perNight === 'number' && quote.perNight > 0) return quote.perNight
    const room = getSelectedRoom()
    return room ? readBasePrice(room) : readBasePrice(product)
  }

  /**
   * 티켓/패키지의 1매당 단가(표시용). quote 가 있으면 quote.perUnit,
   * 없으면 상품의 base_price.
   */
  const getPerUnitPrice = () => {
    if (quote && typeof quote.perUnit === 'number' && quote.perUnit > 0) return quote.perUnit
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
    // restricted 상품이면 access_code 가 반드시 있어야 하고 로그인 필수.
    // 서버가 최종 판정을 하지만, 여기서 미리 막아 네트워크 왕복 없이
    // 사용자에게 즉시 피드백을 준다.
    if (product && product.is_restricted === 1) {
      if (!isAuthenticated) {
        setSubmitError(t('booking.restrictedLoginRequired'))
        return
      }
      if (!form.accessCode || !form.accessCode.trim()) {
        setSubmitError(t('booking.accessCodeRequired'))
        return
      }
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

      // access_code: 상품이 is_restricted=1 이면 반드시 포함.
      // backend 가 POST /bookings 트랜잭션 안에서 검증/소비한다.
      // 비어 있으면 서버가 403 "required" 로 응답한다.
      // 비-restricted 상품에 대해 코드가 와도 서버가 silent ignore 하므로
      // 사용자 입력이 남아 있다면 일단 같이 보내도 안전하다.
      if (form.accessCode) {
        bookingData.access_code = form.accessCode.trim()
      }

      // 상품 유형별 추가 필드. 호텔은 체크인/아웃/객실/객실수, 티켓·패키지는 날짜/수량.
      if (type === 'hotel') {
        bookingData.check_in = checkIn
        bookingData.check_out = checkOut
        if (roomTypeId) bookingData.room_type_id = Number(roomTypeId)
        // ★ 핵심 수정: 호텔에도 quantity(=객실 수)를 반드시 실어 보낸다.
        //   이전에는 이 필드가 빠져 backend 가 항상 qty=1 로 가정하고
        //   1박 × 1객실만 과금하던 버그가 있었다. bookings 테이블의
        //   quantity 컬럼은 호텔에서 "객실 수" 의미이며, 총액 계산식은
        //   POST /bookings 에서 `totalPrice += nightPrice * qty` 로
        //   매 night 에 곱해진다.
        bookingData.quantity = hotelRooms
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

            {/* ----------------------------------------------------------
                 구매 게이트 블록 (is_restricted=1 상품에서만 렌더)
               ---------------------------------------------------------
               product.is_restricted 가 truthy 일 때만 노출된다. 분기는
               세 가지:

                 1) 비-restricted 상품  → 렌더되지 않음 (기존 동작 그대로)
                 2) restricted + 비로그인 → 노란 배너 + 로그인 유도 메시지
                                            (코드는 유저 identity 에 묶여
                                             있어 비로그인 예약은 원천 차단)
                 3) restricted + 로그인   → Access Code 입력 필드 노출
               ---------------------------------------------------------- */}
            {product && product.is_restricted === 1 && (
              <div style={styles.formGroup}>
                {!isAuthenticated ? (
                  <div
                    // 경고 배너 — 로그인 필요 안내. 색은 warn 톤.
                    style={{
                      padding: '12px 14px',
                      border: '1px solid #f59e0b',
                      background: '#fffbeb',
                      color: '#92400e',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {'\u{1F512}'} {t('booking.restrictedLoginRequired')}
                  </div>
                ) : (
                  <>
                    <label style={styles.label}>
                      {'\u{1F512}'} {t('booking.accessCode')} *
                    </label>
                    <input
                      type="text"
                      style={styles.input}
                      value={form.accessCode}
                      onChange={handleInput('accessCode')}
                      required
                      placeholder="ACG-XXXXXXXXXXXX"
                      // uppercase + 양끝 공백 제거는 제출 직전에 한 번 더
                      // 한다. 여기서는 입력 UX 방해 없이 원본 그대로 둔다.
                      onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                      onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                    />
                    <p style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}>
                      {t('booking.accessCodeHelp')}
                    </p>
                  </>
                )}
              </div>
            )}

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
                {/* 객실 수 표시. 1개일 때도 줄을 노출해 사용자가 "내가 지금
                    몇 개 방을 잡고 있는지" 를 즉시 인지할 수 있게 한다. */}
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('hotel.rooms')}</span>
                  <span style={styles.summaryValue}>
                    {hotelRooms} {hotelRooms === 1 ? t('common.room') : t('common.rooms')}
                  </span>
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
                    {/* 가능한 경우 /availability 에서 받은 per-date 단가(quote.perUnit)를
                        사용하고, 없으면 상품의 base_price 로 fallback.
                        통화 기호는 i18n 키(common.currencySymbol)에서 읽어
                        언어별 표기(₩/¥/$)를 바꿀 수 있게 한다. */}
                    {t('common.currencySymbol')}{getPerUnitPrice().toLocaleString()} / {t('common.person')}
                  </span>
                </div>
                {quantity > 1 && (
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>
                      {'\u00D7'} {quantity} {t('common.persons')}
                    </span>
                    <span style={styles.summaryValue}>{t('common.currencySymbol')}{total.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {type === 'hotel' && checkIn && checkOut && (
              <div style={{ marginBottom: 8 }}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>{t('booking.roomRate')}</span>
                  <span style={styles.summaryValue}>
                    {/* 1박당 객실 단가는 가능한 경우 quote.perNight (per-date 평균)
                        를 쓰고, 없을 때만 정적 base_price 로 fallback.
                        통화 기호는 i18n 로 분리해 locale 별 커스터마이즈를 허용. */}
                    {t('common.currencySymbol')}{Math.round(getPerNightRate()).toLocaleString()}{' '}
                    / {t('hotel.perNight')}
                  </span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>
                    {/* N박 × M객실 전체 곱셈을 사용자에게 명시적으로 드러낸다.
                        "1박 × 1객실" 케이스에서도 혼란을 줄이기 위해 동일 포맷. */}
                    {getNights()} {getNights() > 1 ? t('common.nights') : t('common.night')}
                    {' \u00D7 '}
                    {hotelRooms} {hotelRooms === 1 ? t('common.room') : t('common.rooms')}
                  </span>
                  <span style={styles.summaryValue}>{t('common.currencySymbol')}{total.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>{t('booking.grandTotal')}</span>
              <span style={styles.totalAmount}>{t('common.currencySymbol')}{total.toLocaleString()}</span>
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
