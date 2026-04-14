// ============================================================================
// Admin — 좌측 고정 Sidebar 네비게이션
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 어드민의 고정 좌측 메뉴를 렌더링. 각 메뉴 항목은 NavLink 로 구현되어
//      현재 URL 과 매칭되면 활성 스타일이 붙는다.
//   2) "Products" 항목은 자식 메뉴를 가진 접이식(accordion) 그룹이다.
//   3) 하단에 로그인된 사용자 정보와 로그아웃 버튼을 표시한다.
//   4) 1024px 이하(tablet) 에서는 햄버거 버튼 + 오버레이로 열고 닫는다.
//
// 렌더링 위치: App.jsx → AdminLayout 안에서 한 번만 mount 된다.
// 페이지 간 이동 시 unmount 되지 않으므로 expandedItems / mobileOpen 등 로컬
// state 가 유지된다.
//
// 주의:
//   - styles 객체는 의도적으로 JS 안에 인라인으로 선언되어 있다. 키 순서·값을
//     리팩토링하지 말 것(시각적 회귀가 쉽게 생긴다).
//   - mobile 미디어쿼리는 스타일드 컴포넌트가 아니라 하단 <style> 태그에서
//     처리한다. "display: none !important" 를 이길 수 있도록 class-based 규칙.
// ============================================================================

import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// 네비게이션 항목 정의. children 이 있으면 접이식 그룹으로 렌더된다.
// icon 은 이모지 유니코드(\ud83d\udcca 등)로 컴파일 타임 상수로 유지한다.
const navItems = [
  { path: '/', icon: '\ud83d\udcca', label: 'Dashboard', exact: true },
  { path: '/bookings', icon: '\ud83d\udccb', label: 'Bookings' },
  {
    icon: '\ud83c\udfe8',
    label: 'Products',
    children: [
      { path: '/products', label: 'Overview', exact: true },
      { path: '/products/hotels', label: 'Hotels' },
      { path: '/products/tickets', label: 'Tickets' },
      { path: '/products/packages', label: 'Packages' },
    ],
  },
  { path: '/users', icon: '\ud83d\udc65', label: 'Users' },
  { path: '/payments', icon: '\ud83d\udcb3', label: 'Payments' },
  // Access Codes — "특정 유저 × 특정 상품" 에 대한 구매 게이트 코드 발급/관리.
  // 아이콘 🎟️ (U+1F39F) 는 티켓 느낌. 상품 게이트 이미지로 자연스럽다.
  { path: '/access-codes', icon: '\ud83c\udf9f\ufe0f', label: 'Access Codes' },
  { path: '/settings', icon: '\u2699\ufe0f', label: 'Settings' },
]

