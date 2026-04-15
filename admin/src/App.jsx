// ============================================================================
// Admin — 최상위 라우터 · 레이아웃 셸
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 모든 admin 페이지 컴포넌트를 import 해서 Routes 로 연결한다.
//   2) 로그인 여부에 따라 `/login` 과 나머지 앱을 갈라 주는 ProtectedRoute 를 정의.
//   3) 로그인 이후 전체 화면 레이아웃(사이드바 + 메인 컨텐츠)을 AdminLayout 으로
//      감싸, 하위 페이지들이 좌측 Sidebar 와 함께 렌더링되게 한다.
//
// 라우팅 구조:
//   /login           → Login 페이지 (이미 로그인된 경우 자동으로 / 로 보낸다)
//   /*               → ProtectedRoute 로 게이팅, 안쪽에 또 한 번 Routes 가 들어간다.
//                       이 "중첩 Routes" 패턴은 AdminLayout 공통 셸을 한 번만
//                       렌더링하면서, 내부 자식 경로만 바뀌도록 하기 위함이다.
//
// 주의:
//   - ProtectedRoute 는 user 가 null 이면 /login 으로 Navigate replace 시킨다.
//     replace 로 히스토리를 덮어쓰지 않으면 뒤로가기로 보호 페이지에 다시 들어갈 수 있다.
//   - loading 상태에서도 스피너를 먼저 보여 주는데, 이는 AuthProvider 가 새로고침
//     직후 localStorage 에서 토큰을 복구하는 동안 잠깐 "user 가 null 인 상태" 가
//     있기 때문이다. 이 구간에서 성급하게 /login 으로 보내면 깜빡임이 생긴다.
// ============================================================================

import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import BookingManagement from './pages/BookingManagement'
import BookingDetail from './pages/BookingDetail'
import ProductManagement from './pages/ProductManagement'
import HotelManagement from './pages/HotelManagement'
import TicketManagement from './pages/TicketManagement'
import PackageManagement from './pages/PackageManagement'
import UserManagement from './pages/UserManagement'
import UserDetail from './pages/UserDetail'
import PaymentManagement from './pages/PaymentManagement'
// Access Codes — 특정 유저에게 특정 상품 구매 권한을 부여하는 ACG-XXXX
// 토큰을 관리. 페이지 자체 헤더 주석에 설계 상세 있음.
import AccessCodeManagement from './pages/AccessCodeManagement'
import Settings from './pages/Settings'

/**
 * AdminLayout — 로그인된 관리자에게 보여지는 전체 화면 셸.
 *
 * 좌측 고정 Sidebar + 우측 스크롤 가능한 main 영역으로 구성된다.
 * children 으로 전달받은 페이지 컴포넌트를 <main> 안에 렌더링한다.
 * 이 컴포넌트 자체는 라우팅을 모르며, 바깥쪽 Routes 가 경로를 바꿔가며
 * children 을 교체해 준다.
 */
function AdminLayout({ children }) {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        {children}
      </main>
    </div>
  )
}

/**
 * ProtectedRoute — 인증 게이트.
 *
 * useAuth() 로 현재 로그인 상태를 조회하고:
 *   - loading: 아직 토큰 복구 중 → 스피너
 *   - user 없음: /login 으로 replace 리다이렉트
 *   - user 있음: children 그대로 렌더링
 *
 * AuthProvider 가 앱 mount 직후 localStorage 의 'admin_token' 을 읽어 user 를
 * 복원하기 때문에 loading 체크가 꼭 필요하다. 없으면 새로고침 직후 매번
 * /login 으로 튕긴다.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

/**
 * App — 최상위 컴포넌트.
 *
 * 전역 로딩(AuthProvider 의 초기 토큰 검증) 이 끝날 때까지 전체 앱에
 * 스피너를 띄우고, 끝나면 login 라우트와 보호된 영역 라우트를 내보낸다.
 * 이미 로그인된 상태에서 /login 을 직접 URL 로 치면 즉시 / 로 보내 준다.
 */
export default function App() {
  const { user, loading } = useAuth()

  // 전역 초기 로딩: 토큰 복원이 끝나기 전에 라우트 트리를 렌더하면
  // ProtectedRoute 의 user === null 판정으로 원치 않는 리다이렉트가 일어난다.
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  // ----------------------------------------------------------------------
  // 라우트 선언
  //   - 바깥 Routes 는 "/login" 과 "/*" 두 가지만 가진다.
  //   - "/*" 내부에서 AdminLayout 으로 감싼 뒤, 한 단계 더 Routes 를 둬서
  //     실제 페이지 경로를 분기한다. 이렇게 해야 페이지를 오갈 때 Sidebar 가
  //     unmount 되지 않아 스크롤 위치·드롭다운 상태가 유지된다.
  //   - 마지막의 "*" → Navigate to="/" 는 매칭되지 않는 경로를 대시보드로 보내는 catch-all.
  // ----------------------------------------------------------------------
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AdminLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/bookings" element={<BookingManagement />} />
              <Route path="/bookings/:id" element={<BookingDetail />} />
              <Route path="/products" element={<ProductManagement />} />
              <Route path="/products/hotels" element={<HotelManagement />} />
              <Route path="/products/tickets" element={<TicketManagement />} />
              <Route path="/products/packages" element={<PackageManagement />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/payments" element={<PaymentManagement />} />
              {/* Access Codes — 구매 게이트 코드 발급/관리. 사이드바 메뉴의
                  /access-codes 와 동일한 경로. */}
              <Route path="/access-codes" element={<AccessCodeManagement />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AdminLayout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}
