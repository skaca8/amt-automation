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

export default function HotelList() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
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
