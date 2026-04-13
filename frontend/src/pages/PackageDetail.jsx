// ============================================================================
// PackageDetail — 패키지 상세 페이지 (/packages/:id)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - /packages/:id 에서 패키지 1건을 받아 히어로 이미지/이름/설명/기간 정보를
//     렌더하고, 포함 사항(includes) 체크 리스트를 보여준다.
//   - 사이드바에서 시작 날짜 + 인원 수를 고르면 단가×인원 Total 을 계산해
//     실시간 반영한다.
//   - "Book Now" → /booking/package/:id?date=..&quantity=.. navigate.
//
// 렌더 위치: /packages/:id 라우트. lazy-loaded.
//
// 주의:
//   - TicketDetail 과 거의 쌍둥이 구조(수량 UI, 가격 계산, navigate).
//   - includes 필드는 string 배열이거나 {name, description} 객체 배열로
//     올 수 있어 둘 다 렌더 가능하게 분기한다.
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
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
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
  description: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
    marginBottom: '32px',
  },
  includesSection: {
    marginBottom: '32px',
  },
  includesTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '16px',
  },
  includesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  includeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    padding: '10px 14px',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-sm)',
  },
  includeCheck: {
    color: 'var(--success)',
    fontWeight: 700,
    fontSize: '1rem',
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
    marginTop: '16px',
  },
}

/** images 를 배열로 정규화(배열/JSON 문자열/null). */
function parseImages(images) {
  if (!images) return []
  if (Array.isArray(images)) return images
  if (typeof images === 'string') {
    try { return JSON.parse(images) } catch { return [] }
  }
  return []
}

/**
 * 패키지 상세 페이지.
 *
 * 내부 state:
 *   - pkg       : 패키지 본체
 *   - startDate : 시작일 ('YYYY-MM-DD')
 *   - quantity  : 인원 수 (1~20)
 *   - heroIdx   : 히어로 썸네일 인덱스
 *
 * 부작용: 마운트 시 /packages/:id GET, "Book Now" 시 navigate.
 */
export default function PackageDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'en'
  const [pkg, setPkg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [heroIdx, setHeroIdx] = useState(0)

  useEffect(() => {
    const fetchPackage = async () => {
      setLoading(true)
      try {
        const data = await get(`/packages/${id}`)
        setPkg(data.package || data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchPackage()
  }, [id])

  const handleBook = () => {
    const params = new URLSearchParams()
    if (startDate) params.set('date', startDate)
    params.set('quantity', quantity.toString())
    navigate(`/booking/package/${id}?${params.toString()}`)
  }

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
  }

  if (error || !pkg) {
    return (
      <div style={styles.page}>
        <div className="error-container">
          <div className="error-icon">&#9888;</div>
          <p className="error-message">{error || 'Package not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/packages')}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  const price = pkg.price || pkg.basePrice || pkg.base_price || 0
  const includes = pkg.includes || pkg.includedItems || []
  const pkgImages = parseImages(pkg.images)
  const pkgName = (lang === 'cn' || lang === 'zh') ? (pkg.name_cn || pkg.name_en || pkg.name) : (pkg.name_en || pkg.name)
  const pkgDesc = (lang === 'cn' || lang === 'zh') ? (pkg.description_cn || pkg.description_en || pkg.description) : (pkg.description_en || pkg.description)
  const isHtmlDesc = pkgDesc && typeof pkgDesc === 'string' && /<[a-z][\s\S]*>/i.test(pkgDesc)

  return (
    <div style={styles.page}>
      <button
        style={styles.backBtn}
        onClick={() => navigate('/packages')}
        onMouseEnter={e => { e.target.style.color = 'var(--primary)' }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-secondary)' }}
      >
        &larr; {t('common.back')}
      </button>

      <div style={styles.layout} className="package-detail-layout">
        <div>
          {pkgImages.length > 0 ? (
            <div style={{ marginBottom: '28px' }}>
              <div style={{
                ...styles.imageArea,
                backgroundImage: `url(${pkgImages[heroIdx]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }} />
              {pkgImages.length > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                  {pkgImages.map((img, i) => (
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
              <span style={styles.imageIcon}>&#127873;</span>
            </div>
          )}

          <h1 style={styles.name}>{pkgName}</h1>

          <div style={styles.meta}>
            {pkg.duration && (
              <span style={styles.metaItem}>&#128197; {t('package.duration')}: {pkg.duration}</span>
            )}
          </div>

          {isHtmlDesc ? (
            <div style={styles.description} dangerouslySetInnerHTML={{ __html: pkgDesc }} />
          ) : (
            <p style={styles.description}>{pkgDesc || ''}</p>
          )}

          {includes.length > 0 && (
            <div style={styles.includesSection}>
              <h2 style={styles.includesTitle}>{t('package.whatsIncluded')}</h2>
              <div style={styles.includesList}>
                {includes.map((item, i) => (
                  <div key={i} style={styles.includeItem}>
                    <span style={styles.includeCheck}>&#10003;</span>
                    <span>{typeof item === 'string' ? item : item.name || item.description || JSON.stringify(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={styles.bookingCard}>
          <div style={styles.priceDisplay}>
            <span style={styles.priceAmount}>
              <span style={styles.priceCurrency}>{t('common.currency')}</span>
              {price.toLocaleString()}
            </span>
            <span style={styles.priceUnit}>/ person</span>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('package.startDate')}</label>
            <SingleDatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="Select start date"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Number of Persons</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '1.5px solid #e2e8f0', background: '#fff',
                  fontSize: '1.2rem', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
                }}
              >-</button>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, minWidth: 30, textAlign: 'center' }}>
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(q => Math.min(20, q + 1))}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: '1.5px solid #e2e8f0', background: '#fff',
                  fontSize: '1.2rem', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
                }}
              >+</button>
            </div>
          </div>

          <div style={{
            background: '#f8fafc', borderRadius: 12, padding: 20,
            border: '1px solid #e2e8f0', marginTop: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem', color: '#475569' }}>
              <span>Unit Price</span>
              <span>{'\u20A9'}{price.toLocaleString()} / person</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem', color: '#475569' }}>
              <span>Quantity</span>
              <span>{'\u00D7'} {quantity}</span>
            </div>
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 12, marginTop: 8,
              display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
              <span>Total</span>
              <span style={{ color: '#1a73e8' }}>{'\u20A9'}{(price * quantity).toLocaleString()}</span>
            </div>
          </div>

          <button
            style={{
              ...styles.bookBtn,
              ...(!startDate ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
            }}
            onClick={handleBook}
            disabled={!startDate}
            onMouseEnter={e => { if (startDate) { e.target.style.background = 'var(--accent-dark)'; e.target.style.boxShadow = '0 4px 12px rgba(255,111,0,0.3)' } }}
            onMouseLeave={e => { e.target.style.background = 'var(--accent)'; e.target.style.boxShadow = 'none' }}
          >
            {t('package.bookNow')}
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .package-detail-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
