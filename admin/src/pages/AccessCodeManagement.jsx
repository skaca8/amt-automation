// ============================================================================
// Admin — Access Code 관리 페이지 AccessCodeManagement
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) /admin/access-codes 엔드포인트를 호출해 관리자가 지금까지 발급한
//      구매 게이트용 access code 목록을 테이블로 보여 준다. user email,
//      product type, 사용 카운터, 상태(active/exhausted/revoked) 를 한
//      줄에 표시.
//   2) 화면 상단의 "Issue new code" 버튼으로 Modal 을 열어 새 코드 발급
//      폼(user_id / product_type / product_id / max_uses / valid_until /
//      note)을 받아 POST 한 뒤, 생성된 ACG-XXXX 코드를 복사 가능한 박스로
//      띄운다. 관리자가 이 문자열을 외부 채널(이메일/채팅) 로 유저에게
//      전달해야 유저가 예약 페이지에서 입력할 수 있다.
//   3) 행 우측의 "Revoke" 버튼으로 DELETE /:id (soft revoke) 호출.
//   4) status / product_type 필터 + 페이지네이션.
//
// 렌더링 위치: /access-codes 라우트. 사이드바 "Access Codes" 메뉴 항목.
//
// 주의:
//   - 서버가 POST 응답에 product_is_restricted 힌트를 함께 내려 준다.
//     false 면 "이 상품은 아직 restricted 가 아니어서 코드가 효력 없음"
//     이라는 배너를 띄워 관리자가 상품 플래그를 토글하러 가도록 유도한다.
//   - 유저 / 상품 피커는 단순화를 위해 각각 /admin/users, /api/{hotels,
//     tickets,packages} 공개 목록을 초기 fetch 해서 드롭다운으로 제공.
//     (프로덕션 규모가 아니라 드롭다운 길이 문제는 아직 없음.)
//   - 코드 문자열을 새 창/이메일로 자동 전송하지 않는다. 관리자가 UI 에서
//     "Copy" 버튼을 누르고 직접 전달하는 수동 워크플로 (사용자 지시 확정).
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { get, post, del } from '../utils/api'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'

/**
 * AccessCodeManagement — 관리자 구매 게이트 코드 발급/관리 페이지.
 *
 * 내부 state:
 *   - codes, loading, error, page, totalPages, totalItems, filters
 *       : 목록 관련
 *   - users        : 발급 Modal 의 user 드롭다운 소스
 *   - productsByType : { hotel: [], ticket: [], package: [] } 드롭다운 소스
 *   - modalOpen, form, creating, createdCode
 *       : 발급 Modal 상태
 *
 * 부작용:
 *   - mount 시 GET /admin/users, /api/hotels, /api/tickets, /api/packages
 *     한번씩 호출해 드롭다운 캐시 구축.
 *   - filters 또는 page 변경 시 GET /admin/access-codes 재호출.
 *   - 발급 버튼 → POST /admin/access-codes
 *   - revoke 버튼 → DELETE /admin/access-codes/:id
 */
