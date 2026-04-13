// ============================================================================
// Admin — 전역 인증 컨텍스트 (AuthProvider / useAuth)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) React Context 로 "현재 로그인된 관리자" 정보를 앱 전역에 공유한다.
//   2) 새로고침 직후 localStorage 에 저장된 'admin_token' / 'admin_user' 를
//      복구해, 사용자가 매번 재로그인하지 않도록 한다.
//   3) login() / logout() 액션을 제공하고, 로그인 성공 시 role === 'admin'
//      여부까지 검증해서 일반 사용자가 어드민 앱에 들어오지 못하도록 막는다.
//
// 사용처:
//   - main.jsx 에서 AuthProvider 로 전체 앱을 감싼다.
//   - 하위 컴포넌트에서는 useAuth() 훅으로 { user, token, loading, login, logout }
//     를 꺼내 쓴다.
//
// 주의:
//   - 토큰 키는 반드시 'admin_token' 이다. 고객용 앱(customer)이 'token' 키를
//     쓰기 때문에, 같은 브라우저에서 두 앱을 동시에 로그인해도 서로 간섭하지
//     않는다. api.js / ImageUploader 등에서도 이 키를 하드코딩해 쓰고 있어
//     이름을 바꾸면 동시에 바꿔야 한다.
//   - loading 플래그는 초기 복구 1회만 true → false 로 전환된다. App.jsx 의
//     ProtectedRoute 가 이 플래그를 보고 리다이렉트 깜빡임을 방지한다.
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react'

// 컨텍스트 기본값은 null. useAuth() 에서 Provider 외부 사용을 감지하기 위해
// 명시적으로 null 로 두고, 훅 내부에서 에러를 throw 한다.
const AuthContext = createContext(null)

/**
 * AuthProvider — 로그인 상태 저장소.
 *
 * 하위 트리에 user / token / loading / login / logout 을 컨텍스트로 내려준다.
 * mount 직후 localStorage 에서 토큰을 복구하는 비동기 효과를 한 번 수행한다.
 *
 * Props:
 *   - children: Provider 안에서 렌더링될 자식 노드 (보통 <App />).
 *
 * 부작용:
 *   - localStorage 의 'admin_token' / 'admin_user' 읽기·쓰기·삭제.
 *   - /api/auth/login 에 POST 요청 (login 호출 시).
 */
export function AuthProvider({ children }) {
  // user  : 로그인된 관리자 정보 객체 (id, email, name, role 등). 미로그인이면 null.
  // token : JWT 문자열. API 요청의 Authorization 헤더에 실린다.
  // loading: 초기 localStorage 복구가 끝났는지 여부. 라우팅 가드가 참고한다.
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // -------------------------------------------------------------------------
  // 초기 토큰 복구 effect (빈 deps → mount 시 1회만 실행).
  // -------------------------------------------------------------------------
  // 왜 필요한가: 새로고침하면 React state 는 초기값으로 돌아가지만
  // localStorage 는 유지된다. 여기서 읽어와 user/token 을 세팅해 주지 않으면
  // 매번 /login 으로 튕긴다.
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    const savedUser = localStorage.getItem('admin_user')
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        // 저장된 계정이 정말 admin 롤인지 다시 확인한다. localStorage 는
        // 사용자가 손으로 수정 가능하므로, 역할이 바뀌어 있으면 즉시 폐기.
        if (parsed.role === 'admin') {
          setToken(savedToken)
          setUser(parsed)
        } else {
          localStorage.removeItem('admin_token')
          localStorage.removeItem('admin_user')
        }
      } catch {
        // JSON.parse 실패 = 데이터가 깨져 있음. 안전하게 제거한다.
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
      }
    }
    // 토큰 유무와 무관하게 loading 은 반드시 false 로 내려야
    // App.jsx 의 라우트 트리가 렌더링을 시작한다.
    setLoading(false)
  }, [])

  /**
   * login — 이메일/비밀번호로 관리자 로그인을 시도한다.
   *
   * 성공하면 state + localStorage 에 토큰과 사용자를 저장하고, 서버 응답 객체
   * 전체를 그대로 반환한다. 실패 케이스(네트워크/인증/권한) 모두 throw 로
   * 전달해, 호출부(Login.jsx)가 try/catch 로 에러 메시지를 표시한다.
   *
   * 부작용: /api/auth/login POST, localStorage 쓰기.
   */
  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) {
      // 서버가 내려준 message 를 최대한 그대로 노출한다(잘못된 비번 등).
      throw new Error(data.message || 'Login failed')
    }
    // 일반 사용자가 어드민 앱에 로그인하려고 하면 여기서 차단.
    // 백엔드도 requireAdmin 으로 각 엔드포인트를 막지만, 클라이언트 단에서도
    // 불필요한 상태 세팅을 피하기 위해 한 번 더 검증한다.
    if (data.user?.role !== 'admin') {
      throw new Error('Access denied. Admin privileges required.')
    }
    setToken(data.token)
    setUser(data.user)
    // localStorage 에 저장 → 새로고침 후 useEffect 복구 경로에서 재사용.
    localStorage.setItem('admin_token', data.token)
    localStorage.setItem('admin_user', JSON.stringify(data.user))
    return data
  }

  /**
   * logout — 로그아웃. React state 와 localStorage 를 동시에 비운다.
   * 서버 세션이라는 개념이 없는(stateless JWT) 구조이므로 서버 호출은 없다.
   * 호출 후에는 ProtectedRoute 가 자동으로 /login 으로 리다이렉트한다.
   */
  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth — AuthContext 의 편의 훅.
 *
 * Provider 바깥에서 호출되면 즉시 throw 해서, 개발자가 잘못된 위치에서
 * 쓰는 것을 빨리 알아차리게 한다.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
