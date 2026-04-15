// ============================================================================
// Home — 랜딩 페이지 (/)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 히어로 배너 + SearchBar 검색 위젯을 보여 준다.
//   - /hotels, /tickets, /packages 세 개 API 를 병렬로 불러와 각각 featured
//     호텔 3개, 인기 티켓 4개, 베스트 패키지 3개 그리드로 렌더한다.
//   - 하단 "Why Choose" 섹션은 정적 4개 카드(아이콘+텍스트).
//
// 렌더 위치: App.jsx 의 / 라우트. lazy-loaded.
//
// 주의:
//   - Promise.allSettled 로 묶어 한 쪽 API 가 실패해도 다른 섹션은 렌더한다.
//   - 백엔드 응답 shape 이 { hotels } / { data } / raw array 세 가지로
//     섞여 들어와 세 단계 fallback 으로 안전 추출한다.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'
import SearchBar from '../components/SearchBar'
import ProductCard from '../components/ProductCard'

const styles = {
  hero: {
    position: 'relative',
    minHeight: '520px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '120px 20px 80px',
    background: 'linear-gradient(135deg, #0d47a1 0%, #1a73e8 40%, #4a90e2 70%, #64b5f6 100%)',
    overflow: 'visible',
  },
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1440 320\'%3E%3Cpath fill=\'%23ffffff\' fill-opacity=\'0.05\' d=\'M0,192L48,186.7C96,181,192,171,288,186.7C384,203,480,245,576,250.7C672,256,768,224,864,213.3C960,203,1056,213,1152,218.7C1248,224,1344,224,1392,224L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z\'/%3E%3C/svg%3E") no-repeat bottom center/cover',
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    maxWidth: '800px',
    marginBottom: '48px',
  },
  heroTitle: {
    fontSize: '3.2rem',
    fontWeight: 800,
    color: '#ffffff',
    marginBottom: '16px',
    letterSpacing: '-1px',
    lineHeight: 1.15,
    textShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  heroSubtitle: {
    fontSize: '1.2rem',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.6,
    maxWidth: '600px',
    margin: '0 auto',
  },
  searchWrapper: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '900px',
  },
  section: {
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: '60px 20px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
  },
  sectionTitle: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  viewAll: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--primary)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'var(--transition)',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
  },
  whySection: {
    background: 'linear-gradient(180deg, var(--bg) 0%, #e8ecf4 100%)',
    padding: '80px 20px',
  },
  whyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
  },
  whyCard: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    padding: '32px 24px',
    textAlign: 'center',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    transition: 'all 0.3s ease',
  },
  whyIcon: {
    fontSize: '2.5rem',
    marginBottom: '16px',
  },
  whyTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '10px',
  },
  whyDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
  },
}

/**
 * 홈 페이지.
 * - 세 종류 상품의 상위 N개를 한번에 보여주는 랜딩.
 * - 부작용: 마운트 시 /hotels, /tickets, /packages 각 한 번씩 fetch.
 */
