import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const styles = {
  footer: {
    background: 'linear-gradient(180deg, #0d1b2a, #1b2838)',
    color: '#c0c8d4',
    padding: '60px 0 0',
    marginTop: 'auto',
  },
  container: {
    maxWidth: 'var(--max-width)',
    margin: '0 auto',
    padding: '0 20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '40px',
    paddingBottom: '40px',
  },
  brand: {
    gridColumn: 'span 1',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  logoIcon: {
    fontSize: '1.5rem',
  },
  logoText: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.5px',
  },
  description: {
    fontSize: '0.85rem',
    lineHeight: 1.7,
    color: '#8a96a6',
    marginBottom: '20px',
  },
  socialLinks: {
    display: 'flex',
    gap: '12px',
  },
  socialLink: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8a96a6',
    fontSize: '0.85rem',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  columnTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '20px',
  },
  linkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  link: {
    fontSize: '0.9rem',
    color: '#8a96a6',
    textDecoration: 'none',
    transition: 'color 0.2s ease',
  },
  contactItem: {
    fontSize: '0.85rem',
    color: '#8a96a6',
    lineHeight: 1.7,
    display: 'flex',
    gap: '8px',
  },
  contactIcon: {
    flexShrink: 0,
    width: '16px',
    textAlign: 'center',
  },
  bottom: {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '20px 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  copyright: {
    fontSize: '0.8rem',
    color: '#5a6474',
  },
  bottomLinks: {
    display: 'flex',
    gap: '24px',
  },
  bottomLink: {
    fontSize: '0.8rem',
    color: '#5a6474',
    textDecoration: 'none',
    transition: 'color 0.2s ease',
  },
}

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <div style={styles.grid} className="footer-grid">
          {/* Brand */}
          <div style={styles.brand} className="footer-brand">
            <div style={styles.logo}>
              <span style={styles.logoIcon}>&#9968;</span>
              <span style={styles.logoText}>HIGH1 RESORT</span>
            </div>
            <p style={styles.description}>{t('footer.description')}</p>
            <div style={styles.socialLinks}>
              <span
                style={styles.socialLink}
                onMouseEnter={e => { e.target.style.background = 'var(--primary)'; e.target.style.color = '#fff' }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = '#8a96a6' }}
                title="Facebook"
              >f</span>
              <span
                style={styles.socialLink}
                onMouseEnter={e => { e.target.style.background = 'var(--primary)'; e.target.style.color = '#fff' }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = '#8a96a6' }}
                title="Instagram"
              >in</span>
              <span
                style={styles.socialLink}
                onMouseEnter={e => { e.target.style.background = 'var(--primary)'; e.target.style.color = '#fff' }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = '#8a96a6' }}
                title="YouTube"
              >yt</span>
              <span
                style={styles.socialLink}
                onMouseEnter={e => { e.target.style.background = 'var(--primary)'; e.target.style.color = '#fff' }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = '#8a96a6' }}
                title="WeChat"
              >wx</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={styles.columnTitle}>Explore</h4>
            <div style={styles.linkList}>
              <Link
                to="/hotels"
                style={styles.link}
                onMouseEnter={e => { e.target.style.color = '#ffffff' }}
                onMouseLeave={e => { e.target.style.color = '#8a96a6' }}
              >{t('nav.hotels')}</Link>
              <Link
                to="/tickets"
                style={styles.link}
                onMouseEnter={e => { e.target.style.color = '#ffffff' }}
                onMouseLeave={e => { e.target.style.color = '#8a96a6' }}
              >{t('nav.tickets')}</Link>
              <Link
                to="/packages"
                style={styles.link}
                onMouseEnter={e => { e.target.style.color = '#ffffff' }}
                onMouseLeave={e => { e.target.style.color = '#8a96a6' }}
              >{t('nav.packages')}</Link>
              <Link
                to="/my-bookings"
                style={styles.link}
                onMouseEnter={e => { e.target.style.color = '#ffffff' }}
                onMouseLeave={e => { e.target.style.color = '#8a96a6' }}
              >{t('nav.myBookings')}</Link>
              <Link
                to="/order-lookup"
                style={styles.link}
                onMouseEnter={e => { e.target.style.color = '#ffffff' }}
                onMouseLeave={e => { e.target.style.color = '#8a96a6' }}
              >{t('nav.orderLookup')}</Link>
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 style={styles.columnTitle}>Support</h4>
            <div style={styles.linkList}>
              <span style={styles.link}>{t('footer.about')}</span>
              <span style={styles.link}>{t('footer.faq')}</span>
              <span style={styles.link}>{t('footer.contact')}</span>
              <span style={styles.link}>{t('footer.terms')}</span>
              <span style={styles.link}>{t('footer.privacy')}</span>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 style={styles.columnTitle}>{t('footer.contact')}</h4>
            <div style={styles.linkList}>
              <div style={styles.contactItem}>
                <span style={styles.contactIcon}>&#128205;</span>
                <span>{t('footer.address')}</span>
              </div>
              <div style={styles.contactItem}>
                <span style={styles.contactIcon}>&#9742;</span>
                <span>{t('footer.phone')}</span>
              </div>
              <div style={styles.contactItem}>
                <span style={styles.contactIcon}>&#9993;</span>
                <span>{t('footer.emailContact')}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.bottom}>
          <span style={styles.copyright}>
            &copy; 2024-2026 {t('footer.copyright')}
          </span>
          <div style={styles.bottomLinks}>
            <span style={styles.bottomLink}>{t('footer.terms')}</span>
            <span style={styles.bottomLink}>{t('footer.privacy')}</span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .footer-brand {
            grid-column: span 1 !important;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .footer-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .footer-brand {
            grid-column: span 2 !important;
          }
        }
      `}</style>
    </footer>
  )
}
