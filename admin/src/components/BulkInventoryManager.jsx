// ============================================================================
// Admin — 대량 재고 관리 컴포넌트 BulkInventoryManager
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 상품(호텔 객실/티켓/패키지)에 대해 "날짜 범위 + 요일" 기반 대량 재고·
//      가격 설정을 한 번에 수행한다. 백엔드의 bulk 엔드포인트를 호출한다.
//   2) 설정된 재고 달력을 표로 조회하고, 각 행을 인라인 편집해 단일 날짜의
//      가격·총량을 수정할 수 있다.
//   3) 예약된 수량(booked) 대비 총량(total) 비율에 따라 행 배경색과
//      상태 배지(Available/Filling/Sold Out/No Stock) 를 계산한다.
//
// productType: 'room' | 'ticket' | 'package'
//   - room    : HotelManagement 의 객실 타입 상세에서 사용. 식별자는 room_type_id.
//   - ticket  : TicketManagement 의 티켓 상세에서 사용. 식별자는 ticket_id.
//   - package : PackageManagement 의 패키지 상세에서 사용. 식별자는 package_id.
//
// Props:
//   - productType : 위 세 값 중 하나.
//   - productId   : 대상 엔티티 id (room_type id / ticket id / package id).
//   - onSave      : (선택) 저장 성공 시 부모에게 알려주는 콜백. 부모가 요약
//                   패널(총 재고 등)을 refetch 할 때 사용한다.
//
// API 엔드포인트:
//   GET  /admin/products/{type}-inventory/{productId}?from_date=&to_date=
//   PUT  /admin/products/{type}-inventory            (단일 날짜 업데이트; 구버전)
//   POST /admin/products/{type}-inventory/bulk        (범위 + 요일 대량 갱신)
//
// 주의:
//   - 저장 실패 시 사용자에게 alert 로 에러를 노출한다. 상위 컴포넌트가 toast
//     시스템을 갖추고 있지 않기 때문.
//   - 응답 스키마가 프로젝트 초반과 후반에서 달라진 탓에, inventory 행의
//     필드를 읽을 때 quantity / total_rooms / total_quantity 같은 여러 키를
//     순차적으로 시도한다(fallback chain).
//   - saveEdit 은 PUT 을 먼저 시도하고 실패하면 bulk POST 로 자동 폴백한다.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put } from '../utils/api'

// 요일 라벨. 월 기준 0~6 인덱스. 한글/영어 동시 표기용.
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KR = ['월', '화', '수', '목', '금', '토', '일']