export default function Home() {
  const { t } = useTranslation()
  const [hotels, setHotels] = useState([])
  const [tickets, setTickets] = useState([])
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)

  // 마운트 시 한 번 세 API 를 병렬로 호출.
  // allSettled 로 감싸 한쪽 API 가 실패해도 나머지 섹션은 계속 보여준다.
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [hotelsRes, ticketsRes, packagesRes] = await Promise.allSettled([
          get('/hotels'),
          get('/tickets'),
          get('/packages'),
        ])
        // 응답 shape 은 { hotels: [...] } / { data: [...] } / [...] 중 하나.
        // 세 가지를 모두 허용해 상위 N개만 잘라 쓴다.
        setHotels((hotelsRes.status === 'fulfilled' ? (hotelsRes.value.hotels || hotelsRes.value.data || hotelsRes.value || []) : []).slice(0, 3))
        setTickets((ticketsRes.status === 'fulfilled' ? (ticketsRes.value.tickets || ticketsRes.value.data || ticketsRes.value || []) : []).slice(0, 4))
        setPackages((packagesRes.status === 'fulfilled' ? (packagesRes.value.packages || packagesRes.value.data || packagesRes.value || []) : []).slice(0, 3))
      } catch (err) {
        console.error('Failed to fetch home data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const features = [
    { icon: '\u{1F3D4}', title: t('home.featureLocation'), desc: t('home.featureLocationDesc') },
    { icon: '\u{26F7}', title: t('home.featureActivities'), desc: t('home.featureActivitiesDesc') },
    { icon: '\u{1F91D}', title: t('home.featureService'), desc: t('home.featureServiceDesc') },
    { icon: '\u{1F4B0}', title: t('home.featureValue'), desc: t('home.featureValueDesc') },
  ]

  return (
    <div>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>{t('home.heroTitle')}</h1>
          <p style={styles.heroSubtitle}>{t('home.heroSubtitle')}</p>
        </div>
        <div style={styles.searchWrapper}>
          <SearchBar />
        </div>
      </div>

      {/* Featured Hotels */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>{t('home.featuredHotels')}</h2>
          <Link
            to="/hotels"
            style={styles.viewAll}
            onMouseEnter={e => { e.target.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.target.style.color = 'var(--primary)' }}
          >
            {t('home.viewAll')} &rarr;
          </Link>
        </div>
        {loading ? (
          <div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div>
        ) : hotels.length > 0 ? (
          <div style={styles.grid3} className="home-grid-3">
            {hotels.map(hotel => (
              <ProductCard key={hotel._id || hotel.id} type="hotel" data={hotel} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">&#127976;</div>
            <p className="empty-state-text">{t('hotel.noHotels')}</p>
          </div>
        )}
      </div>

      {/* Popular Tickets */}
      <div style={{ ...styles.section, background: 'var(--bg)', paddingTop: '20px' }}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>{t('home.popularTickets')}</h2>
          <Link
            to="/tickets"
            style={styles.viewAll}
            onMouseEnter={e => { e.target.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.target.style.color = 'var(--primary)' }}
          >
            {t('home.viewAll')} &rarr;
          </Link>
        </div>
        {loading ? (
          <div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div>
        ) : tickets.length > 0 ? (
          <div style={styles.grid4} className="home-grid-4">
            {tickets.map(ticket => (
              <ProductCard key={ticket._id || ticket.id} type="ticket" data={ticket} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">&#127903;</div>
            <p className="empty-state-text">{t('ticket.noTickets')}</p>
          </div>
        )}
      </div>

      {/* Top Packages */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>{t('home.topPackages')}</h2>
          <Link
            to="/packages"
            style={styles.viewAll}
            onMouseEnter={e => { e.target.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.target.style.color = 'var(--primary)' }}
          >
            {t('home.viewAll')} &rarr;
          </Link>
        </div>
        {loading ? (
          <div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div>
        ) : packages.length > 0 ? (
          <div style={styles.grid3} className="home-grid-3">
            {packages.map(pkg => (
              <ProductCard key={pkg._id || pkg.id} type="package" data={pkg} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">&#127873;</div>
            <p className="empty-state-text">{t('package.noPackages')}</p>
          </div>
        )}
      </div>

      {/* Why Choose High1 */}
      <div style={styles.whySection}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ ...styles.sectionTitle, fontSize: '1.8rem' }}>{t('home.whyChoose')}</h2>
        </div>
        <div style={styles.whyGrid} className="why-grid">
          {features.map((f, i) => (
            <div
              key={i}
              style={styles.whyCard}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
              }}
            >
              <div style={styles.whyIcon}>{f.icon}</div>
              <h3 style={styles.whyTitle}>{f.title}</h3>
              <p style={styles.whyDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .home-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
          .home-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
          .why-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .home-grid-4 { grid-template-columns: 1fr !important; }
          .home-grid-3 { grid-template-columns: 1fr !important; }
          .why-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
