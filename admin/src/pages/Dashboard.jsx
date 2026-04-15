// ============================================================================
// Admin — 대시보드 Dashboard
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 상단에 KPI 카드 4개 (총 예약/총 매출/활성 사용자/오늘 예약) 를 배치.
//   2) 가운데에 recharts LineChart 로 매출 추이, BarChart 로 예약 건수 추이.
//   3) 하단에 "최근 예약" 목록 테이블. 행 클릭 시 상세 페이지로 이동.
//
// 백엔드 엔드포인트:
//   GET /admin/dashboard/overview         → 총계 + today 등
//   GET /admin/dashboard/revenue-chart    → [{ date, revenue }, ...]
//   GET /admin/dashboard/booking-chart    → [{ date, count }, ...]
//   GET /admin/dashboard/recent-bookings  → 최근 n 건의 예약
//
// 주의:
//   - 각 overview 키는 과거/현재 스키마(snake_case vs camelCase)가 섞여 있어
//     매핑 시 두 가지 이름을 다 받아들이는 fallback chain 을 쓴다.
//   - Promise.all + catch(() => null) 로 묶어서 한 엔드포인트 실패가 전체
//     로딩을 깨뜨리지 않게 한다.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { get } from '../utils/api'
import StatsCard from '../components/StatsCard'
import StatusBadge from '../components/StatusBadge'

/**
 * Dashboard — 어드민 메인 요약 페이지.
 *
 * Props: 없음.
 *
 * 반환 UI:
 *   - page-header + Refresh 버튼
 *   - StatsCard 4개 그리드
 *   - 매출/예약 차트 2개 그리드
 *   - 최근 예약 카드(표)
 *
 * 부작용:
 *   - 4개 dashboard 엔드포인트 병렬 호출.
 *   - 행 클릭 시 navigate(`/bookings/:id`) 로 라우팅 이동.
 */
export default function Dashboard() {
  const navigate = useNavigate()
  // overview       : KPI 카드용 요약 지표 객체
  // revenueChart   : 매출 라인차트 데이터포인트 배열
  // bookingChart   : 예약 건수 바차트 데이터포인트 배열
  // recentBookings : 최근 예약 테이블용 배열
  // loading/error  : UI 상태
  const [overview, setOverview] = useState(null)
  const [revenueChart, setRevenueChart] = useState([])
  const [bookingChart, setBookingChart] = useState([])
  const [recentBookings, setRecentBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // mount 시 1회 자동 로드. Refresh 버튼은 이 함수를 다시 호출한다.
  useEffect(() => {
    loadDashboard()
  }, [])

  // ----------------------------------------------------------------------
  // 4개 엔드포인트를 병렬로 호출한 뒤 상태를 세팅한다.
  // 각 호출은 catch(() => null) 로 독립 실패 허용 → 부분 장애 시에도
  // 가능한 만큼의 데이터를 사용자에게 보여 줄 수 있다.
  // ----------------------------------------------------------------------
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
      // 두 가지 naming convention(snake/camel)을 모두 수용한다.
      // 과거 엔드포인트 응답이 snake_case 였으나 일부 핸들러가 camelCase 로
      // 마이그레이션되어 혼재한다.
      setOverview({
        totalBookings: ov?.total_bookings || ov?.totalBookings || 0,
        totalRevenue: ov?.total_revenue || ov?.totalRevenue || 0,
        activeUsers: ov?.total_users || ov?.activeUsers || 0,
        todayBookings: ov?.today?.bookings || ov?.todayBookings || 0,
        products: ov?.products || {},
        bookingStatus: ov?.booking_status || ov?.bookingStatus || {},
      })
      setRevenueChart(rev?.data || (Array.isArray(rev) ? rev : []))
      setBookingChart(bk?.data || (Array.isArray(bk) ? bk : []))
      const recentData = recent?.bookings || recent?.data || (Array.isArray(recent) ? recent : [])
      setRecentBookings(recentData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 원화 포맷터. null/undefined 는 "₩0" 로 표시.
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
                    <td>{b.product_type || b.productType || '-'}</td>
                    <td>{formatDate(b.check_in || b.visit_date || b.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(b.total_price || b.totalAmount || b.total_amount)}</td>
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
