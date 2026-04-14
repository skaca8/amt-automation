// ============================================================================
// HotelList — 호텔 목록 페이지 (/hotels)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - URL 쿼리(?checkIn, ?checkOut, ?guests)를 그대로 /hotels API 로 전달해
//     해당 기간/인원으로 제공 가능한 호텔을 받아 카드 그리드로 보여 준다.
//   - 추가로 로컬 검색어 필터(name/description)로 클라이언트 사이드 필터링.
//
// 렌더 위치: App.jsx 의 /hotels 라우트. lazy-loaded.
//
// 주의:
//   - useSearchParams 가 바뀌면 자동으로 재fetch. SearchBar 에서 navigate
//     했을 때 그대로 반영된다.
//   - 응답 shape 은 { hotels } / { data } / raw array 세 가지 모두 허용.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'
import ProductCard from '../components/ProductCard'

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
  subtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
  },
  filterBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '28px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    padding: '12px 16px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    transition: 'var(--transition)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
  },
}

/**
 * 호텔 목록 페이지.
 * - URL 쿼리 → 백엔드 fetch → 카드 그리드 렌더.
 * - 부작용: searchParams 변경 시 /hotels 재호출.
 */
export default function HotelList() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // 클라이언트 사이드 인크리멘털 필터(이름/설명 부분일치).
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchHotels = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        const checkIn = searchParams.get('checkIn')
        const checkOut = searchParams.get('checkOut')
        const guests = searchParams.get('guests')
        if (checkIn) params.set('checkIn', checkIn)
        if (checkOut) params.set('checkOut', checkOut)
        if (guests) params.set('guests', guests)
        const query = params.toString() ? `?${params.toString()}` : ''
        const data = await get(`/hotels${query}`)
        setHotels(data.hotels || data.data || data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchHotels()
  }, [searchParams])

  const filtered = hotels.filter(h =>
    !searchTerm || (h.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (h.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div style={styles.page}>
        <div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div>
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
        <h1 style={styles.title}>{t('hotel.title')}</h1>
        <p style={styles.subtitle}>{t('hotel.allHotels')}</p>
      </div>

      <div style={styles.filterBar}>
        <input
          type="text"
          style={styles.searchInput}
          placeholder={t('hotel.searchHotels')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
        />
      </div>

      {filtered.length > 0 ? (
        <div style={styles.grid} className="hotel-grid">
          {filtered.map(hotel => (
            <ProductCard key={hotel._id || hotel.id} type="hotel" data={hotel} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">&#127976;</div>
          <p className="empty-state-title">{t('hotel.noHotels')}</p>
          <p className="empty-state-text">{t('common.noResults')}</p>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .hotel-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px) { .hotel-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
