import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '../utils/api'

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 24,
  },
  card: {
    background: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #f1f5f9',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  cardHeader: {
    padding: '24px 24px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.6rem',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#1e293b',
  },
  cardSubtitle: {
    fontSize: '0.85rem',
    color: '#64748b',
    marginTop: 2,
  },
  cardBody: {
    padding: '0 24px 24px',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderTop: '1px solid #f1f5f9',
  },
  statLabel: {
    fontSize: '0.85rem',
    color: '#64748b',
  },
  statValue: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#1e293b',
  },
  cardFooter: {
    padding: '12px 24px',
    background: '#f8fafc',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  link: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#3b82f6',
  },
}

export default function ProductManagement() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ hotels: 0, tickets: 0, packages: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const res = await get('/admin/products/stats').catch(() => null)
      if (res) {
        setStats({
          hotels: res.hotels || res.hotelCount || 0,
          tickets: res.tickets || res.ticketCount || 0,
          packages: res.packages || res.packageCount || 0,
          activeHotels: res.activeHotels || 0,
          activeTickets: res.activeTickets || 0,
          activePackages: res.activePackages || 0,
          totalRooms: res.totalRooms || 0,
        })
      }
    } catch {
      // Stats may not be available
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    {
      title: 'Hotels',
      subtitle: 'Manage hotel properties and room types',
      icon: '\ud83c\udfe8',
      iconBg: '#dbeafe',
      path: '/products/hotels',
      count: stats.hotels,
      active: stats.activeHotels,
      extra: stats.totalRooms ? `${stats.totalRooms} room types` : null,
    },
    {
      title: 'Tickets',
      subtitle: 'Manage ski passes and activity tickets',
      icon: '\ud83c\udfbf',
      iconBg: '#dcfce7',
      path: '/products/tickets',
      count: stats.tickets,
      active: stats.activeTickets,
      extra: null,
    },
    {
      title: 'Packages',
      subtitle: 'Manage bundled packages and deals',
      icon: '\ud83c\udf81',
      iconBg: '#fef3c7',
      path: '/products/packages',
      count: stats.packages,
      active: stats.activePackages,
      extra: null,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Product Management</h1>
          <p>Manage hotels, tickets, and packages</p>
        </div>
      </div>

      <div style={styles.grid}>
        {cards.map((card) => (
          <div
            key={card.title}
            style={styles.card}
            onClick={() => navigate(card.path)}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={styles.cardHeader}>
              <div style={{ ...styles.icon, background: card.iconBg }}>
                {card.icon}
              </div>
              <div>
                <div style={styles.cardTitle}>{card.title}</div>
                <div style={styles.cardSubtitle}>{card.subtitle}</div>
              </div>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Total</span>
                <span style={styles.statValue}>
                  {loading ? '...' : card.count}
                </span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statLabel}>Active</span>
                <span style={styles.statValue}>
                  {loading ? '...' : (card.active || card.count)}
                </span>
              </div>
              {card.extra && (
                <div style={styles.stat}>
                  <span style={styles.statLabel}>Details</span>
                  <span style={styles.statValue}>{card.extra}</span>
                </div>
              )}
            </div>
            <div style={styles.cardFooter}>
              <span style={styles.link}>Manage {card.title} {'\u2192'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
