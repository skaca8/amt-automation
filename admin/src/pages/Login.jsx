// ============================================================================
// Admin — 로그인 페이지 Login
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 관리자 이메일/비밀번호 입력 폼을 렌더링한다.
//   2) 제출 시 AuthContext.login() 을 호출한다. 성공하면 AuthProvider 가
//      user state 를 채우고, App.jsx 의 Route 가 자동으로 /login 을 / 로
//      리다이렉트 해 준다(이 컴포넌트에서 직접 navigate 하지 않는다).
//   3) 실패 시 상단에 빨간색 에러 배너를 표시한다.
//
// 렌더링 위치: App.jsx 의 "/login" 라우트. ProtectedRoute 바깥에 있다.
//
// 주의:
//   - 실제 토큰 저장·role 검증은 AuthContext.login 내부에서 처리된다.
//     이 컴포넌트는 순수 입력 UI + 에러 표시 책임만 가진다.
//   - 이미 로그인된 상태에서 /login 으로 오는 경우는 App.jsx 에서 이미
//     Navigate 로 끊어 주기 때문에 여기서는 신경 쓸 필요 없다.
// ============================================================================

import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    padding: 24,
  },
  card: {
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    padding: '48px 40px',
    width: '100%',
    maxWidth: 420,
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    width: 56,
    height: 56,
    background: '#3b82f6',
    borderRadius: 12,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    color: '#ffffff',
    marginBottom: 16,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#64748b',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#1e293b',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '0.95rem',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontFamily: 'inherit',
    color: '#1e293b',
    transition: 'all 0.2s ease',
    outline: 'none',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    fontSize: '1rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    background: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginTop: 8,
  },
  error: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: '0.85rem',
    border: '1px solid #fecaca',
    textAlign: 'center',
  },
}

/**
 * Login — 관리자 로그인 폼 페이지.
 *
 * Props: 없음.
 *
 * 반환 UI: 가운데 정렬 카드 + 이메일/비밀번호 입력 + 제출 버튼.
 *
 * 부작용:
 *   - AuthContext.login() 호출 → /api/auth/login POST, localStorage 쓰기.
 *   - 성공 후 라우트 리다이렉트는 App.jsx 가 수행하므로 여기서는 state 만 정리.
 */
export default function Login() {
  const { login } = useAuth()
  // email / password    : 입력 필드의 controlled state
  // error / loading     : 제출 결과에 따라 토글되는 UI 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 폼 제출 핸들러. 필수값 체크 후 login 호출, 실패 시 에러를 state 에 저장.
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logoSection}>
          <div style={styles.logoIcon}>{'\u26F7'}</div>
          <h1 style={styles.title}>High1 Admin</h1>
          <p style={styles.subtitle}>Sign in to manage the platform</p>
        </div>

        <form style={styles.form} onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}

          <div>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@high1.com"
              autoComplete="email"
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6'
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <div>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6'
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            disabled={loading}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.background = '#2563eb'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#3b82f6'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
