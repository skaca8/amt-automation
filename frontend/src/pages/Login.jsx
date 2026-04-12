import React, { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import GoogleSignInButton from '../components/GoogleSignInButton'

const styles = {
  page: {
    minHeight: 'calc(100vh - var(--header-height))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(var(--header-height) + 20px) 20px 40px',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    background: 'var(--white)',
    borderRadius: 'var(--radius-lg)',
    padding: '44px 40px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-light)',
  },
  logo: {
    textAlign: 'center',
    marginBottom: '8px',
    fontSize: '2rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textAlign: 'center',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginBottom: '32px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    transition: 'var(--transition)',
  },
  loginBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--primary)',
    color: 'var(--white)',
    fontWeight: 700,
    fontSize: '1rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition)',
    marginTop: '8px',
  },
  errorMsg: {
    color: 'var(--error)',
    fontSize: '0.85rem',
    textAlign: 'center',
    marginBottom: '16px',
    padding: '10px',
    background: 'var(--error-bg)',
    borderRadius: 'var(--radius-sm)',
  },
  footer: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '24px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'var(--border)',
  },
  dividerText: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  orderLookupBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '0.9rem',
    border: '1.5px solid var(--border)',
    cursor: 'pointer',
    transition: 'var(--transition)',
    textDecoration: 'none',
    display: 'block',
    textAlign: 'center',
  },
}

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login, loginWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  // Separate flag so the Google round trip can disable the Google
  // button without also blocking the password form.
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  // Memoized so GoogleSignInButton's effect doesn't re-run on every
  // parent render and re-draw the button, which would reset its
  // internal state.
  const handleGoogleCredential = useCallback(async (credential) => {
    setError(null)
    setGoogleLoading(true)
    try {
      await loginWithGoogle(credential)
      navigate('/')
    } catch (err) {
      setError(err.message || t('common.error'))
    } finally {
      setGoogleLoading(false)
    }
  }, [loginWithGoogle, navigate, t])

  const handleGoogleError = useCallback((err) => {
    setError((err && err.message) || t('common.error'))
  }, [t])

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>&#9968;</div>
        <h1 style={styles.title}>{t('auth.login')}</h1>
        <p style={styles.subtitle}>{t('auth.welcomeBack')}</p>

        {error && <div style={styles.errorMsg}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t('auth.email')}</label>
            <input
              type="email"
              style={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(26,115,232,0.1)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('auth.password')}</label>
            <input
              type="password"
              style={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(26,115,232,0.1)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.loginBtn,
              ...(loading ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
            }}
            disabled={loading}
            onMouseEnter={e => { if (!loading) { e.target.style.background = 'var(--primary-dark)'; e.target.style.boxShadow = '0 4px 12px rgba(26,115,232,0.3)' } }}
            onMouseLeave={e => { e.target.style.background = 'var(--primary)'; e.target.style.boxShadow = 'none' }}
          >
            {loading ? t('common.loading') : t('auth.loginBtn')}
          </button>
        </form>

        {/* Social sign-in. Rendered below the password form so the
            password flow stays the primary action but Google is one
            click away. The button component hides itself with a
            friendly notice when VITE_GOOGLE_CLIENT_ID isn't set. */}
        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>{t('auth.orDivider')}</span>
          <span style={styles.dividerLine} />
        </div>

        <GoogleSignInButton
          onCredential={handleGoogleCredential}
          onError={handleGoogleError}
          disabled={googleLoading || loading}
        />

        <div style={styles.footer}>
          {t('auth.noAccount')}{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            {t('auth.register')}
          </Link>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>{t('auth.orDivider')}</span>
          <span style={styles.dividerLine} />
        </div>

        <Link
          to="/order-lookup"
          style={styles.orderLookupBtn}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.color = 'var(--primary)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-secondary)' }}
        >
          {t('auth.orderLookup')}
        </Link>
      </div>
    </div>
  )
}
