// ============================================================================
// Admin — 사용자 상세 페이지 UserDetail
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) URL :id 의 사용자를 조회하고 기본 정보 / 계정 세부사항 / 예약 이력을
//      한 페이지에 보여 준다.
//   2) 관리자 권한으로 사용자 프로필(이름/이메일/전화/역할)을 수정할 수 있다.
//   3) StatsCard 2개로 "총 예약 수" 와 "총 지출액" 을 요약해서 보여 준다.
//
// 렌더링 위치: /users/:id.
//
// 주의:
//   - 예약 이력 fetch 실패는 무시하고 빈 배열로 대체한다. 계정 상세 페이지가
//     부분 데이터로라도 열리는 것이 더 유용하기 때문.
//   - 역할(role)을 user ↔ admin 으로 바꿀 수 있는 드롭다운은 심각한 권한
//     변경을 유발하므로 별도의 confirm 은 없지만, 저장 실패 시 alert 로 노출.
// ============================================================================

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { get, put } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import StatsCard from '../components/StatsCard'

/**
 * UserDetail — 단일 사용자 상세 + 편집 + 예약 이력.
 *
 * 부작용:
 *   - GET /admin/users/:id, GET /admin/users/:id/bookings
 *   - PUT /admin/users/:id (프로필 수정)
 *   - navigate('/users'), navigate(`/bookings/:id`)
 */
export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  // user       : 서버 조회 결과
  // bookings   : 해당 사용자의 예약 이력
  // editing    : 프로필 편집 모드 여부
  // form       : 편집 모드 시 바인딩되는 입력 값들
  const [user, setUser] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  // 다른 사용자로 이동하는 경우에도 재조회가 되도록 id 를 deps 에 포함.
  useEffect(() => {
    loadUser()
  }, [id])

  // 사용자 + 예약 이력을 병렬 조회. bookings 쪽은 실패해도 빈 배열 허용.
  const loadUser = async () => {
    setLoading(true)
    setError('')
    try {
      const [userRes, bookingRes] = await Promise.all([
        get(`/admin/users/${id}`),
        get(`/admin/users/${id}/bookings`).catch(() => ({ bookings: [] })),
      ])
      const userData = userRes.user || userRes.data || userRes
      setUser(userData)
      setForm({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        role: userData.role || 'user',
      })
      setBookings(bookingRes.bookings || bookingRes.data || bookingRes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 프로필 저장. 성공 시 편집 모드 종료 + 재조회. 실패 시 alert.
  const handleSave = async () => {
    setSaving(true)
    try {
      await put(`/admin/users/${id}`, form)
      setEditing(false)
      await loadUser()
    } catch (err) {
      alert('Failed to update user: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (val) => {
    if (val == null) return '\u20a90'
    return '\u20a9' + Number(val).toLocaleString()
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  const formatDateTime = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div>
        <div className="back-link" onClick={() => navigate('/users')}>
          {'\u2190'} Back to Users
        </div>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 16, color: '#64748b' }}>Loading user details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="back-link" onClick={() => navigate('/users')}>
          {'\u2190'} Back to Users
        </div>
        <div className="alert alert-error">{error}</div>
      </div>
    )
  }

  if (!user) return null

  // 지출 총합. 개별 예약의 total_price / total_amount 둘 다 허용하며
  // null 은 0 으로 간주한다. (취소/환불 구분 없이 단순 합산임에 유의.)
  const totalSpent = bookings.reduce((sum, b) => sum + (b.total_price || b.total_amount || 0), 0)

  return (
    <div>
      <div className="back-link" onClick={() => navigate('/users')}>
        {'\u2190'} Back to Users
      </div>

      <div className="page-header">
        <div>
          <h1>{user.name || 'User'}</h1>
          <p>Member since {formatDate(user.created_at || user.createdAt)}</p>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatsCard
          title="Total Bookings"
          value={bookings.length.toString()}
          icon={'\ud83d\udccb'}
          color="blue"
        />
        <StatsCard
          title="Total Spent"
          value={formatCurrency(totalSpent)}
          icon={'\ud83d\udcb0'}
          color="green"
        />
      </div>

      <div className="detail-grid">
        {/* User Info Card */}
        <div className="card">
          <div className="card-header">
            <h3>User Information</h3>
            {!editing ? (
              <button className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : (
              <div className="btn-group">
                <button className="btn btn-sm btn-secondary" onClick={() => { setEditing(false); setForm({ name: user.name, email: user.email, phone: user.phone, role: user.role }) }}>
                  Cancel
                </button>
                <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div>
              <div className="form-group">
                <label>Name</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  className="form-control"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  className="form-control"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  className="form-control"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Name</span>
                <span className="value">{user.name || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">Email</span>
                <span className="value">{user.email || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">Phone</span>
                <span className="value">{user.phone || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">Role</span>
                <span className="value">
                  <span className={`badge ${user.role === 'admin' ? 'badge-active' : 'badge-pending'}`}>
                    {user.role || 'user'}
                  </span>
                </span>
              </div>
              <div className="info-item">
                <span className="label">Nationality</span>
                <span className="value">{user.nationality || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">Joined</span>
                <span className="value">{formatDateTime(user.created_at || user.createdAt)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Account Details Card */}
        <div className="card">
          <div className="card-header">
            <h3>Account Details</h3>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">User ID</span>
              <span className="value" style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {user._id || user.id || '-'}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Email Verified</span>
              <span className="value">
                <StatusBadge status={user.email_verified || user.emailVerified ? 'active' : 'inactive'} />
              </span>
            </div>
            <div className="info-item">
              <span className="label">Last Login</span>
              <span className="value">
                {formatDateTime(user.last_login || user.lastLogin || user.lastLoginAt)}
              </span>
            </div>
            <div className="info-item">
              <span className="label">Language</span>
              <span className="value">{user.language || user.preferredLanguage || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Booking History */}
      <div className="card">
        <div className="card-header">
          <h3>Booking History</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Booking #</th>
                <th>Product</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                    No booking history
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr
                    key={b._id || b.id}
                    className="clickable"
                    onClick={() => navigate(`/bookings/${b._id || b.id}`)}
                  >
                    <td style={{ fontWeight: 600, color: '#3b82f6' }}>
                      {b.booking_number || b.bookingNumber || '-'}
                    </td>
                    <td>{b.product_name || b.productName || b.product?.name_en || '-'}</td>
                    <td>{formatDate(b.check_in || b.visit_date || b.date)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {formatCurrency(b.total_price || b.total_amount)}
                    </td>
                    <td><StatusBadge status={b.status} type="booking" /></td>
                    <td><StatusBadge status={b.payment_status || b.paymentStatus} type="payment" /></td>
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
