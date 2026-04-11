import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const styles = {
  wrapper: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    maxWidth: '900px',
    margin: '0 auto',
  },
  tabs: {
    display: 'flex',
    borderBottom: '2px solid var(--border-light)',
  },
  tab: {
    flex: 1,
    padding: '16px 20px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    position: 'relative',
    textAlign: 'center',
  },
  tabActive: {
    color: 'var(--primary)',
    background: 'rgba(26, 115, 232, 0.04)',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: '-2px',
    left: 0,
    right: 0,
    height: '2px',
    background: 'var(--primary)',
  },
  form: {
    padding: '24px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  field: {
    flex: 1,
    minWidth: '150px',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    background: 'var(--bg)',
    transition: 'var(--transition)',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    background: 'var(--bg)',
    transition: 'var(--transition)',
    appearance: 'none',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234a4a6a' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: '36px',
  },
  searchBtn: {
    padding: '12px 32px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent)',
    color: 'var(--white)',
    fontWeight: 700,
    fontSize: '0.95rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
}

export default function SearchBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('hotels')

  const [hotelSearch, setHotelSearch] = useState({
    checkIn: '',
    checkOut: '',
    guests: '2',
  })

  const [ticketSearch, setTicketSearch] = useState({
    category: '',
    date: '',
  })

  const [packageSearch, setPackageSearch] = useState({
    date: '',
  })

  const tabs = [
    { key: 'hotels', label: t('nav.hotels') },
    { key: 'tickets', label: t('nav.tickets') },
    { key: 'packages', label: t('nav.packages') },
  ]

  const handleSearch = (e) => {
    e.preventDefault()
    if (activeTab === 'hotels') {
      const params = new URLSearchParams()
      if (hotelSearch.checkIn) params.set('checkIn', hotelSearch.checkIn)
      if (hotelSearch.checkOut) params.set('checkOut', hotelSearch.checkOut)
      if (hotelSearch.guests) params.set('guests', hotelSearch.guests)
      navigate(`/hotels?${params.toString()}`)
    } else if (activeTab === 'tickets') {
      const params = new URLSearchParams()
      if (ticketSearch.category) params.set('category', ticketSearch.category)
      if (ticketSearch.date) params.set('date', ticketSearch.date)
      navigate(`/tickets?${params.toString()}`)
    } else {
      const params = new URLSearchParams()
      if (packageSearch.date) params.set('date', packageSearch.date)
      navigate(`/packages?${params.toString()}`)
    }
  }

  return (
    <div style={styles.wrapper} className="search-bar">
      <div style={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {activeTab === tab.key && <span style={styles.tabIndicator} />}
          </button>
        ))}
      </div>

      <form style={styles.form} onSubmit={handleSearch}>
        {activeTab === 'hotels' && (
          <div style={styles.row} className="search-row">
            <div style={styles.field}>
              <label style={styles.label}>{t('hotel.checkIn')}</label>
              <input
                type="date"
                style={styles.input}
                value={hotelSearch.checkIn}
                onChange={e => setHotelSearch(s => ({ ...s, checkIn: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>{t('hotel.checkOut')}</label>
              <input
                type="date"
                style={styles.input}
                value={hotelSearch.checkOut}
                onChange={e => setHotelSearch(s => ({ ...s, checkOut: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>
            <div style={{ ...styles.field, maxWidth: '120px', minWidth: '100px' }}>
              <label style={styles.label}>{t('hotel.guests')}</label>
              <select
                style={styles.select}
                value={hotelSearch.guests}
                onChange={e => setHotelSearch(s => ({ ...s, guests: e.target.value }))}
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? t('common.person') : t('common.persons')}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              style={styles.searchBtn}
              onMouseEnter={e => { e.target.style.background = 'var(--accent-dark)'; e.target.style.boxShadow = '0 4px 12px rgba(255,111,0,0.3)' }}
              onMouseLeave={e => { e.target.style.background = 'var(--accent)'; e.target.style.boxShadow = 'none' }}
            >
              {t('common.search')}
            </button>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div style={styles.row} className="search-row">
            <div style={styles.field}>
              <label style={styles.label}>{t('ticket.category')}</label>
              <select
                style={styles.select}
                value={ticketSearch.category}
                onChange={e => setTicketSearch(s => ({ ...s, category: e.target.value }))}
              >
                <option value="">{t('ticket.allCategories')}</option>
                <option value="ski">{t('ticket.ski')}</option>
                <option value="activity">{t('ticket.activity')}</option>
                <option value="entertainment">{t('ticket.entertainment')}</option>
                <option value="wellness">{t('ticket.wellness')}</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>{t('ticket.selectDate')}</label>
              <input
                type="date"
                style={styles.input}
                value={ticketSearch.date}
                onChange={e => setTicketSearch(s => ({ ...s, date: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>
            <button
              type="submit"
              style={styles.searchBtn}
              onMouseEnter={e => { e.target.style.background = 'var(--accent-dark)'; e.target.style.boxShadow = '0 4px 12px rgba(255,111,0,0.3)' }}
              onMouseLeave={e => { e.target.style.background = 'var(--accent)'; e.target.style.boxShadow = 'none' }}
            >
              {t('common.search')}
            </button>
          </div>
        )}

        {activeTab === 'packages' && (
          <div style={styles.row} className="search-row">
            <div style={styles.field}>
              <label style={styles.label}>{t('package.startDate')}</label>
              <input
                type="date"
                style={styles.input}
                value={packageSearch.date}
                onChange={e => setPackageSearch(s => ({ ...s, date: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
              />
            </div>
            <button
              type="submit"
              style={styles.searchBtn}
              onMouseEnter={e => { e.target.style.background = 'var(--accent-dark)'; e.target.style.boxShadow = '0 4px 12px rgba(255,111,0,0.3)' }}
              onMouseLeave={e => { e.target.style.background = 'var(--accent)'; e.target.style.boxShadow = 'none' }}
            >
              {t('common.search')}
            </button>
          </div>
        )}
      </form>

      <style>{`
        @media (max-width: 600px) {
          .search-row {
            flex-direction: column !important;
          }
          .search-row > div {
            min-width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}
