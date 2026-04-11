import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import './App.css'

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

function LoadingFallback() {
  return (
    <div className="loading-container" style={{ minHeight: '60vh' }}>
      <div className="spinner" />
      <div className="loading-text">Loading...</div>
    </div>
  )
}

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
