import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from '../utils/api'

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

export default function PackageDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [pkg, setPkg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [startDate, setStartDate] = useState('')

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

  const price = pkg.price || pkg.basePrice || 0
  const includes = pkg.includes || pkg.includedItems || []

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
          <div style={styles.imageArea}>
            <span style={styles.imageIcon}>&#127873;</span>
          </div>

          <h1 style={styles.name}>{pkg.name}</h1>

          <div style={styles.meta}>
            {pkg.duration && (
              <span style={styles.metaItem}>&#128197; {t('package.duration')}: {pkg.duration}</span>
            )}
          </div>

          <p style={styles.description}>{pkg.description}</p>

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
            <span style={styles.priceUnit}>/ {t('package.details')}</span>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('package.startDate')}</label>
            <input
              type="date"
              style={styles.input}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
            />
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
