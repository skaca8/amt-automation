// ============================================================================
// ProductCard — 호텔/티켓/패키지 공용 카드
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - type prop('hotel' | 'ticket' | 'package') 하나로 세 상품 유형의 카드를
//     렌더한다. 이미지, 배지, 제목/설명, 가격, 예약 버튼을 공통 레이아웃으로.
//   - i18n 언어(en/cn)에 따라 name_en/name_cn, description_en/description_cn
//     두 언어 필드 중 적절한 것을 고른다.
//   - 호텔은 roomTypes 배열에서 최저 가격을 뽑아 "부터" 가격으로 보여 준다.
//
// 렌더 위치: Home / HotelList / TicketList / PackageList 등 리스트 페이지.
//
// 주의:
//   - 백엔드 응답 shape 이 과거 camelCase, 현재 snake_case 두 가지를 섞어
//     쓰던 히스토리가 있어, price/basePrice/base_price 등 여러 키를 안전하게
//     fallback 으로 읽는다.
//   - description 은 관리자가 HTML 로 입력한 경우가 있어, 카드에서는 태그를
//     제거한 텍스트만 미리보기로 보여 준다(DOM 파서 사용).
//   - 카드 클릭 → /{type}s/:id 로 navigate. onClick prop 이 주어지면 그걸
//     우선 실행(Home 에서 커스텀 핸들러를 넘길 수 있게).
// ============================================================================

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const gradients = {
  hotel: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  ticket: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  package: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
}

const icons = {
  hotel: '\u{1F3E8}',
  ticket: '\u{1F3BF}',
  package: '\u{1F381}',
}

const styles = {
  card: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
  },
  imageArea: {
    position: 'relative',
    height: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageIcon: {
    fontSize: '3rem',
    opacity: 0.9,
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
  },
  categoryBadge: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: 'rgba(255,255,255,0.9)',
    color: 'var(--text-primary)',
    backdropFilter: 'blur(4px)',
  },
  featuredBadge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: 'rgba(245, 158, 11, 0.95)',
    color: '#fff',
    backdropFilter: 'blur(4px)',
  },
  // 🔒 "Invite only" 배지 스타일. is_restricted=1 상품에 대해 노출.
  // 위치는 좌측 하단이라 category/featured/rating 배지와 겹치지 않는다.
  // 색은 보라 계열 — "잠겨 있음 / 특별" 느낌.
  restrictedBadge: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: 'rgba(124, 58, 237, 0.95)',
    color: '#fff',
    backdropFilter: 'blur(4px)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  ratingBadge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.95)',
    color: '#f59e0b',
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
  },
  body: {
    padding: '18px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '6px',
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  description: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    marginBottom: '14px',
    flex: 1,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
  },
  priceBlock: {
    display: 'flex',
    flexDirection: 'column',
  },
  priceLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  price: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--accent)',
  },
  priceCurrency: {
    fontSize: '0.75rem',
    fontWeight: 500,
    marginRight: '2px',
  },
  priceUnit: {
    fontSize: '0.75rem',
    fontWeight: 400,
    color: 'var(--text-muted)',
    marginLeft: '2px',
  },
  bookBtn: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary)',
    color: 'var(--white)',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
  },
  meta: {
    display: 'flex',
    gap: '12px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  metaItem: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
}

/**
 * 백엔드가 images 를 배열, JSON 문자열, 또는 null 로 돌려줄 수 있어
 * 안전하게 배열로 정규화한다. 잘못된 JSON 이면 빈 배열로 swallow.
 */
function parseImages(images) {
  if (!images) return []
  if (Array.isArray(images)) return images
  if (typeof images === 'string') {
    try { return JSON.parse(images) } catch { return [] }
  }
  return []
}

/**
 * 재사용 가능한 상품 카드.
 *
 * @param {object} props
 * @param {'hotel'|'ticket'|'package'} props.type - 카드 유형
 * @param {object} props.data - 상품 객체(백엔드 응답 그대로)
 * @param {Function} [props.onClick] - 기본 navigate 대신 쓰고 싶을 때 주입
 */
