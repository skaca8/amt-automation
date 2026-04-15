// ============================================================================
// 고객 프런트엔드 라우팅 셸 (App.jsx)
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   - 앱 전체 페이지를 react-router Routes 로 매핑한다.
//   - 모든 page 컴포넌트를 React.lazy 로 code-split 해서 초기 번들 크기를
//     줄인다. Suspense fallback 으로 간단한 스피너를 보여준다.
//   - 최상단 Header / 하단 Footer 는 고정이고, 가운데 <main> 안에 라우트가
//     바뀔 때마다 해당 페이지가 렌더된다.
//
// 렌더 위치: main.jsx 에서 AuthProvider 아래로 렌더된다. 따라서 모든 페이지는
//            useAuth() 훅을 자유롭게 사용할 수 있다.
//
// 주의:
//   - 새로운 페이지를 추가하면 lazy import 와 Route 두 곳을 같이 고쳐야 한다.
//   - /booking/:type/:id 의 :type 은 'hotel' | 'ticket' | 'package'
//     세 가지로만 들어와야 한다. (BookingPage 에서 분기 처리)
// ============================================================================

import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import './App.css'

// ---------------------------------------------------------------------------
// Lazy-loaded 페이지들.
// 각 페이지는 라우트가 매칭될 때 처음 한 번만 네트워크로 청크를 받아온다.
// ---------------------------------------------------------------------------
const Home = lazy(() => import('./pages/Home'))
const HotelList = lazy(() => import('./pages/HotelList'))
const HotelDetail = lazy(() => import('./pages/HotelDetail'))
const TicketList = lazy(() => import('./pages/TicketList'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const PackageList = lazy(() => import('./pages/PackageList'))
const PackageDetail = lazy(() => import('./pages/PackageDetail'))
const BookingPage = lazy(() => import('./pages/BookingPage'))
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'))
const MyBookings = lazy(() => import('./pages/MyBookings'))
const BookingDetail = lazy(() => import('./pages/BookingDetail'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Profile = lazy(() => import('./pages/Profile'))
const OrderLookup = lazy(() => import('./pages/OrderLookup'))

/**
 * Suspense 가 lazy 청크를 불러오는 동안 표시할 로딩 UI.
 * 별도 상태를 가지지 않는 순수 presentational 컴포넌트.
 */
function LoadingFallback() {
  return (
    <div className="loading-container" style={{ minHeight: '60vh' }}>
      <div className="spinner" />
      <div className="loading-text">Loading...</div>
    </div>
  )
}

/**
 * 애플리케이션 최상위 셸.
 * - Header 와 Footer 를 고정 배치하고 가운데 <main> 영역에서 라우팅한다.
 * - flex column + minHeight:100vh 로 footer 를 항상 화면 아래에 붙인다.
 */
export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/hotels" element={<HotelList />} />
            <Route path="/hotels/:id" element={<HotelDetail />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/packages" element={<PackageList />} />
            <Route path="/packages/:id" element={<PackageDetail />} />
            <Route path="/booking/:type/:id" element={<BookingPage />} />
            <Route path="/booking/confirmation/:bookingId" element={<BookingConfirmation />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/my-bookings/:id" element={<BookingDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/order-lookup" element={<OrderLookup />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