const styles = {
  overlay: {
    display: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 99,
  },
  overlayVisible: {
    display: 'block',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 260,
    background: '#1e293b',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    transition: 'transform 0.3s ease',
    overflowY: 'auto',
  },
  logo: {
    padding: '24px 20px',
    borderBottom: '1px solid #334155',
  },
  logoTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '0.05em',
  },
  logoSubtitle: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    marginTop: 2,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  nav: {
    flex: 1,
    padding: '12px 0',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 20px',
    color: '#94a3b8',
    fontSize: '0.9rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    textDecoration: 'none',
  },
  navItemHover: {
    color: '#e2e8f0',
    background: '#334155',
  },
  navItemActive: {
    color: '#ffffff',
    background: '#334155',
    borderLeftColor: '#3b82f6',
  },
  navIcon: {
    fontSize: '1.1rem',
    width: 24,
    textAlign: 'center',
    flexShrink: 0,
  },
  parentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 20px',
    color: '#94a3b8',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'all 0.2s ease',
    userSelect: 'none',
    width: '100%',
    border: 'none',
    background: 'none',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  chevron: {
    marginLeft: 'auto',
    fontSize: '0.7rem',
    transition: 'transform 0.2s ease',
  },
  subNav: {
    overflow: 'hidden',
    transition: 'max-height 0.3s ease',
  },
  subNavItem: {
    display: 'block',
    padding: '8px 20px 8px 56px',
    color: '#94a3b8',
    fontSize: '0.85rem',
    fontWeight: 400,
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    borderLeft: '3px solid transparent',
  },
  subNavItemActive: {
    color: '#ffffff',
    background: '#334155',
    borderLeftColor: '#3b82f6',
  },
  userSection: {
    padding: '16px 20px',
    borderTop: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#e2e8f0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '1.1rem',
    padding: 4,
    borderRadius: 4,
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  hamburger: {
    display: 'none',
    position: 'fixed',
    top: 12,
    left: 12,
    zIndex: 101,
    background: '#1e293b',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    width: 40,
    height: 40,
    fontSize: '1.25rem',
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
}

/**
 * Sidebar — 어드민 좌측 네비게이션 바.
 *
 * Props: 없음. useAuth() 로 사용자 정보를 구독하고, useLocation() 으로
 * 현재 경로를 읽어 활성 상태를 결정한다.
 *
 * 렌더링하는 UI:
 *   - 모바일용 햄버거 버튼 (md 이상에서는 CSS 로 숨김)
 *   - aside 사이드바: 로고 / nav / 사용자 섹션(이름·로그아웃)
 *
 * 부작용:
 *   - logout() 호출 시 AuthContext 상태 초기화 → ProtectedRoute 가
 *     /login 으로 리다이렉트.
 */
export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState(['Products'])
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleExpand = (label) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    )
  }

  const closeMobile = () => setMobileOpen(false)

  const isPathActive = (path, exact) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'A'

  return (
    <>
      <button
        style={styles.hamburger}
        className="sidebar-hamburger"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? '\u2715' : '\u2630'}
      </button>

      {mobileOpen && (
        <div
          style={{ ...styles.overlay, ...styles.overlayVisible }}
          onClick={closeMobile}
        />
      )}

      <aside
        style={{
          ...styles.sidebar,
          ...(mobileOpen ? {} : {}),
        }}
        className={`admin-sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
      >
        <div style={styles.logo}>
          <div style={styles.logoTitle}>HIGH1 ADMIN</div>
          <div style={styles.logoSubtitle}>Resort Management</div>
        </div>

        <nav style={styles.nav}>
          {navItems.map((item) => {
            if (item.children) {
              const isExpanded = expandedItems.includes(item.label)
              const isChildActive = item.children.some((c) =>
                isPathActive(c.path, c.exact)
              )

              return (
                <div key={item.label}>
                  <button
                    style={{
                      ...styles.parentItem,
                      ...(isChildActive ? { color: '#e2e8f0' } : {}),
                    }}
                    onClick={() => toggleExpand(item.label)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#e2e8f0'
                      e.currentTarget.style.background = '#334155'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = isChildActive
                        ? '#e2e8f0'
                        : '#94a3b8'
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span style={styles.navIcon}>{item.icon}</span>
                    <span>{item.label}</span>
                    <span
                      style={{
                        ...styles.chevron,
                        transform: isExpanded
                          ? 'rotate(90deg)'
                          : 'rotate(0deg)',
                      }}
                    >
                      {'\u25B6'}
                    </span>
                  </button>
                  <div
                    style={{
                      ...styles.subNav,
                      maxHeight: isExpanded ? 200 : 0,
                    }}
                  >
                    {item.children.map((child) => {
                      const active = isPathActive(child.path, child.exact)
                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          end={child.exact}
                          onClick={closeMobile}
                          style={
                            active
                              ? { ...styles.subNavItem, ...styles.subNavItemActive }
                              : styles.subNavItem
                          }
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.color = '#e2e8f0'
                              e.currentTarget.style.background = '#334155'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.color = '#94a3b8'
                              e.currentTarget.style.background = 'transparent'
                            }
                          }}
                        >
                          {child.label}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              )
            }

            const active = isPathActive(item.path, item.exact)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                onClick={closeMobile}
                style={
                  active
                    ? { ...styles.navItem, ...styles.navItemActive }
                    : styles.navItem
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#e2e8f0'
                    e.currentTarget.style.background = '#334155'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#94a3b8'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div style={styles.userSection}>
          <div style={styles.avatar}>{initials}</div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.name || 'Admin'}</div>
            <div style={styles.userRole}>Administrator</div>
          </div>
          <button
            style={styles.logoutBtn}
            onClick={logout}
            title="Logout"
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            {'\u23FB'}
          </button>
        </div>
      </aside>

      <style>{`
        @media (max-width: 1024px) {
          .admin-sidebar {
            transform: translateX(-100%);
          }
          .admin-sidebar.sidebar-open {
            transform: translateX(0);
          }
          .sidebar-hamburger {
            display: flex !important;
          }
        }
      `}</style>
    </>
  )
}
