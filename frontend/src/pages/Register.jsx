import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

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
    maxWidth: '480px',
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
    marginBottom: '18px',
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
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  registerBtn: {
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
}

export default function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    nationality: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleInput = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        nationality: form.nationality,
      })
      navigate('/')
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const inputProps = {
    onFocus: e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(26,115,232,0.1)' },
    onBlur: e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' },
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>&#9968;</div>
        <h1 style={styles.title}>{t('auth.register')}</h1>
        <p style={styles.subtitle}>{t('auth.createAccount')}</p>

        {error && <div style={styles.errorMsg}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t('auth.name')} *</label>
            <input
              type="text"
              style={styles.input}
              value={form.name}
              onChange={handleInput('name')}
              required
              placeholder={t('auth.name')}
              {...inputProps}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('auth.email')} *</label>
            <input
              type="email"
              style={styles.input}
              value={form.email}
              onChange={handleInput('email')}
              required
              placeholder="your@email.com"
              {...inputProps}
            />
          </div>

          <div style={styles.row} className="register-row">
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('auth.password')} *</label>
              <input
                type="password"
                style={styles.input}
                value={form.password}
                onChange={handleInput('password')}
                required
                minLength={6}
                placeholder="Min 6 characters"
                {...inputProps}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('auth.confirmPassword')} *</label>
              <input
                type="password"
                style={styles.input}
                value={form.confirmPassword}
                onChange={handleInput('confirmPassword')}
                required
                placeholder={t('auth.confirmPassword')}
                {...inputProps}
              />
            </div>
          </div>

          <div style={styles.row} className="register-row">
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('auth.phone')}</label>
              <input
                type="tel"
                style={styles.input}
                value={form.phone}
                onChange={handleInput('phone')}
                placeholder="+82-xxx-xxxx"
                {...inputProps}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('auth.nationality')}</label>
              <input
                type="text"
                style={styles.input}
                value={form.nationality}
                onChange={handleInput('nationality')}
                placeholder="e.g. Chinese"
                {...inputProps}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              ...styles.registerBtn,
              ...(loading ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
            }}
            disabled={loading}
            onMouseEnter={e => { if (!loading) { e.target.style.background = 'var(--primary-dark)'; e.target.style.boxShadow = '0 4px 12px rgba(26,115,232,0.3)' } }}
            onMouseLeave={e => { e.target.style.background = 'var(--primary)'; e.target.style.boxShadow = 'none' }}
          >
            {loading ? t('common.loading') : t('auth.registerBtn')}
          </button>
        </form>

        <div style={styles.footer}>
          {t('auth.hasAccount')}{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            {t('auth.login')}
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .register-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