// ---------------------------------------------------------------------------
// 날짜 유틸 — toISOString() 은 UTC 기준으로 찍혀 타임존이 틀어지는 경우가 있어
// 로컬 year/month/day 를 수동으로 YYYY-MM-DD 로 만든다.
// ---------------------------------------------------------------------------
function formatDate(d) {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 문자열 날짜 + N일. Date 인스턴스의 setDate 는 월/년 넘어감을 자동 처리한다.
function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

// 오늘 날짜를 YYYY-MM-DD 로.
function todayStr() {
  return formatDate(new Date())
}

const styles = {
  container: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '18px 24px',
    background: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#fff',
  },
  sectionTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
  },
  sectionSubtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    margin: 0,
  },
  section: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
  },
  sectionLast: {
    padding: '20px 24px',
  },
  row: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
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
    minWidth: 120,
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  daysRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  dayCheck: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    userSelect: 'none',
    transition: 'all 0.15s',
  },
  dayChecked: {
    background: '#eff6ff',
    borderColor: '#3b82f6',
    color: '#3b82f6',
  },
  dayUnchecked: {
    background: '#fff',
    borderColor: '#e2e8f0',
    color: '#64748b',
  },
  btnApply: {
    padding: '10px 28px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    background: '#3b82f6',
    color: '#fff',
    transition: 'opacity 0.15s',
  },
  btn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'inherit',
  },
  btnSecondary: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
  },
  btnSmPrimary: {
    padding: '4px 10px',
    fontSize: '0.8rem',
    background: '#3b82f6',
    color: '#fff',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  btnSmSecondary: {
    padding: '4px 10px',
    fontSize: '0.8rem',
    background: '#f1f5f9',
    color: '#475569',
    borderRadius: 4,
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 500,
  },
  success: {
    padding: '10px 14px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 8,
    color: '#166534',
    fontSize: '0.85rem',
    marginTop: 12,
    fontWeight: 500,
  },
  error: {
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    color: '#991b1b',
    fontSize: '0.85rem',
    marginTop: 12,
    fontWeight: 500,
  },
  tableWrap: {
    overflowX: 'auto',
    maxHeight: 480,
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid #e2e8f0',
    fontWeight: 700,
    color: '#475569',
    whiteSpace: 'nowrap',
    fontSize: '0.8rem',
    position: 'sticky',
    top: 0,
    background: '#fff',
    zIndex: 1,
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #f1f5f9',
    whiteSpace: 'nowrap',
  },
  editInput: {
    padding: '4px 8px',
    border: '1px solid #3b82f6',
    borderRadius: 4,
    fontSize: '0.85rem',
    width: 90,
    outline: 'none',
    fontFamily: 'inherit',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
}

function getRowStyle(booked, total) {
  if (total <= 0) return { background: '#f8fafc', color: '#94a3b8' } // gray - no inventory
  const ratio = booked / total
  if (ratio >= 1) return { background: '#fef2f2' } // red - fully booked
  if (ratio >= 0.7) return { background: '#fffbeb' } // yellow - >70%
  return { background: '#f0fdf4' } // green - available
}

function getStatusInfo(booked, total) {
  if (total <= 0) return { label: 'No Stock', bg: '#f1f5f9', color: '#64748b' }
  const ratio = booked / total
  if (ratio >= 1) return { label: 'Sold Out', bg: '#fef2f2', color: '#ef4444' }
  if (ratio >= 0.7) return { label: 'Filling', bg: '#fffbeb', color: '#f59e0b' }
  return { label: 'Available', bg: '#dcfce7', color: '#22c55e' }
}

export default function BulkInventoryManager({ productType, productId, onSave }) {
  const typeLabel = productType === 'room' ? 'Rooms' : 'Quantity'
  const idField = productType === 'room' ? 'room_type_id' : productType === 'ticket' ? 'ticket_id' : 'package_id'

  // Bulk set state
  const [bulkStart, setBulkStart] = useState(todayStr())
  const [bulkEnd, setBulkEnd] = useState(addDays(todayStr(), 30))
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkQuantity, setBulkQuantity] = useState('')
  const [daysOfWeek, setDaysOfWeek] = useState([0, 1, 2, 3, 4, 5, 6])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMessage, setBulkMessage] = useState(null)

  // Inventory table state
  const [viewStart, setViewStart] = useState(todayStr())
  const [viewEnd, setViewEnd] = useState(addDays(todayStr(), 60))
  const [inventory, setInventory] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [editValues, setEditValues] = useState({ price: '', quantity: '' })

  const loadInventory = useCallback(async () => {
    if (!productId) return
    setTableLoading(true)
    try {
      const endpoint = `/admin/products/${productType}-inventory/${productId}?from_date=${viewStart}&to_date=${viewEnd}`
      const res = await get(endpoint)
      setInventory(res.inventory || res.data || res || [])
    } catch {
      setInventory([])
    } finally {
      setTableLoading(false)
    }
  }, [productType, productId, viewStart, viewEnd])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  const toggleDay = (dayIndex) => {
    if (daysOfWeek.includes(dayIndex)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== dayIndex))
    } else {
      setDaysOfWeek([...daysOfWeek, dayIndex].sort())
    }
  }

  const applyBulk = async () => {
    if (!bulkStart || !bulkEnd) {
      alert('Please select start and end dates.')
      return
    }
    if (!bulkPrice && !bulkQuantity) {
      alert('Please enter at least a price or quantity.')
      return
    }
    setBulkLoading(true)
    setBulkMessage(null)
    try {
      const body = {
        [idField]: productId,
        start_date: bulkStart,
        end_date: bulkEnd,
        days_of_week: daysOfWeek,
      }
      if (bulkPrice !== '') {
        body.price = Number(bulkPrice)
      }
      if (bulkQuantity !== '') {
        body[productType === 'room' ? 'total_rooms' : 'total_quantity'] = Number(bulkQuantity)
      }

      const res = await post(`/admin/products/${productType}-inventory/bulk`, body)
      const count = res.updated_count || res.count || res.updated || 'multiple'
      setBulkMessage({ type: 'success', text: `Successfully updated ${count} date(s).` })
      loadInventory()
      if (onSave) onSave()
    } catch (err) {
      setBulkMessage({ type: 'error', text: 'Failed: ' + err.message })
    } finally {
      setBulkLoading(false)
    }
  }

  const startEdit = (inv, index) => {
    setEditingRow(index)
    setEditValues({
      price: inv.price ?? '',
      quantity: inv.quantity ?? inv.total_rooms ?? inv.total_quantity ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setEditValues({ price: '', quantity: '' })
  }

  const saveEdit = async (inv) => {
    try {
      const typeIdField = productType === 'room' ? 'room_type_id' : productType === 'ticket' ? 'ticket_id' : 'package_id'
      const body = {
        [typeIdField]: productId,
        items: [{
          date: formatDate(inv.date),
          total: editValues.quantity !== '' ? Number(editValues.quantity) : undefined,
          price: editValues.price !== '' ? Number(editValues.price) : undefined,
        }],
      }
      try {
        await put(`/admin/products/${productType}-inventory`, body)
      } catch {
        // Fallback to bulk endpoint with single-day range
        const fallback = {
          [idField]: productId,
          start_date: formatDate(inv.date),
          end_date: formatDate(inv.date),
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
        }
        if (editValues.price !== '') fallback.price = Number(editValues.price)
        if (editValues.quantity !== '') {
          fallback[productType === 'room' ? 'total_rooms' : 'total_quantity'] = Number(editValues.quantity)
        }
        await post(`/admin/products/${productType}-inventory/bulk`, fallback)
      }
      setEditingRow(null)
      loadInventory()
      if (onSave) onSave()
    } catch (err) {
      alert('Save failed: ' + err.message)
    }
  }

  const handleEditKeyDown = (e, inv) => {
    if (e.key === 'Enter') saveEdit(inv)
    if (e.key === 'Escape') cancelEdit()
  }

  const getDayKr = (dateStr) => {
    const d = new Date(dateStr)
    const jsDay = d.getDay() // 0=Sun
    const idx = jsDay === 0 ? 6 : jsDay - 1
    return DAY_KR[idx]
  }

  const getDayName = (dateStr) => {
    const d = new Date(dateStr)
    const jsDay = d.getDay()
    const idx = jsDay === 0 ? 6 : jsDay - 1
    return DAY_NAMES[idx]
  }

  const formatCurrency = (v) => v != null ? '\u20a9' + Number(v).toLocaleString() : '-'

  return (
    <div style={styles.container}>
      {/* Section A: Bulk Set by Date Range */}
      <div style={styles.sectionHeader}>
        <div style={{ ...styles.sectionIcon, background: '#3b82f6' }}>A</div>
        <div>
          <h4 style={styles.sectionTitle}>{'\uC77C\uAD04 \uC7AC\uACE0 \uC124\uC815'} (Bulk Set by Date Range)</h4>
          <p style={styles.sectionSubtitle}>Set pricing and availability for a range of dates at once</p>
        </div>
      </div>
      <div style={styles.section}>
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <span style={styles.label}>Start Date</span>
            <input
              type="date"
              style={styles.input}
              value={bulkStart}
              onChange={(e) => setBulkStart(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>End Date</span>
            <input
              type="date"
              style={styles.input}
              value={bulkEnd}
              onChange={(e) => setBulkEnd(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>{'\uAC00\uACA9'} Price ({'\u20a9'})</span>
            <input
              type="number"
              style={{ ...styles.input, minWidth: 140 }}
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              placeholder="\u20a9 Enter price"
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>{'\uC218\uB7C9'} {typeLabel}</span>
            <input
              type="number"
              style={styles.input}
              min={0}
              value={bulkQuantity}
              onChange={(e) => setBulkQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ ...styles.label, display: 'block', marginBottom: 8 }}>{'\uC694\uC77C \uC120\uD0DD'} (Days of Week)</span>
          <div style={styles.daysRow}>
            {DAY_NAMES.map((day, i) => (
              <div
                key={i}
                style={{
                  ...styles.dayCheck,
                  ...(daysOfWeek.includes(i) ? styles.dayChecked : styles.dayUnchecked),
                }}
                onClick={() => toggleDay(i)}
              >
                <input
                  type="checkbox"
                  checked={daysOfWeek.includes(i)}
                  onChange={() => toggleDay(i)}
                  style={{ margin: 0, cursor: 'pointer' }}
                />
                {day} ({DAY_KR[i]})
              </div>
            ))}
          </div>
        </div>

        <button
          style={{ ...styles.btnApply, opacity: bulkLoading ? 0.7 : 1 }}
          onClick={applyBulk}
          disabled={bulkLoading}
        >
          {bulkLoading ? 'Applying...' : '\uC801\uC6A9 Apply to Range'}
        </button>

        {bulkMessage && (
          <div style={bulkMessage.type === 'success' ? styles.success : styles.error}>
            {bulkMessage.text}
          </div>
        )}
      </div>

      {/* Section B: Inventory Calendar/Table View */}
      <div style={styles.sectionHeader}>
        <div style={{ ...styles.sectionIcon, background: '#22c55e' }}>B</div>
        <div>
          <h4 style={styles.sectionTitle}>{'\uC7AC\uACE0 \uD604\uD669'} (Inventory Calendar View)</h4>
          <p style={styles.sectionSubtitle}>View and edit daily inventory. Click a row to edit inline.</p>
        </div>
      </div>
      <div style={styles.sectionLast}>
        <div style={{ ...styles.row, marginBottom: 16 }}>
          <div style={styles.formGroup}>
            <span style={styles.label}>From Date</span>
            <input
              type="date"
              style={styles.input}
              value={viewStart}
              onChange={(e) => setViewStart(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>To Date</span>
            <input
              type="date"
              style={styles.input}
              value={viewEnd}
              onChange={(e) => setViewEnd(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={loadInventory}
              disabled={tableLoading}
            >
              {tableLoading ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>

        <div style={styles.tableWrap}>
          {tableLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto', width: 24, height: 24 }} />
              <p style={{ marginTop: 8 }}>Loading inventory...</p>
            </div>
          ) : inventory.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
              No inventory data for this date range. Use Section A above to set inventory.
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>{'\uC694\uC77C'} (Day)</th>
                  <th style={styles.th}>{'\uAC00\uACA9'} Price ({'\u20a9'})</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Booked</th>
                  <th style={styles.th}>Available</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, width: 110 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((inv, i) => {
                  const total = inv.quantity ?? inv.total_rooms ?? inv.total_quantity ?? 0
                  const booked = inv.booked ?? inv.booked_quantity ?? inv.booked_rooms ?? 0
                  const available = inv.available ?? inv.available_quantity ?? inv.available_rooms ?? (total - booked)
                  const rowStyle = getRowStyle(booked, total)
                  const status = getStatusInfo(booked, total)
                  const isEditing = editingRow === i

                  return (
                    <tr key={i} style={rowStyle}>
                      <td style={{ ...styles.td, fontWeight: 500 }}>{formatDate(inv.date)}</td>
                      <td style={styles.td}>{getDayName(inv.date)} ({getDayKr(inv.date)})</td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={styles.editInput}
                            value={editValues.price}
                            onChange={(e) => setEditValues({ ...editValues, price: e.target.value })}
                            onKeyDown={(e) => handleEditKeyDown(e, inv)}
                            autoFocus
                          />
                        ) : (
                          <span style={{ fontWeight: 600 }}>{formatCurrency(inv.price)}</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={styles.editInput}
                            min={0}
                            value={editValues.quantity}
                            onChange={(e) => setEditValues({ ...editValues, quantity: e.target.value })}
                            onKeyDown={(e) => handleEditKeyDown(e, inv)}
                          />
                        ) : (
                          total
                        )}
                      </td>
                      <td style={styles.td}>{booked}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{available}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusBadge,
                          background: status.bg,
                          color: status.color,
                        }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button style={styles.btnSmPrimary} onClick={() => saveEdit(inv)}>
                              Save
                            </button>
                            <button style={styles.btnSmSecondary} onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            style={styles.btnSmSecondary}
                            onClick={() => startEdit(inv, i)}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
