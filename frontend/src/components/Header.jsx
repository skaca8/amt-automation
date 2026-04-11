import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

const styles = {
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 'var(--header-height)',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border-light)',
    zIndex: 1000,
    transition: 'var(--transition)',
  },
  headerScrolled: {
    boxShadow: 'var(--shadow-md)',
  },
  container: {
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: '0 20px',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    flexShrink: 0,
  },
  logoIcon: {
    fontSize: '1.6rem',
    lineHeight: 1,
  },
  logoText: {
    fontSize: '1.15rem',
    fontWeight: 800,
    letterSpacing: '-0.5px',
    background: 'linear-gradient(135deg, #0d47a1, #1a73e8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  navLink: {
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
  },
  navLinkActive: {
    color: 'var(--primary)',
    background: 'rgba(26, 115, 232, 0.08)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  langToggle: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
  },
  userBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--primary)',
    background: 'rgba(26, 115, 232, 0.08)',
    cursor: 'pointer',
    transition: 'var(--transition)',
    textDecoration: 'none',
    border: 'none',
    whiteSpace: 'nowrap',
  },
  loginBtn: {
    padding: '8px 20px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--white)',
    background: 'var(--primary)',
    textDecoration: 'none',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
  },
  hamburger: {
    display: 'none',
    flexDirection: 'column',
    gap: '5px',
    padding: '8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  hamburgerLine: {
    width: '22px',
    height: '2px',
    background: 'var(--text-primary)',
    borderRadius: '2px',
    transition: 'var(--transition)',
  },
  mobileMenu: {
    position: 'fixed',
    top: 'var(--header-height)',
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--white)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 999,
    overflowY: 'auto',
    animation: 'fadeIn 0.2s ease',
  },
  mobileNavLink: {
    display: 'block',
    padding: '14px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    textDecoration: 'none',
    transition: 'var(--transition)',
  },
  mobileDivider: {
    height: '1px',
    background: 'var(--border)',
    margin: '8px 0',
  },
  dropdown: {
    position: 'relative',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    background: 'var(--white)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-light)',
    padding: '8px',
    minWidth: '180px',
    zIndex: 1001,
    animation: 'fadeIn 0.15s ease',
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    textDecoration: 'none',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
}