export default function AccessCodeManagement() {
  // ------------------------------------------------------------------
  // 목록 state
  // ------------------------------------------------------------------
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [filters, setFilters] = useState({ status: '', product_type: '' })

  // ------------------------------------------------------------------
  // 드롭다운 캐시: 발급 모달에서 "유저 / 상품" 을 고를 때 쓴다.
  // 목록이 커지면 서버사이드 검색으로 교체해야 하지만 현재 seed 규모로는
  // 충분.
  // ------------------------------------------------------------------
  const [users, setUsers] = useState([])
  const [productsByType, setProductsByType] = useState({
    hotel: [],
    ticket: [],
    package: [],
  })

  // ------------------------------------------------------------------
  // 발급 모달 state
  //   form        : 입력 필드
  //   creating    : POST 진행 중 플래그
  //   createdCode : 발급 성공 후 서버가 돌려준 access_code row (코드
  //                 문자열을 복사할 수 있게 화면에 띄운다)
  //   createWarn  : "상품이 아직 restricted 가 아님" 경고 메시지
  // ------------------------------------------------------------------
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    user_id: '',
    product_type: 'hotel',
    product_id: '',
    max_uses: 1,
    valid_until: '',
    note: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdCode, setCreatedCode] = useState(null)
  const [createWarn, setCreateWarn] = useState('')

  // ------------------------------------------------------------------
  // 목록 fetch — filters / page 의존성으로 재호출.
  // ------------------------------------------------------------------
  const loadCodes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', page)
      params.set('limit', 20)
      if (filters.status) params.set('status', filters.status)
      if (filters.product_type) params.set('product_type', filters.product_type)
      const res = await get(`/admin/access-codes?${params.toString()}`)
      setCodes(res.access_codes || [])
      setTotalPages(res.pagination?.total_pages || 1)
      setTotalItems(res.pagination?.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { loadCodes() }, [loadCodes])

  // ------------------------------------------------------------------
  // 드롭다운 소스 1회 fetch. 페이지 mount 시 한 번만 실행.
  // ------------------------------------------------------------------
  useEffect(() => {
    const loadDropdowns = async () => {
      try {
        // 사용자 목록: /admin/users (관리자 엔드포인트, 페이지네이션 있지만
        // 첫 50개만 가져와도 드롭다운으로 충분한 데모 규모).
        const userRes = await get('/admin/users?limit=50').catch(() => ({ users: [] }))
        setUsers(userRes.users || [])

        // 상품 목록: 공개 엔드포인트 사용. 관리자 CRUD 엔드포인트는 soft
        // deleted 까지 포함하지만, 발급 대상은 active 상품이면 충분하다.
        const [hotels, tickets, packages] = await Promise.all([
          get('/hotels').catch(() => ({ hotels: [] })),
          get('/tickets').catch(() => ({ tickets: [] })),
          get('/packages').catch(() => ({ packages: [] })),
        ])
        setProductsByType({
          hotel: hotels.hotels || [],
          ticket: tickets.tickets || [],
          package: packages.packages || [],
        })
      } catch (err) {
        // 드롭다운 로딩 실패는 치명적이지 않음 — 관리자가 수동으로 id
        // 입력해도 POST 는 동작한다. 콘솔에만 기록.
        // eslint-disable-next-line no-console
        console.error('Failed to load dropdown sources:', err)
      }
    }
    loadDropdowns()
  }, [])

  // ------------------------------------------------------------------
  // 필터 변경 헬퍼. 1페이지로 리셋 후 재조회는 useEffect 가 담당.
  // ------------------------------------------------------------------
  const handleFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  // ------------------------------------------------------------------
  // 발급 모달 열기/닫기
  // ------------------------------------------------------------------
  const openModal = () => {
    // 모달을 새로 열 때 이전 발급 결과 / 에러를 깨끗이 지운다.
    setForm({
      user_id: '',
      product_type: 'hotel',
      product_id: '',
      max_uses: 1,
      valid_until: '',
      note: '',
    })
    setCreatedCode(null)
    setCreateError('')
    setCreateWarn('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    // 모달을 닫을 때 방금 발급된 코드가 있었으면 리스트를 새로고침해
    // 관리자 화면에 바로 반영되도록 한다.
    if (createdCode) loadCodes()
  }

  // ------------------------------------------------------------------
  // 발급 폼 input change
  // ------------------------------------------------------------------
  const handleInput = (key) => (e) => {
    const val = e.target.value
    setForm((prev) => {
      const next = { ...prev, [key]: val }
      // product_type 을 바꾸면 product_id 선택값을 초기화. 드롭다운에
      // 이전 타입의 id 가 남아 있으면 post 에 잘못된 조합이 섞인다.
      if (key === 'product_type') next.product_id = ''
      return next
    })
  }

  // ------------------------------------------------------------------
  // 발급 POST
  // ------------------------------------------------------------------
  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    setCreateWarn('')
    if (!form.user_id || !form.product_id) {
      setCreateError('Select both a user and a product.')
      return
    }
    setCreating(true)
    try {
      const body = {
        user_id: Number(form.user_id),
        product_type: form.product_type,
        product_id: Number(form.product_id),
        max_uses: Number(form.max_uses) || 1,
        // 빈 문자열은 null 로 보내 서버가 "무기한" 으로 해석하게 한다.
        valid_until: form.valid_until || null,
        note: form.note || null,
      }
      const res = await post('/admin/access-codes', body)
      setCreatedCode(res.access_code)
      // 서버가 product_is_restricted:false 를 돌려주면 관리자가 아직 상품을
      // restricted 로 전환하지 않은 상태 — 코드가 효력 없음을 경고.
      if (res.product_is_restricted === false) {
        setCreateWarn(
          'Heads up: this product is not currently marked as restricted, so the code will not be enforced until you toggle "Restricted" on the product.'
        )
      }
    } catch (err) {
      setCreateError(err.message || 'Failed to create access code.')
    } finally {
      setCreating(false)
    }
  }

  // ------------------------------------------------------------------
  // 행 revoke
  //   DELETE /:id 는 soft revoke (status='revoked') — 이력 남김.
  //   window.confirm 으로 최소 가드. 멱등적이라 중복 호출 안전.
  // ------------------------------------------------------------------
  const handleRevoke = async (row, e) => {
    e.stopPropagation() // 행 클릭 핸들러가 없지만 미래 대비.
    if (!window.confirm(`Revoke code ${row.code}? This cannot be undone.`)) return
    try {
      await del(`/admin/access-codes/${row.id}`)
      loadCodes()
    } catch (err) {
      alert(err.message || 'Failed to revoke code.')
    }
  }

  // ------------------------------------------------------------------
  // 복사 버튼: navigator.clipboard 가 우선, 없으면 fallback textarea.
  // ------------------------------------------------------------------
  const copyCode = async (text) => {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        return
      }
      // 오래된 브라우저 fallback.
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    } catch (err) {
      // 복사 실패는 치명적이지 않음 — 관리자가 직접 선택 후 복사하면 됨.
      // eslint-disable-next-line no-console
      console.error('Copy failed:', err)
    }
  }

  // ------------------------------------------------------------------
  // 테이블 컬럼 정의
  // ------------------------------------------------------------------
  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (val) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>
          {val}
        </span>
      ),
    },
    {
      key: 'user_email',
      label: 'User',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val || '-'}</div>
          {row.user_name && (
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{row.user_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'product_type',
      label: 'Product',
      render: (val, row) => (
        <span style={{ fontSize: '0.85rem' }}>
          {val} #{row.product_id}
        </span>
      ),
    },
    {
      key: 'current_uses',
      label: 'Usage',
      render: (val, row) => (
        <span style={{ fontWeight: 600 }}>
          {val} / {row.max_uses}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        // status 값 별 색상. 기본 badge-pending 스타일을 재활용.
        const cls = val === 'active'
          ? 'badge-active'
          : val === 'exhausted'
            ? 'badge-pending'
            : 'badge-cancelled'
        return <span className={`badge ${cls}`}>{val}</span>
      },
    },
    {
      key: 'valid_until',
      label: 'Valid Until',
      render: (val) => (val ? new Date(val).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) =>
        row.status === 'revoked' ? (
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
        ) : (
          <button
            className="btn btn-danger btn-sm"
            onClick={(e) => handleRevoke(row, e)}
          >
            Revoke
          </button>
        ),
    },
  ]

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Access Codes</h1>
          <p>Issue and manage purchase-gate codes for restricted products</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          + Issue new code
        </button>
      </div>

      <div className="filters-bar">
        <select
          className="form-control"
          value={filters.status}
          onChange={(e) => handleFilter('status', e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="exhausted">Exhausted</option>
          <option value="revoked">Revoked</option>
        </select>
        <select
          className="form-control"
          value={filters.product_type}
          onChange={(e) => handleFilter('product_type', e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="">All product types</option>
          <option value="hotel">Hotel</option>
          <option value="ticket">Ticket</option>
          <option value="package">Package</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        columns={columns}
        data={codes}
        loading={loading}
        emptyMessage="No access codes issued yet"
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={setPage}
      />

      {/* --- 발급 Modal --- */}
      {/*
        Modal 컴포넌트 계약: isOpen prop 으로 표시 여부를 제어한다.
        조건부 렌더링({modalOpen && <Modal />})만으로는 동작하지 않는다 —
        Modal 내부 첫 줄이 `if (!isOpen) return null` 이라 isOpen 이
        falsy 면 빈 화면이 된다. 다른 admin 페이지(HotelManagement 등)와
        동일하게 isOpen 을 명시적으로 전달.
      */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="Issue new access code"
        size="md"
      >
        {/* 서버가 방금 코드를 돌려줬으면 발급 결과 박스, 아니면 폼을 보여 준다. */}
        {createdCode ? (
            <div>
              <p style={{ marginBottom: 12, color: '#16a34a', fontWeight: 600 }}>
                Access code issued successfully.
              </p>
              {createWarn && (
                <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                  {createWarn}
                </div>
              )}
              <div
                style={{
                  background: '#f1f5f9',
                  padding: 16,
                  borderRadius: 8,
                  fontFamily: 'monospace',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  letterSpacing: 1,
                  textAlign: 'center',
                  marginBottom: 12,
                  userSelect: 'all',
                }}
              >
                {createdCode.code}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => copyCode(createdCode.code)}
                >
                  Copy
                </button>
                <button className="btn btn-primary" onClick={closeModal}>
                  Done
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 12 }}>
                Deliver this code to the user manually (email, chat, etc.). They will
                paste it into the booking page to unlock the purchase.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              {createError && (
                <div className="alert alert-error" style={{ marginBottom: 12 }}>
                  {createError}
                </div>
              )}

              <div className="form-group">
                <label>User</label>
                <select
                  className="form-control"
                  value={form.user_id}
                  onChange={handleInput('user_id')}
                  required
                >
                  <option value="">Select a user…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}{u.name ? ` (${u.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Product type</label>
                <select
                  className="form-control"
                  value={form.product_type}
                  onChange={handleInput('product_type')}
                  required
                >
                  <option value="hotel">Hotel</option>
                  <option value="ticket">Ticket</option>
                  <option value="package">Package</option>
                </select>
              </div>

              <div className="form-group">
                <label>Product</label>
                <select
                  className="form-control"
                  value={form.product_id}
                  onChange={handleInput('product_id')}
                  required
                >
                  <option value="">Select a product…</option>
                  {(productsByType[form.product_type] || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {/* 상품 이름은 name_en 우선, 없으면 raw name. id 로 disambiguate. */}
                      #{p.id} — {p.name_en || p.name || 'Untitled'}
                      {p.is_restricted ? ' 🔒' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Max uses</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  value={form.max_uses}
                  onChange={handleInput('max_uses')}
                  required
                />
                <small style={{ color: '#64748b' }}>
                  How many times this single user can book the product with this code.
                </small>
              </div>

              <div className="form-group">
                <label>Valid until (optional)</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.valid_until}
                  onChange={handleInput('valid_until')}
                />
                <small style={{ color: '#64748b' }}>
                  Leave empty for no expiry.
                </small>
              </div>

              <div className="form-group">
                <label>Note (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  maxLength={200}
                  placeholder="Internal memo, e.g. 'VIP — Zhang family trip Feb 2026'"
                  value={form.note}
                  onChange={handleInput('note')}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Issuing…' : 'Issue code'}
                </button>
              </div>
            </form>
          )}
      </Modal>
    </div>
  )
}
