// ============================================================================
// Admin — 예약 목록 페이지 BookingManagement
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) GET /admin/bookings?... 로 예약 목록을 페이지네이션 + 필터링해서 조회.
//   2) 상단 필터 바(검색/상태/결제 상태/상품 유형/기간) 를 제공하고, 값이
//      바뀔 때마다 page 를 1 로 리셋한 뒤 재요청한다.
//   3) DataTable 로 표를 렌더링하고, 행 클릭 시 /bookings/:id 상세로 이동.
//   4) Export CSV 버튼: downloadFile 헬퍼로 /admin/bookings/export 를 호출해
//      현재 필터가 적용된 CSV 를 내려 받는다(페이지 번호는 무시).
//
// 렌더링 위치: /bookings 라우트. 사이드바의 "Bookings" 메뉴.
//
// 주의:
//   - filters 객체 중 snake_case 로 변환하는 매핑이 여기에만 있다. 백엔드가
//     쿼리 파라미터를 snake_case 로 기대하므로 "paymentStatus → payment_status",
//     "startDate → from_date" 처럼 변환한다.
//   - 응답 스키마의 페이지 정보는 pagination.total_pages / pagination.totalPages /
//     totalPages 셋 중 어디에 실릴지 몰라 순차 fallback 한다.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, downloadFile } from '../utils/api'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'

/**
 * BookingManagement — 예약 리스트 + 필터 + CSV 내보내기 페이지.
 *
 * Props: 없음.
 *
 * 부작용:
 *   - GET /admin/bookings (필터/페이지네이션 적용)
 *   - GET /admin/bookings/export (CSV 다운로드)
 *   - navigate(`/bookings/:id`) 상세 이동
 */
export default function BookingManagement() {
  const navigate = useNavigate()
  // bookings       : 현재 페이지의 예약 배열
  // loading/error  : UI 상태
  // page/totalPages/totalItems : 페이지네이션 상태
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  // filters : 필터 바의 각 입력값. 빈 문자열이면 해당 필터를 적용하지 않는다.
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    productType: '',
    startDate: '',
    endDate: '',
    search: '',
  })

  // ----------------------------------------------------------------------
  // loadBookings — 현재 filters/page 값으로 서버 목록 API 호출.
  // useCallback 으로 묶은 뒤 useEffect 가 이 함수를 deps 에 넣어
  // filters/page 변화 → 자동 재호출로 이어진다.
  // ----------------------------------------------------------------------
  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', page)
      // 한 페이지당 20건 고정. 디자인이 20건 기준으로 짜여 있다.
      params.set('limit', 20)
      if (filters.status) params.set('status', filters.status)
      if (filters.paymentStatus) params.set('payment_status', filters.paymentStatus)
      if (filters.productType) params.set('product_type', filters.productType)
      if (filters.startDate) params.set('from_date', filters.startDate)
      if (filters.endDate) params.set('to_date', filters.endDate)
      if (filters.search) params.set('search', filters.search)

      const res = await get(`/admin/bookings?${params.toString()}`)
      setBookings(res.bookings || res.data || [])
      setTotalPages(res.pagination?.total_pages || res.pagination?.totalPages || res.totalPages || 1)
      setTotalItems(res.pagination?.total || res.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  // 필터 값이 바뀌면 무조건 page 1 로 돌아가야 한다. 그래야
  // "검색 걸고 5페이지 → 필터 해제 시 5페이지에 데이터 없음" 같은 꼬임이 없다.
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  // CSV 내보내기. 현재 필터를 그대로 query string 으로 달아 보내고,
  // 서버가 스트림으로 응답하면 downloadFile 이 blob 저장을 처리한다.
  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.paymentStatus) params.set('payment_status', filters.paymentStatus)
      if (filters.productType) params.set('product_type', filters.productType)
      if (filters.startDate) params.set('from_date', filters.startDate)
      if (filters.endDate) params.set('to_date', filters.endDate)
      if (filters.search) params.set('search', filters.search)
      await downloadFile(`/admin/bookings/export?${params.toString()}`, 'bookings.csv')
    } catch (err) {
      alert('Export failed: ' + err.message)
    }
  }

  const formatCurrency = (val) => {
    if (val == null) return '-'
    return '\u20a9' + Number(val).toLocaleString()
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  // DataTable columns 스펙. render 가 없는 필드도 있지만 대부분 가독성을
  // 위해 커스텀 렌더(볼드/뱃지 등) 를 지정한다.
  const columns = [
    {
      key: 'booking_number',
      label: 'Booking #',
      render: (val) => (
        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
          {val || '-'}
        </span>
      ),
    },
    {
      key: 'guest_name',
      label: 'Guest Name',
      render: (val) => val || '-',
    },
    {
      key: 'product_type',
      label: 'Type',
      render: (val) => (
        <span style={{
          fontSize: '0.8rem',
          fontWeight: 500,
          textTransform: 'capitalize',
        }}>
          {val || '-'}
        </span>
      ),
    },
    {
      key: 'check_in',
      label: 'Date',
      render: (val, row) => formatDate(val || row.visit_date || row.created_at),
    },
    {
      key: 'total_price',
      label: 'Total',
      render: (val) => (
        <span style={{ fontWeight: 600 }}>
          {formatCurrency(val)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} type="booking" />,
    },
    {
      key: 'payment_status',
      label: 'Payment',
      render: (val) => (
        <StatusBadge status={val} type="payment" />
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Booking Management</h1>
          <p>Manage and track all customer bookings</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={handleExport}>
            {'\u2B07'} Export CSV
          </button>
          <button className="btn btn-secondary" onClick={loadBookings}>
            {'\u21BB'} Refresh
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="form-control"
          placeholder="Search bookings..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
        />
        <select
          className="form-control"
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <select
          className="form-control"
          value={filters.paymentStatus}
          onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
        >
          <option value="">All Payment</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="refunded">Refunded</option>
          <option value="failed">Failed</option>
        </select>
        <select
          className="form-control"
          value={filters.productType}
          onChange={(e) => handleFilterChange('productType', e.target.value)}
        >
          <option value="">All Types</option>
          <option value="hotel">Hotel</option>
          <option value="ticket">Ticket</option>
          <option value="package">Package</option>
        </select>
        <input
          type="date"
          className="form-control"
          value={filters.startDate}
          onChange={(e) => handleFilterChange('startDate', e.target.value)}
        />
        <input
          type="date"
          className="form-control"
          value={filters.endDate}
          onChange={(e) => handleFilterChange('endDate', e.target.value)}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={columns}
        data={bookings}
        loading={loading}
        onRowClick={(row) => navigate(`/bookings/${row._id || row.id}`)}
        emptyMessage="No bookings found matching your filters"
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
