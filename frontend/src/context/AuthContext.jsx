// ============================================================================
// 고객용 인증 Context (AuthContext)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 로그인 여부 / 현재 사용자 / JWT 토큰을 앱 전역에 공유한다.
//   - 로그인, 회원가입, 로그아웃, 프로필 업데이트, Google 소셜 로그인의
//     다섯 가지 auth 플로우를 하나의 Provider 에서 제공한다.
//   - 최초 마운트 시 localStorage 의 'token' 을 읽어 /auth/me 로 유효성
//     검증을 시도하고, 실패하면 토큰을 지운다. (expired / revoked 케이스)
//
// 렌더 위치: main.jsx 에서 BrowserRouter 바로 안쪽. 따라서 모든 라우트는
//            useAuth() 를 자유롭게 쓸 수 있다.
//
// 주의:
//   - 토큰은 'token' key 에 저장한다. 관리자 콘솔의 'admin_token' 과 절대
//     섞이면 안 된다. (e504ce7 정합화 커밋)
//   - StrictMode 개발 모드에서 useEffect 가 두 번 실행되면서 /auth/me 가
//     두 번 호출될 수 있다. 운영 빌드에서는 한 번만 호출된다.
//   - Google Sign-In (c06b286) 은 GIS 의 credential(ID token)을 백엔드가
//     검증하고, 일반 password 로그인과 동일한 { token, user } 응답을
//     돌려받아 state 를 업데이트하는 구조다.
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { post, get, put } from '../utils/api'

// React Context 객체. Provider 밖에서 useContext 로 접근하면 null 이므로
// 하단 useAuth 훅에서 null 가드를 둔다.
const AuthContext = createContext(null)

/**
 * 앱 전역에 auth 상태/액션을 제공하는 Provider.
 *
 * @param {{ children: React.ReactNode }} props - 하위 트리
 *
 * 내부 state:
 *   - user      : 백엔드가 내려준 사용자 객체({id, email, name, ...}) 또는 null
 *   - token     : JWT 문자열. localStorage 와 일치하도록 관리한다.
 *   - loading   : 최초 /auth/me 확인이 끝나기 전까지 true. 이 동안은 라우트
 *                 가드가 "아직 모름" 상태임을 알 수 있게 한다.
 *
 * 부작용:
 *   - localStorage 의 'token' 을 읽고 쓴다.
 *   - /auth/me, /auth/login, /auth/register, /auth/google, /auth/me(PUT)
 *     다섯 가지 API 를 호출한다.
 */
export function AuthProvider({ children }) {
  // 로그인된 사용자 객체. 로그아웃 상태에서는 null.
  const [user, setUser] = useState(null)
  // 저장된 토큰을 초기값으로 꺼낸다. 새로고침을 견디는 핵심 라인.
  const [token, setToken] = useState(localStorage.getItem('token'))
  // 최초 부팅 동안 true. /auth/me 가 끝나거나 토큰이 없으면 false 로.
  const [loading, setLoading] = useState(true)

  // --------------------------------------------------------------------------
  // 토큰으로 현재 사용자 정보 조회
  // --------------------------------------------------------------------------
  /**
   * 보관 중인 토큰을 이용해 서버에 "이 토큰이 누구인지" 물어본다.
   * - 토큰이 없으면 즉시 loading 만 내리고 종료한다.
   * - 응답 shape 은 백엔드 버전에 따라 `{ user }` 또는 user 객체 자체가
   *   올 수 있어 둘 다 허용한다.
   * - 401 등 실패 시에는 썩은 토큰을 지우고 user 를 null 로 되돌린다.
   */
  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const data = await get('/auth/me')
      setUser(data.user || data)
    } catch (err) {
      console.error('Failed to fetch user:', err)
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  // 마운트 시 그리고 token 이 바뀔 때마다 /auth/me 를 한 번씩 태운다.
  // login/register/loginWithGoogle 은 setToken 을 부르기 때문에 그 다음
  // 렌더에서 이 effect 가 자동으로 재실행된다.
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // --------------------------------------------------------------------------
  // 로그인 / 회원가입 / 구글 로그인 / 로그아웃 / 프로필 수정
  // --------------------------------------------------------------------------

  /**
   * 이메일+비밀번호 로그인.
   * 성공 시 localStorage 와 state 양쪽에 토큰/유저를 반영한다.
   * 실패는 호출자(Login 페이지)가 try/catch 로 잡아 에러 메시지를 렌더한다.
   */
  const login = async (email, password) => {
    const data = await post('/auth/login', { email, password })
    const newToken = data.token
    const userData = data.user
    // 새로고침 후에도 세션을 유지하도록 localStorage 에 저장.
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(userData)
    return data
  }

  /**
   * 신규 회원가입.
   * 백엔드가 가입 직후 바로 토큰을 내려주면 자동 로그인 상태로 전환한다.
   * (이메일 인증 등으로 토큰을 주지 않는 정책이면 if 블록이 스킵된다.)
   */
  const register = async (formData) => {
    const data = await post('/auth/register', formData)
    const newToken = data.token
    const userData = data.user
    if (newToken) {
      localStorage.setItem('token', newToken)
      setToken(newToken)
      setUser(userData)
    }
    return data
  }

  /**
   * Google Sign-In 콜백에서 받은 credential(ID token)을 백엔드 세션으로
   * 교환한다.
   *
   * 흐름:
   *   1) GoogleSignInButton 이 GIS 팝업/one-tap 을 통해 credential 을 얻는다.
   *   2) 그 문자열을 이 함수로 넘긴다.
   *   3) POST /api/auth/google 가 Google 공개키로 토큰을 검증하고,
   *      동일 이메일의 로컬 user 행을 찾거나 새로 만든 뒤
   *      password 로그인과 동일한 { token, user } shape 을 돌려준다.
   *   4) 그 토큰을 저장해 나머지 앱 로직(AuthContext 소비자)은 일반 로그인과
   *      구분 없이 동작한다.
   */
  const loginWithGoogle = async (credential) => {
    const data = await post('/auth/google', { credential })
    const newToken = data.token
    const userData = data.user
    if (!newToken) {
      // 백엔드가 세션 토큰을 돌려주지 않은 건 설정 오류 또는 검증 실패.
      // 호출자가 에러 배너를 보여줄 수 있게 throw 한다.
      throw new Error('Google sign-in failed: no session token returned.')
    }
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(userData)
    return data
  }

  /**
   * 로그아웃.
   * 클라이언트 상태만 지운다. 서버 쪽 세션은 JWT stateless 특성상 별도
   * 정리가 필요 없고, 토큰이 아직 유효해도 더이상 보관하지 않으므로 실효.
   */
  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  /**
   * 프로필 수정.
   * 백엔드는 PUT /api/auth/me 로 부분 업데이트를 받는다
   * (backend/src/routes/auth.js). 예전 코드가 '/auth/profile' 로 요청해
   * 매번 404 가 나던 문제를 e504ce7 커밋에서 정합화했다.
   */
  const updateProfile = async (profileData) => {
    const data = await put('/auth/me', profileData)
    setUser(data.user || data)
    return data
  }

  // 토큰과 user 객체가 모두 채워졌을 때만 "로그인됨" 으로 판정한다.
  // (token 만 있고 user 는 null 인 찰나의 상태를 로그인으로 보지 않는다.)
  const isAuthenticated = !!token && !!user

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        loginWithGoogle,
        isAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * auth state 와 액션을 읽어 오는 커스텀 훅.
 * AuthProvider 트리 바깥에서 호출하면 즉시 에러를 던져 조용한 버그를 막는다.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
