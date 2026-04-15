// ============================================================================
// Admin — 프로모션 관리 임베드 컴포넌트 PromotionManager
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 상품 상세 페이지(호텔/티켓/패키지) 안에 끼워 넣는 프로모션 CRUD UI.
//      필요 시 productType/productId 로 필터링해 "이 상품에 걸린 프로모션만"
//      보여 줄 수 있고, 아무 필터도 없이 전체 조회도 가능하다.
//   2) 프로모션 생성/수정 폼(금액·정률, 적용 기간, 블랙아웃 기간 등) 을
//      포함하며, 블랙아웃은 배열로 여러 구간을 추가/삭제할 수 있다.
//   3) 생성/수정/삭제 모두 /api/admin/promotions 엔드포인트를 호출한다.
//
// Props:
//   - productType : (선택) 'hotel' | 'ticket' | 'package'. 전달되면 목록을
//                   해당 타입으로 필터링하고, 신규 폼의 기본값으로 채운다.
//   - productId   : (선택) 특정 상품 id. 있으면 상품 전용 프로모션만 조회.
//
// 백엔드 스키마 주의:
//   - blackout_dates 는 DB 에 JSON 문자열로 저장돼 있을 수도, 이미 배열로
//     직렬화돼 내려올 수도 있다. 로드/저장 양쪽에서 방어 파싱을 한다.
//   - discount_value 는 정수/소수 모두 허용. UI 에서는 문자열로 다루고
//     저장 직전에 Number() 로 변환한다.
//   - id 는 프로젝트 일부 구간에서 _id (Mongo 스타일) 로 내려올 때가 있어
//     promo._id || promo.id 패턴을 사용한다.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put, del } from '../utils/api'

// 새 프로모션 폼의 초기값 템플릿. openAdd 시 spread 해서 form 에 복사한다.
const emptyPromotion = {
  name: '',
  discount_type: 'percentage',
  discount_value: '',
  product_type: 'all',
  product_id: '',
  start_date: '',
  end_date: '',
  status: 'active',
  blackout_dates: [],
}

// 블랙아웃 기간 한 건의 초기값. reason 은 선택 필드라 빈 문자열로 시작.
const emptyBlackout = { start_date: '', end_date: '', reason: '' }

const styles = {
  container: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
  title: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    margin: 0,
  },
  btn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },
  btnPrimary: {
    background: '#3b82f6',
    color: '#fff',
  },
  btnSecondary: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
  },
  btnDanger: {
    background: '#fef2f2',
    color: '#ef4444',
    border: '1px solid #fecaca',
  },
  btnSm: {
    padding: '4px 10px',
    fontSize: '0.8rem',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    borderBottom: '2px solid #e2e8f0',
    fontWeight: 700,
    color: '#475569',
    whiteSpace: 'nowrap',
    fontSize: '0.8rem',
  },
  td: {
    padding: '10px 14px',
    borderBottom: '1px solid #f1f5f9',
    whiteSpace: 'nowrap',
  },
  form: {
    padding: 20,
    borderBottom: '1px solid #e2e8f0',
    background: '#fafbfc',
  },
  formRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 160,
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#475569',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: '0.875rem',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: '0.875rem',
    outline: 'none',
    fontFamily: 'inherit',
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  },
  radioRow: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.85rem',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 500,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  badgeActive: {
    background: '#dcfce7',
    color: '#166534',
  },
  badgeInactive: {
    background: '#f1f5f9',
    color: '#64748b',
  },
  discountDisplay: {
    fontWeight: 700,
    color: '#3b82f6',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.9rem',
  },
  valueInput: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  prefix: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#475569',
  },
  blackoutSection: {
    marginTop: 16,
    padding: 16,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
  },
  blackoutTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blackoutEntry: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
    marginBottom: 8,
    padding: 10,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
    flexWrap: 'wrap',
  },
  blackoutEmpty: {
    padding: 16,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.85rem',
    fontStyle: 'italic',
  },
}

// 테이블 셀 표시용 포맷터. percentage 면 '%', fixed 면 원화 기호 + 천 단위.
function formatDiscount(type, value) {
  if (type === 'percentage') return `${value}%`
  return `\u20a9${Number(value).toLocaleString()}`
}

