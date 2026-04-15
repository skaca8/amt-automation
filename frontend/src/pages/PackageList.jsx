// ============================================================================
// PackageList — 패키지 목록 페이지 (/packages)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 마운트 시 /packages 를 한 번 호출해 받아온 목록을 카드 그리드로 보여 준다.
//   - 로컬 검색어 입력으로 name/description 부분일치 필터링.
//
// 렌더 위치: /packages 라우트. lazy-loaded.
// ============================================================================

import React, { useState, useEffect } from 'react'
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
  searchInput: {
    width: '100%',
    maxWidth: '400px',
    padding: '12px 16px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    transition: 'var(--transition)',
    marginBottom: '28px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
  },
}

/**
 * 패키지 목록 페이지.
 * 부작용: 마운트 시 /packages GET 1회.
 */
export default function PackageList() {
  const { t } = useTranslation()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchPackages = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await get('/packages')
        setPackages(data.packages || data.data || data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchPackages()
  }, [])

  const filtered = packages.filter(p =>
    !searchTerm ||
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div style={styles.page}><div className="loading-container"><div className="spinner" /><span className="loading-text">{t('common.loading')}</span></div></div>
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
        <h1 style={styles.title}>{t('package.title')}</h1>
        <p style={styles.subtitle}>{t('package.searchPackages')}</p>
      </div>

      <input
        type="text"
        style={styles.searchInput}
        placeholder={t('package.searchPackages')}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
      />

      {filtered.length > 0 ? (
        <div style={styles.grid} className="package-grid">
          {filtered.map(pkg => (
            <ProductCard key={pkg._id || pkg.id} type="package" data={pkg} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">&#127873;</div>
          <p className="empty-state-title">{t('package.noPackages')}</p>
          <p className="empty-state-text">{t('common.noResults')}</p>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .package-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px) { .package-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
