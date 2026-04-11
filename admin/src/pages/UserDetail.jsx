import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { get, put } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import StatsCard from '../components/StatsCard'

export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadUser()
  }, [id])

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
