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
import Settings from './pages/Settings'

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

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    )
  }

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
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AdminLayout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}
