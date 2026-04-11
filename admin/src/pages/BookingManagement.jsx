import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, downloadFile } from '../utils/api'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import StatusBadge from '../components/StatusBadge'

export default function BookingManagement() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [filters, setFilters] = useState({
    status: '',
    paymentStatus: '',
    productType: '',
    startDate: '',
    endDate: '',
    search: '',
  })

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', page)
      params.set('limit', 20)
      if (filters.status) params.set('status', filters.status)
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
      if (filters.productType) params.set('productType', filters.productType)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.search) params.set('search', filters.search)

      const res = await get(`/admin/bookings?${params.toString()}`)
      setBookings(res.data || res.bookings || [])
      setTotalPages(res.totalPages || res.pagination?.totalPages || 1)
      setTotalItems(res.total || res.pagination?.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
      if (filters.productType) params.set('productType', filters.productType)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
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

  const columns = [
    {
      key: 'bookingNumber',
      label: 'Booking #',
      render: (val, row) => (
        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
          {val || row.booking_number || '-'}
        </span>
      ),
    },
    {
      key: 'guestName',
      label: 'Guest Name',
      render: (val, row) => val || row.guest_name || row.user?.name || '-',
    },
    {
      key: 'productName',
      label: 'Product',
      render: (val, row) => val || row.product_name || row.product?.name_en || '-',
    },
    {
      key: 'productType',
      label: 'Type',
      render: (val, row) => {
        const type = val || row.product_type || '-'
        return (
          <span style={{
            fontSize: '0.8rem',
            fontWeight: 500,
            textTransform: 'capitalize',
          }}>
            {type}
          </span>
        )
      },
    },
    {
      key: 'date',
      label: 'Date',
      render: (val, row) => formatDate(val || row.checkInDate || row.check_in_date),
    },
    {
      key: 'totalAmount',
      label: 'Total',
      render: (val, row) => (
        <span style={{ fontWeight: 600 }}>
          {formatCurrency(val || row.total_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} type="booking" />,
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (val, row) => (
        <StatusBadge status={val || row.payment_status} type="payment" />
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