export default function ProductCard({ type = 'hotel', data, onClick }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = i18n.language || 'en'

  // 카드 클릭. 커스텀 onClick 이 없으면 상세 페이지로 이동.
  // URL 패턴은 /hotels/:id, /tickets/:id, /packages/:id.
  const handleClick = () => {
    if (onClick) {
      onClick(data)
    } else {
      navigate(`/${type}s/${data._id || data.id}`)
    }
  }

  // 호텔은 객실 타입별 가격 중 최저가를 "부터(from)" 가격으로 쓴다.
  // 티켓/패키지는 상품 자체에 단일 가격이 있다.
  // 과거 camelCase 필드(basePrice) 와 현재 snake_case(base_price) 둘 다 지원.
  const getPrice = () => {
    if (type === 'hotel') {
      if (data.roomTypes && data.roomTypes.length > 0) {
        const minPrice = Math.min(...data.roomTypes.map(r => r.price || r.basePrice || r.base_price || 0))
        return minPrice
      }
      return data.price || data.basePrice || data.base_price || 0
    }
    return data.price || data.basePrice || data.base_price || 0
  }

  const getPriceUnit = () => {
    if (type === 'hotel') return `/ ${t('common.night')}`
    if (type === 'ticket') return `/ ${t('common.person')}`
    return ''
  }

  // 현재 언어에 맞춰 상품 이름 필드를 선택한다.
  // 우선순위: lang 별 bilingual 필드 → legacy name/title → 'Untitled'.
  const getName = () => {
    if (lang === 'cn' || lang === 'zh') return data.name_cn || data.name_en || data.name || data.title || 'Untitled'
    return data.name_en || data.name || data.title || 'Untitled'
  }

  // 설명도 bilingual 필드 우선. 관리자가 rich HTML 로 입력했을 수 있어,
  // 카드 미리보기에서는 DOM 파서로 태그를 제거한 plain text 만 보여준다.
  const getDescription = () => {
    let desc
    if (lang === 'cn' || lang === 'zh') {
      desc = data.description_cn || data.description_en || data.description || data.shortDescription || ''
    } else {
      desc = data.description_en || data.description || data.shortDescription || ''
    }
    // 카드 미리보기를 위한 HTML 태그 제거.
    if (desc && typeof desc === 'string') {
      const tmp = document.createElement('div')
      tmp.innerHTML = desc
      return tmp.textContent || tmp.innerText || ''
    }
    return desc
  }

  const getRating = () => data.rating || data.stars || null

  const getCategory = () => {
    if (type === 'ticket' && data.category) return data.category
    if (type === 'package') return t('nav.packages')
    return null
  }

  const images = parseImages(data.images)
  const hasImage = images.length > 0
  const firstImage = hasImage ? images[0] : null

  const price = getPrice()

  const imageAreaStyle = hasImage
    ? {
        ...styles.imageArea,
        backgroundImage: `url(${firstImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { ...styles.imageArea, background: gradients[type] || gradients.hotel }

  // Determine where to show featured vs rating badge (both use top-right)
  const isFeatured = data.is_featured
  const rating = type === 'hotel' ? getRating() : null

  return (
    <div
      style={styles.card}
      onClick={handleClick}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      <div style={imageAreaStyle}>
        {!hasImage && <span style={styles.imageIcon}>{icons[type] || icons.hotel}</span>}
        {getCategory() && (
          <span style={styles.categoryBadge}>{getCategory()}</span>
        )}
        {isFeatured && (
          <span style={rating ? { ...styles.featuredBadge, top: 'auto', bottom: '12px', right: '12px' } : styles.featuredBadge}>Featured</span>
        )}
        {type === 'hotel' && rating && (
          <span style={styles.ratingBadge}>
            &#9733; {rating}
          </span>
        )}
        {/* is_restricted=1 상품에 "Invite only" 배지 노출.
            배지만 달고 리스트에는 그대로 노출 — 예약 단계에서 access code
            게이트가 실제 구매를 차단한다. */}
        {data.is_restricted === 1 && (
          <span style={styles.restrictedBadge}>
            {'\u{1F512}'} {t('booking.restrictedBadge')}
          </span>
        )}
      </div>

      <div style={styles.body}>
        <div style={styles.title}>{getName()}</div>
        <div style={styles.description}>{getDescription()}</div>

        {type === 'hotel' && data.address && (
          <div style={styles.meta}>
            <span style={styles.metaItem}>&#128205; {data.address}</span>
          </div>
        )}

        {type === 'ticket' && (
          <div style={styles.meta}>
            {data.duration && (
              <span style={styles.metaItem}>&#9200; {data.duration}</span>
            )}
            {data.location && (
              <span style={styles.metaItem}>&#128205; {data.location}</span>
            )}
          </div>
        )}

        {type === 'package' && data.duration && (
          <div style={styles.meta}>
            <span style={styles.metaItem}>&#128197; {data.duration}</span>
          </div>
        )}

        <div style={styles.footer}>
          <div style={styles.priceBlock}>
            <span style={styles.priceLabel}>{type === 'hotel' ? t('common.from') : t('common.price')}</span>
            <span style={styles.price}>
              <span style={styles.priceCurrency}>{t('common.currency')}</span>
              {price ? price.toLocaleString() : '---'}
              <span style={styles.priceUnit}>{getPriceUnit()}</span>
            </span>
          </div>
          <button
            style={styles.bookBtn}
            onClick={e => {
              e.stopPropagation()
              handleClick()
            }}
            onMouseEnter={e => { e.target.style.background = 'var(--primary-dark)' }}
            onMouseLeave={e => { e.target.style.background = 'var(--primary)' }}
          >
            {type === 'hotel' ? t('hotel.selectRoom') : t('hotel.bookNow')}
          </button>
        </div>
      </div>
    </div>
  )
}
