// ============================================================================
// Login — 로그인 페이지 (/login)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 이메일+비밀번호 폼으로 AuthContext.login 호출 후 성공 시 홈으로 이동.
//   - 아래에 Google Sign-In 버튼을 배치해 Google credential 을
//     AuthContext.loginWithGoogle 로 교환한다.
//   - 하단에 비회원용 "주문 조회"(/order-lookup) 링크 제공.
//
// 렌더 위치: /login. lazy-loaded.
//
// 주의:
//   - GoogleSignInButton 에 넘기는 콜백은 반드시 useCallback 으로 감싼다.
//     버튼 내부 useEffect 가 credentail 콜백 참조가 바뀔 때마다 재렌더되면
//     GIS 버튼이 깜빡이며 클릭 상태가 리셋된다(c06b286 설계).
//   - googleLoading 과 loading 은 분리해서 둔다. Google 요청 중에도 비밀번호
//     폼은 계속 쓸 수 있도록 의도적으로 독립 관리.
// ============================================================================

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

/**
 * 로그인 페이지.
 *
 * 내부 state:
 *   - email/password : 폼 입력
 *   - loading        : password flow 전송 중
 *   - googleLoading  : google flow 전송 중(두 flow 가 서로 독립)
 *   - error          : 공유 에러 배너 메시지
 *
 * 부작용: login() 또는 loginWithGoogle() 성공 시 navigate('/')
 */
export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login, loginWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  // Google 왕복 중에도 Google 버튼만 disable 하고 비밀번호 폼은 자유로워야
  // 하므로 플래그를 분리한다.
  const [googleLoading, setGoogleLoading] = useState(false)

  // 비밀번호 기반 로그인 제출. 성공 시 홈으로 이동.
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

  /**
   * GoogleSignInButton 이 GIS 팝업을 통해 credential 을 얻으면 호출된다.
   * useCallback 으로 감싸는 게 핵심: 참조가 안정되어야 버튼 내부 useEffect
   * 가 재실행되면서 버튼이 깜빡이고 클릭 상태가 리셋되는 이슈를 피할 수 있다.
   */
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

  // GIS 스크립트 로딩 실패 등의 에러를 공용 에러 배너로 올려 준다.
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

        {/* 소셜 로그인. 비밀번호 플로우를 주 액션으로 두고, 구글은 바로 아래에
            보조로 배치한다. VITE_GOOGLE_CLIENT_ID 미설정 시 버튼 컴포넌트가
            스스로 "설정되지 않음" 안내 박스로 대체된다. */}
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