/**
 * PromotionManager — 임베드형 프로모션 CRUD.
 *
 * Props: productType / productId (둘 다 선택). 필터가 있으면 상품 전용 목록,
 * 없으면 전체 프로모션 목록을 조회한다.
 *
 * 반환 UI:
 *   - 상단 헤더: 타이틀 + "+ Add Promotion" 버튼
 *   - 폼(showForm=true 일 때만): 이름/상태/할인 타입/값/적용 상품 범위/기간/
 *     블랙아웃 리스트/저장-취소 버튼
 *   - 표: 현재 등록된 프로모션 목록과 Edit/Delete 액션
 *
 * 부작용:
 *   - GET/POST/PUT/DELETE /admin/promotions
 *   - 삭제 시 window.confirm 으로 확인.
 *   - 실패 시 alert() 으로 에러 노출.
 */
export default function PromotionManager({ productType, productId }) {
  // promotions : 서버에서 받아온 프로모션 목록
  // loading    : 첫 로딩 + reload 중 skeleton 플래그
  // showForm   : 폼 영역의 확장 여부
  // editing    : 편집 모드일 때 원본 프로모션 객체. null 이면 신규 추가 모드.
  // form       : 현재 편집 중인 필드 값들 (controlled)
  // saving     : 저장 중 버튼 disable 플래그
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyPromotion })
  const [saving, setSaving] = useState(false)

  // ----------------------------------------------------------------------
  // 목록 조회. 쿼리 파라미터는 productType/productId 가 있을 때만 추가한다.
  // 응답은 promotions / data / 루트 배열 세 가지 중 하나를 허용.
  // ----------------------------------------------------------------------
  const loadPromotions = useCallback(async () => {
    setLoading(true)
    try {
      let path = '/admin/promotions'
      const params = []
      if (productType) params.push(`product_type=${productType}`)
      if (productId) params.push(`product_id=${productId}`)
      if (params.length > 0) path += '?' + params.join('&')

      const res = await get(path)
      setPromotions(res.promotions || res.data || res || [])
    } catch {
      setPromotions([])
    } finally {
      setLoading(false)
    }
  }, [productType, productId])

  useEffect(() => {
    loadPromotions()
  }, [loadPromotions])

  // 신규 추가 폼 열기. 부모에서 내려온 productType/productId 가 있으면
  // 바로 그 값으로 채워 줘 "현재 상품 한정" 프로모션을 만들기 쉽게 한다.
  const openAdd = () => {
    setEditing(null)
    setForm({
      ...emptyPromotion,
      product_type: productType || 'all',
      product_id: productId || '',
      blackout_dates: [],
    })
    setShowForm(true)
  }

  // ----------------------------------------------------------------------
  // 편집 폼 열기. 기존 프로모션 값을 form 에 복사한다.
  //   - blackout_dates 가 문자열(JSON) 이면 파싱, 배열이면 그대로, 그 외에는 빈 배열.
  //   - start_date/end_date 는 ISO 문자열일 수 있어 앞 10글자만 잘라
  //     <input type="date"> 가 받는 YYYY-MM-DD 로 맞춘다.
  //   - discount_value 는 discount_value / value 두 필드명을 순차 fallback.
  // ----------------------------------------------------------------------
  const openEdit = (promo) => {
    setEditing(promo)
    let blackouts = []
    if (promo.blackout_dates) {
      if (typeof promo.blackout_dates === 'string') {
        try { blackouts = JSON.parse(promo.blackout_dates) } catch { blackouts = [] }
      } else if (Array.isArray(promo.blackout_dates)) {
        blackouts = promo.blackout_dates
      }
    }
    setForm({
      name: promo.name || '',
      discount_type: promo.discount_type || 'percentage',
      discount_value: promo.discount_value ?? promo.value ?? '',
      product_type: promo.product_type || 'all',
      product_id: promo.product_id || '',
      start_date: promo.start_date ? promo.start_date.substring(0, 10) : '',
      end_date: promo.end_date ? promo.end_date.substring(0, 10) : '',
      status: promo.status || 'active',
      blackout_dates: blackouts,
    })
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ ...emptyPromotion })
  }

  // 블랙아웃 목록 헬퍼 — 배열 상태를 불변으로 갱신한다.
  // 새 항목 추가: 기본값 템플릿을 push.
  const addBlackoutEntry = () => {
    setForm({
      ...form,
      blackout_dates: [...form.blackout_dates, { ...emptyBlackout }],
    })
  }

  const updateBlackoutEntry = (index, field, value) => {
    const updated = [...form.blackout_dates]
    updated[index] = { ...updated[index], [field]: value }
    setForm({ ...form, blackout_dates: updated })
  }

  const removeBlackoutEntry = (index) => {
    setForm({
      ...form,
      blackout_dates: form.blackout_dates.filter((_, i) => i !== index),
    })
  }

  // ----------------------------------------------------------------------
  // 저장 핸들러. editing 이 있으면 PUT, 없으면 POST.
  // 백엔드가 blackout_dates 를 DB 에 JSON 문자열로 저장하므로, 프런트에서
  // 미리 JSON.stringify 해서 보낸다. 빈 배열도 "[]" 로 보내야 기존 값을 지운다.
  // ----------------------------------------------------------------------
  const savePromotion = async () => {
    if (!form.name) {
      alert('Please enter a promotion name.')
      return
    }
    if (!form.discount_value) {
      alert('Please enter a discount value.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        discount_value: Number(form.discount_value),
        blackout_dates: JSON.stringify(form.blackout_dates || []),
      }
      if (editing) {
        // id 필드가 _id / id 로 뒤섞여 있을 수 있어 둘 중 존재하는 것을 사용.
        await put(`/admin/promotions/${editing._id || editing.id}`, payload)
      } else {
        await post('/admin/promotions', payload)
      }
      setShowForm(false)
      setEditing(null)
      setForm({ ...emptyPromotion })
      loadPromotions()
    } catch (err) {
      alert('Failed to save promotion: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const deletePromotion = async (promo) => {
    if (!window.confirm(`Delete promotion "${promo.name}"?`)) return
    try {
      await del(`/admin/promotions/${promo._id || promo.id}`)
      loadPromotions()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  // 테이블 셀에 "3 period(s)" 식으로 간략 표시하기 위한 집계.
  // 로드 시의 blackout_dates 파싱 로직과 동일.
  const formatBlackoutSummary = (promo) => {
    let blackouts = []
    if (promo.blackout_dates) {
      if (typeof promo.blackout_dates === 'string') {
        try { blackouts = JSON.parse(promo.blackout_dates) } catch { blackouts = [] }
      } else if (Array.isArray(promo.blackout_dates)) {
        blackouts = promo.blackout_dates
      }
    }
    if (!blackouts || blackouts.length === 0) return 'None'
    return `${blackouts.length} period(s)`
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h4 style={styles.title}>{'\uD504\uB85C\uBAA8\uC158 \uAD00\uB9AC'} (Promotions)</h4>
          <p style={styles.subtitle}>Manage discount promotions and blackout periods</p>
        </div>
        <button
          style={{ ...styles.btn, ...styles.btnPrimary }}
          onClick={openAdd}
        >
          + Add Promotion
        </button>
      </div>

      {showForm && (
        <div style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <span style={styles.label}>Name *</span>
              <input
                style={styles.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Early Bird Discount"
              />
            </div>
            <div style={styles.formGroup}>
              <span style={styles.label}>Status</span>
              <select
                style={styles.select}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <span style={styles.label}>Discount Type</span>
              <div style={{ ...styles.radioRow, marginTop: 4 }}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="discount_type"
                    value="fixed"
                    checked={form.discount_type === 'fixed'}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                  />
                  {'\uC815\uC561'} (Fixed {'\u20a9'})
                </label>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="discount_type"
                    value="percentage"
                    checked={form.discount_type === 'percentage'}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                  />
                  {'\uC815\uB960'} (Percentage %)
                </label>
              </div>
            </div>
            <div style={styles.formGroup}>
              <span style={styles.label}>Discount Value *</span>
              <div style={styles.valueInput}>
                {form.discount_type === 'fixed' && (
                  <span style={styles.prefix}>{'\u20a9'}</span>
                )}
                <input
                  type="number"
                  style={styles.input}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === 'fixed' ? '5000' : '10'}
                  min={0}
                />
                {form.discount_type === 'percentage' && (
                  <span style={styles.prefix}>%</span>
                )}
              </div>
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <span style={styles.label}>Product Type</span>
              <select
                style={styles.select}
                value={form.product_type}
                onChange={(e) => setForm({ ...form, product_type: e.target.value })}
              >
                <option value="all">All</option>
                <option value="hotel">Hotel</option>
                <option value="ticket">Ticket</option>
                <option value="package">Package</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <span style={styles.label}>Product ID (optional)</span>
              <input
                style={styles.input}
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                placeholder="Leave empty for all products"
              />
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <span style={styles.label}>Start Date</span>
              <input
                type="date"
                style={styles.input}
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <span style={styles.label}>End Date</span>
              <input
                type="date"
                style={styles.input}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* Blackout Dates Section */}
          <div style={styles.blackoutSection}>
            <div style={styles.blackoutTitle}>
              <span>{'\uBE14\uB799\uC544\uC6C3 \uAE30\uAC04'} (Blackout Dates)</span>
              <button
                style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSm }}
                onClick={addBlackoutEntry}
              >
                + Add Blackout Period
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 0, marginBottom: 12 }}>
              Periods when this promotion does NOT apply.
            </p>

            {form.blackout_dates.length === 0 ? (
              <div style={styles.blackoutEmpty}>
                No blackout periods. This promotion applies to all dates within its range.
              </div>
            ) : (
              form.blackout_dates.map((bo, idx) => (
                <div key={idx} style={styles.blackoutEntry}>
                  <div style={{ ...styles.formGroup, flex: 'none', minWidth: 140 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b' }}>Start</span>
                    <input
                      type="date"
                      style={{ ...styles.input, borderColor: '#fecaca' }}
                      value={bo.start_date}
                      onChange={(e) => updateBlackoutEntry(idx, 'start_date', e.target.value)}
                    />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 'none', minWidth: 140 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b' }}>End</span>
                    <input
                      type="date"
                      style={{ ...styles.input, borderColor: '#fecaca' }}
                      value={bo.end_date}
                      onChange={(e) => updateBlackoutEntry(idx, 'end_date', e.target.value)}
                    />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 1, minWidth: 120 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b' }}>Reason (optional)</span>
                    <input
                      style={{ ...styles.input, borderColor: '#fecaca' }}
                      value={bo.reason}
                      onChange={(e) => updateBlackoutEntry(idx, 'reason', e.target.value)}
                      placeholder="e.g. Holiday peak"
                    />
                  </div>
                  <button
                    style={{
                      ...styles.btn,
                      ...styles.btnDanger,
                      ...styles.btnSm,
                      marginBottom: 0,
                      alignSelf: 'flex-end',
                    }}
                    onClick={() => removeBlackoutEntry(idx)}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              style={{ ...styles.btn, ...styles.btnPrimary, opacity: saving ? 0.7 : 1 }}
              onClick={savePromotion}
              disabled={saving}
            >
              {saving ? 'Saving...' : editing ? 'Update Promotion' : 'Create Promotion'}
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={cancelForm}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.empty}>
            <div className="spinner" style={{ margin: '0 auto', width: 24, height: 24 }} />
            <p style={{ marginTop: 8 }}>Loading promotions...</p>
          </div>
        ) : promotions.length === 0 ? (
          <div style={styles.empty}>
            No promotions found. Click "+ Add Promotion" to create one.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Value</th>
                <th style={styles.th}>Period</th>
                <th style={styles.th}>Blackout</th>
                <th style={styles.th}>Status</th>
                <th style={{ ...styles.th, width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promo) => {
                const pid = promo._id || promo.id
                const dtype = promo.discount_type || 'percentage'
                const dvalue = promo.discount_value ?? promo.value ?? 0
                return (
                  <tr key={pid}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{promo.name}</td>
                    <td style={styles.td}>
                      {dtype === 'fixed' ? '\uC815\uC561 (Fixed)' : '\uC815\uB960 (%)'}
                    </td>
                    <td style={{ ...styles.td, ...styles.discountDisplay }}>
                      {formatDiscount(dtype, dvalue)}
                    </td>
                    <td style={styles.td}>
                      {promo.start_date ? promo.start_date.substring(0, 10) : '-'}
                      {' ~ '}
                      {promo.end_date ? promo.end_date.substring(0, 10) : '-'}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        fontSize: '0.8rem',
                        color: formatBlackoutSummary(promo) === 'None' ? '#94a3b8' : '#ef4444',
                        fontWeight: formatBlackoutSummary(promo) === 'None' ? 400 : 600,
                      }}>
                        {formatBlackoutSummary(promo)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(promo.status === 'active' ? styles.badgeActive : styles.badgeInactive),
                        }}
                      >
                        {promo.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          style={{ ...styles.btn, ...styles.btnSecondary, ...styles.btnSm }}
                          onClick={() => openEdit(promo)}
                        >
                          Edit
                        </button>
                        <button
                          style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSm }}
                          onClick={() => deletePromotion(promo)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
