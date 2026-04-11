import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { get } from '../utils/api'
import StatsCard from '../components/StatsCard'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState(null)
  const [revenueChart, setRevenueChart] = useState([])
  const [bookingChart, setBookingChart] = useState([])
  const [recentBookings, setRecentBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      const [ov, rev, bk, recent] = await Promise.all([
        get('/admin/dashboard/overview').catch(() => null),
        get('/admin/dashboard/revenue-chart').catch(() => null),
        get('/admin/dashboard/booking-chart').catch(() => null),
        get('/admin/dashboard/recent-bookings').catch(() => null),
      ])
      setOverview(ov || {
        totalBookings: 0,
        totalRevenue: 0,
        activeUsers: 0,
        todayBookings: 0,
        bookingChange: 0,
        revenueChange: 0,
        userChange: 0,
        todayChange: 0,
      })
      setRevenueChart(rev?.data || rev || [])
      setBookingChart(bk?.data || bk || [])
      setRecentBookings(recent?.data || recent || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val) => {
    if (val == null) return '\u20a90'
    return '\u20a9' + Number(val).toLocaleString()
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back! Here is your overview.</p>
          </div>
        </div>
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ height: 100 }}>
              <div className="skeleton" style={{ width: '40%', height: 14, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '60%', height: 28 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back! Here is your overview.</p>
        </div>
        <button className="btn btn-secondary" onClick={loadDashboard}>
          {'\u21BB'} Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <StatsCard
          title="Total Bookings"
          value={overview?.totalBookings?.toLocaleString() || '0'}
          change={overview?.bookingChange}
          icon={'\ud83d\udccb'}
          color="blue"
        />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(overview?.totalRevenue)}
          change={overview?.revenueChange}
          icon={'\ud83d\udcb0'}
          color="green"
        />
        <StatsCard
          title="Active Users"
          value={overview?.activeUsers?.toLocaleString() || '0'}
          change={overview?.userChange}
          icon={'\ud83d\udc65'}
          color="purple"
        />
        <StatsCard
          title="Today's Bookings"
          value={overview?.todayBookings?.toLocaleString() || '0'}
          change={overview?.todayChange}
          icon={'\ud83d\udcc5'}
          color="amber"
        />
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Revenue (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(v) => {
                  if (!v) return ''
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value), 'Revenue']}
                labelFormatter={(label) => formatDate(label)}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Bookings (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bookingChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(v) => {
                  if (!v) return ''
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip
                formatter={(value) => [value, 'Bookings']}
                labelFormatter={(label) => formatDate(label)}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
                }}
              />
              <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Recent Bookings</h3>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/bookings')}
          >
            View All
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Booking #</th>
                <th>Guest</th>
                <th>Product</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-secondary" style={{ padding: 32 }}>
                    No recent bookings
                  </td>
                </tr>
              ) : (
                recentBookings.map((b) => (
                  <tr
                    key={b._id || b.id}
                    className="clickable"
                    onClick={() => navigate(`/bookings/${b._id || b.id}`)}
                  >
                    <td style={{ fontWeight: 600 }}>{b.bookingNumber || b.booking_number || '-'}</td>
                    <td>{b.guestName || b.guest_name || b.user?.name || '-'}</td>
                    <td>{b.productName || b.product_name || b.product?.name_en || '-'}</td>
                    <td>{formatDate(b.checkInDate || b.check_in_date || b.date)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(b.totalAmount || b.total_amount)}</td>
                    <td><StatusBadge status={b.status} type="booking" /></td>
                    <td><StatusBadge status={b.paymentStatus || b.payment_status} type="payment" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
