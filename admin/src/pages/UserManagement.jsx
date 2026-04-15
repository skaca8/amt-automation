// ============================================================================
// Admin — 사용자 목록 페이지 UserManagement
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) /admin/users 엔드포인트를 페이지네이션 + 검색(이름/이메일/전화) 하여
//      사용자 목록을 테이블로 보여 준다.
//   2) 각 행 클릭 시 /users/:id 상세 페이지로 이동.
//
// 렌더링 위치: /users 라우트. 사이드바 "Users" 메뉴.
//
// 주의:
//   - 검색은 서버사이드. search state 가 바뀌면 page 를 1 로 리셋.
//   - booking_count / bookingCount / totalBookings 가 뒤섞여 있을 수 있어
//     컬럼 render 에서 순차 fallback 으로 표시한다.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '../utils/api'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'

/**
 * UserManagement — 사용자 목록 + 검색 + 페이지네이션.
 *
 * 부작용: GET /admin/users, navigate(`/users/:id`).
 */
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
      setUsers(res.users || res.data || [])
      setTotalPages(res.pagination?.total_pages || res.totalPages || 1)
      setTotalItems(res.pagination?.total || res.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // 검색어 변경 시 1페이지로 리셋. 서버로의 재요청은 useEffect 가 trigger.
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
      key: 'booking_count',
      label: 'Bookings',
      render: (val, row) => (
        <span style={{ fontWeight: 600 }}>
          {val ?? row.bookingCount ?? row.totalBookings ?? '-'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (val, row) => formatDate(val || row.createdAt),
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
