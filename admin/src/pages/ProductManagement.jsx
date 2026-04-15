// ============================================================================
// Admin — 상품 관리 엔트리 ProductManagement
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) "상품" 카테고리(Hotels / Tickets / Packages) 세 가지 중 어디로 들어갈지
//      고르는 랜딩 카드 그리드 페이지이다.
//   2) 각 카드에는 해당 카테고리의 총 개수 / 활성 수 / (호텔의 경우) 총 객실 수
//      를 요약으로 보여 준다.
//   3) 카드 클릭 시 useNavigate 로 해당 상세 관리 페이지로 이동한다.
//
// 렌더링 위치: /products 라우트. 사이드바 "Products → Overview" 링크.
//
// 주의:
//   - /admin/products/stats 엔드포인트가 아직 구현 전일 수 있어 실패 시
//     조용히 빈 값으로 둔다(카드는 '...' 로 표시 후 0 으로 전환).
// ============================================================================

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

/**
 * ProductManagement — 상품 카테고리 랜딩 카드.
 *
 * 부작용: GET /admin/products/stats, navigate() 이동.
 */
export default function ProductManagement() {
  const navigate = useNavigate()
  // stats : 카드에 띄울 요약 숫자. loading 중엔 '...' 표시.
  const [stats, setStats] = useState({ hotels: 0, tickets: 0, packages: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  // 여러 이름의 응답 키를 허용한다(프로젝트 초기/중기/현재 버전이 섞여 있어).
  const loadStats = async () => {
    setLoading(true)
    try {
      const res = await get('/admin/products/stats').catch(() => null)
      if (res) {
        setStats({
          hotels: res.hotels || res.hotel_count || res.hotelCount || 0,
          tickets: res.tickets || res.ticket_count || res.ticketCount || 0,
          packages: res.packages || res.package_count || res.packageCount || 0,
          activeHotels: res.active_hotels || res.activeHotels || 0,
          activeTickets: res.active_tickets || res.activeTickets || 0,
          activePackages: res.active_packages || res.activePackages || 0,
          totalRooms: res.total_rooms || res.totalRooms || 0,
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
