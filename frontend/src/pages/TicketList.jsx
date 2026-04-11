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
  controls: {
    display: 'flex',
    gap: '12px',
    marginBottom: '28px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    background: 'var(--bg)',
    padding: '4px',
    borderRadius: 'var(--radius-sm)',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    background: 'var(--white)',
    color: 'var(--primary)',
    fontWeight: 600,
    boxShadow: 'var(--shadow-sm)',
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    padding: '10px 16px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    background: 'var(--white)',
    transition: 'var(--transition)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
  },
}

const categories = ['all', 'ski', 'activity', 'entertainment', 'wellness']

export default function TicketList() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (activeCategory && activeCategory !== 'all') params.set('category', activeCategory)
        const date = searchParams.get('date')
        if (date) params.set('date', date)
        const query = params.toString() ? `?${params.toString()}` : ''
        const data = await get(`/tickets${query}`)
        setTickets(data.tickets || data.data || data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchTickets()
  }, [activeCategory, searchParams])

  const filtered = tickets.filter(t_item =>
    !searchTerm ||
    (t_item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t_item.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getCategoryLabel = (cat) => {
    if (cat === 'all') return t('ticket.allCategories')
    return t(`ticket.${cat}`)
  }

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
        <h1 style={styles.title}>{t('ticket.title')}</h1>
        <p style={styles.subtitle}>{t('ticket.searchTickets')}</p>
      </div>

      <div style={styles.controls}>
        <div style={styles.tabs}>
          {categories.map(cat => (
            <button
              key={cat}
              style={{
                ...styles.tab,
                ...(activeCategory === cat ? styles.tabActive : {}),
              }}
              onClick={() => setActiveCategory(cat)}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
        <input
          type="text"
          style={styles.searchInput}
          placeholder={t('ticket.searchTickets')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
        />
      </div>

      {filtered.length > 0 ? (
        <div style={styles.grid} className="ticket-grid">
          {filtered.map(ticket => (
            <ProductCard key={ticket._id || ticket.id} type="ticket" data={ticket} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">&#127903;</div>
          <p className="empty-state-title">{t('ticket.noTickets')}</p>
          <p className="empty-state-text">{t('common.noResults')}</p>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .ticket-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px) { .ticket-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
