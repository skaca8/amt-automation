import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '../utils/api'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'

export default function UserManagement() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [search, setSearch] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', page)
      params.set('limit', 20)
      if (search) params.set('search', search)
      const res = await get(`/admin/users?${params.toString()}`)
      setUsers(res.data || res.users || [])
      setTotalPages(res.totalPages || res.pagination?.totalPages || 1)
      setTotalItems(res.total || res.pagination?.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val || '-'}</div>
          {row.nationality && (
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{row.nationality}</div>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (val) => (
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{val || '-'}</span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (val) => val || '-',
    },
    {
      key: 'role',
      label: 'Role',
      render: (val) => (
        <span
          className={`badge ${val === 'admin' ? 'badge-active' : 'badge-pending'}`}
        >
          {val || 'user'}
        </span>
      ),
    },
    {
      key: 'bookingCount',
      label: 'Bookings',
      render: (val, row) => (
        <span style={{ fontWeight: 600 }}>
          {val ?? row.booking_count ?? row.totalBookings ?? '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Joined',
      render: (val, row) => formatDate(val || row.created_at),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p>View and manage registered users</p>
        </div>
        <button className="btn btn-secondary" onClick={loadUsers}>
          {'\u21BB'} Refresh
        </button>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="form-control"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={handleSearch}
          style={{ flex: 1, minWidth: 280 }}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        onRowClick={(row) => navigate(`/users/${row._id || row.id}`)}
        emptyMessage="No users found"
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={setPage}
      />
    </div>
  )
}