export default function Header() {
  const { t, i18n } = useTranslation()
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setUserMenuOpen(false)
  }, [location])

  const toggleLang = () => {
    const newLang = i18n.language === 'en' ? 'cn' : 'en'
    i18n.changeLanguage(newLang)
    localStorage.setItem('language', newLang)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const navLinks = [
    { path: '/', label: t('nav.home') },
    { path: '/hotels', label: t('nav.hotels') },
    { path: '/tickets', label: t('nav.tickets') },
    { path: '/packages', label: t('nav.packages') },
  ]

  return (
    <>
      <header style={{
        ...styles.header,
        ...(scrolled ? styles.headerScrolled : {}),
      }}>
        <div style={styles.container}>
          <Link to="/" style={styles.logo}>
            <span style={styles.logoIcon}>&#9968;</span>
            <span style={styles.logoText}>HIGH1 RESORT</span>
          </Link>

          {/* Desktop Navigation */}
          <nav style={styles.nav} className="desktop-nav">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  ...styles.navLink,
                  ...(isActive(link.path) ? styles.navLinkActive : {}),
                }}
                onMouseEnter={e => {
                  if (!isActive(link.path)) {
                    e.target.style.color = 'var(--primary)'
                    e.target.style.background = 'rgba(26, 115, 232, 0.05)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive(link.path)) {
                    e.target.style.color = 'var(--text-secondary)'
                    e.target.style.background = 'transparent'
                  }
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div style={styles.actions} className="desktop-actions">
            <button
              style={styles.langToggle}
              onClick={toggleLang}
              onMouseEnter={e => {
                e.target.style.borderColor = 'var(--primary)'
                e.target.style.color = 'var(--primary)'
              }}
              onMouseLeave={e => {
                e.target.style.borderColor = 'var(--border)'
                e.target.style.color = 'var(--text-secondary)'
              }}
            >
              {i18n.language === 'en' ? '中文' : 'EN'}
            </button>

            <Link
              to="/my-bookings"
              style={{
                ...styles.navLink,
                fontSize: '0.85rem',
              }}
              onMouseEnter={e => {
                e.target.style.color = 'var(--primary)'
              }}
              onMouseLeave={e => {
                if (!isActive('/my-bookings')) {
                  e.target.style.color = 'var(--text-secondary)'
                }
              }}
            >
              {t('nav.myBookings')}
            </Link>

            {isAuthenticated ? (
              <div style={styles.dropdown}>
                <button
                  style={styles.userBtn}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(26, 115, 232, 0.12)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(26, 115, 232, 0.08)'
                  }}
                >
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                    {(user?.name || 'U').charAt(0).toUpperCase()}
                  </span>
                  {user?.name?.split(' ')[0] || t('nav.profile')}
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div style={styles.dropdownMenu}>
                      <Link
                        to="/profile"
                        style={styles.dropdownItem}
                        onMouseEnter={e => { e.target.style.background = 'var(--bg)' }}
                        onMouseLeave={e => { e.target.style.background = 'none' }}
                      >
                        {t('nav.profile')}
                      </Link>
                      <Link
                        to="/my-bookings"
                        style={styles.dropdownItem}
                        onMouseEnter={e => { e.target.style.background = 'var(--bg)' }}
                        onMouseLeave={e => { e.target.style.background = 'none' }}
                      >
                        {t('nav.myBookings')}
                      </Link>
                      <div style={styles.mobileDivider} />
                      <button
                        style={{ ...styles.dropdownItem, color: 'var(--error)' }}
                        onClick={handleLogout}
                        onMouseEnter={e => { e.target.style.background = 'var(--error-bg)' }}
                        onMouseLeave={e => { e.target.style.background = 'none' }}
                      >
                        {t('nav.logout')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                style={styles.loginBtn}
                onMouseEnter={e => {
                  e.target.style.background = 'var(--primary-dark)'
                  e.target.style.boxShadow = '0 4px 12px rgba(26, 115, 232, 0.3)'
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'var(--primary)'
                  e.target.style.boxShadow = 'none'
                }}
              >
                {t('nav.login')}
              </Link>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            style={styles.hamburger}
            className="mobile-hamburger"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <span style={{
              ...styles.hamburgerLine,
              transform: mobileOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none',
            }} />
            <span style={{
              ...styles.hamburgerLine,
              opacity: mobileOpen ? 0 : 1,
            }} />
            <span style={{
              ...styles.hamburgerLine,
              transform: mobileOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none',
            }} />
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div style={styles.mobileMenu} className="mobile-menu-overlay">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              style={{
                ...styles.mobileNavLink,
                ...(isActive(link.path) ? { color: 'var(--primary)', background: 'rgba(26, 115, 232, 0.08)' } : {}),
              }}
            >
              {link.label}
            </Link>
          ))}
          <div style={styles.mobileDivider} />
          <Link to="/my-bookings" style={styles.mobileNavLink}>{t('nav.myBookings')}</Link>
          <Link to="/order-lookup" style={styles.mobileNavLink}>{t('nav.orderLookup')}</Link>
          <div style={styles.mobileDivider} />
          <button
            style={{ ...styles.mobileNavLink, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', fontSize: '1rem' }}
            onClick={toggleLang}
          >
            {i18n.language === 'en' ? '切换至中文' : 'Switch to English'}
          </button>
          <div style={styles.mobileDivider} />
          {isAuthenticated ? (
            <>
              <Link to="/profile" style={styles.mobileNavLink}>{t('nav.profile')}</Link>
              <button
                style={{ ...styles.mobileNavLink, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--error)', fontFamily: 'inherit', fontSize: '1rem' }}
                onClick={handleLogout}
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ ...styles.mobileNavLink, color: 'var(--primary)', fontWeight: 600 }}>{t('nav.login')}</Link>
              <Link to="/register" style={{ ...styles.mobileNavLink, color: 'var(--accent)', fontWeight: 600 }}>{t('nav.register')}</Link>
            </>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .desktop-actions { display: none !important; }
          .mobile-hamburger { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-hamburger { display: none !important; }
        }
      `}</style>
    </>
  )
}
