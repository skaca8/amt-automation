import React, { useState, useEffect, useCallback } from 'react'
import { get, post } from '../utils/api'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function formatDate(d) {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

function todayStr() {
  return formatDate(new Date())
}

const styles = {
  container: {
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  section: {
    padding: 20,
    borderBottom: '1px solid #e2e8f0',
  },
  sectionLast: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: 16,
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
    fontWeight: 500,
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
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 500,
    userSelect: 'none',
    transition: 'background 0.15s, border-color 0.15s',
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
  btn: {
    padding: '8px 20px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    fontFamily: 'inherit',
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
  success: {
    padding: '8px 12px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 6,
    color: '#166534',
    fontSize: '0.85rem',
    marginTop: 8,
  },
  error: {
    padding: '8px 12px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
    color: '#991b1b',
    fontSize: '0.85rem',
    marginTop: 8,
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
    padding: '10px 12px',
    borderBottom: '2px solid #e2e8f0',
    fontWeight: 600,
    color: '#475569',
    whiteSpace: 'nowrap',
    fontSize: '0.8rem',
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
    width: 80,
    outline: 'none',
    fontFamily: 'inherit',
  },
}

function getRowColor(booked, total) {
  if (total <= 0) return {}
  const ratio = booked / total
  if (ratio >= 1) return { background: '#fef2f2' } // red - fully booked
  if (ratio >= 0.8) return { background: '#fffbeb' } // yellow - >80%
  return { background: '#f0fdf4' } // green - available
}

export default function BulkInventoryManager({ productType, productId, onSave }) {
  const typeLabel = productType === 'room' ? 'Rooms' : 'Quantity'
  const idField = productType === 'room' ? 'room_id' : productType === 'ticket' ? 'ticket_id' : 'package_id'

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
  const [viewEnd, setViewEnd] = useState(addDays(todayStr(), 30))
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
      setBulkMessage({ type: 'success', text: `Updated ${count} date(s) successfully.` })
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
      const body = {
        [idField]: productId,
        start_date: formatDate(inv.date),
        end_date: formatDate(inv.date),
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
      }
      if (editValues.price !== '') {
        body.price = Number(editValues.price)
      }
      if (editValues.quantity !== '') {
        body[productType === 'room' ? 'total_rooms' : 'total_quantity'] = Number(editValues.quantity)
      }
      await post(`/admin/products/${productType}-inventory/bulk`, body)
      setEditingRow(null)
      loadInventory()
      if (onSave) onSave()
    } catch (err) {
      alert('Save failed: ' + err.message)
    }
  }

  const getDayName = (dateStr) => {
    const d = new Date(dateStr)
    return DAY_FULL[d.getDay() === 0 ? 6 : d.getDay() - 1]
  }

  const formatCurrency = (v) => v != null ? '\u20a9' + Number(v).toLocaleString() : '-'

  return (
    <div style={styles.container}>
      {/* Section A: Bulk Set by Date Range */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Bulk Set by Date Range</h4>

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
            <span style={styles.label}>Price (optional)</span>
            <input
              type="number"
              style={styles.input}
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              placeholder="Keep existing"
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>{typeLabel} (optional)</span>
            <input
              type="number"
              style={styles.input}
              min={0}
              value={bulkQuantity}
              onChange={(e) => setBulkQuantity(e.target.value)}
              placeholder="Keep existing"
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={{ ...styles.label, display: 'block', marginBottom: 6 }}>Days of Week</span>
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
                {day}
              </div>
            ))}
          </div>
        </div>

        <button
          style={{ ...styles.btn, ...styles.btnPrimary, opacity: bulkLoading ? 0.7 : 1 }}
          onClick={applyBulk}
          disabled={bulkLoading}
        >
          {bulkLoading ? 'Applying...' : 'Apply to Range'}
        </button>

        {bulkMessage && (
          <div style={bulkMessage.type === 'success' ? styles.success : styles.error}>
            {bulkMessage.text}
          </div>
        )}
      </div>

      {/* Section B: Current Inventory Table */}
      <div style={styles.sectionLast}>
        <h4 style={styles.sectionTitle}>Current Inventory</h4>

        <div style={{ ...styles.row, marginBottom: 16 }}>
          <div style={styles.formGroup}>
            <span style={styles.label}>From</span>
            <input
              type="date"
              style={styles.input}
              value={viewStart}
              onChange={(e) => setViewStart(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <span style={styles.label}>To</span>
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
            <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto', width: 24, height: 24 }} />
              <p style={{ marginTop: 8 }}>Loading inventory...</p>
            </div>
          ) : inventory.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
              No inventory data for this date range.
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Day</th>
                  <th style={styles.th}>Price</th>
                  <th style={styles.th}>{typeLabel}</th>
                  <th style={styles.th}>Booked</th>
                  <th style={styles.th}>Available</th>
                  <th style={{ ...styles.th, width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((inv, i) => {
                  const total = inv.quantity ?? inv.total_rooms ?? inv.total_quantity ?? 0
                  const booked = inv.booked ?? inv.booked_quantity ?? inv.booked_rooms ?? 0
                  const available = inv.available ?? inv.available_quantity ?? inv.available_rooms ?? (total - booked)
                  const rowColor = getRowColor(booked, total)
                  const isEditing = editingRow === i

                  return (
                    <tr key={i} style={rowColor}>
                      <td style={styles.td}>{formatDate(inv.date)}</td>
                      <td style={styles.td}>{getDayName(inv.date)}</td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={styles.editInput}
                            value={editValues.price}
                            onChange={(e) => setEditValues({ ...editValues, price: e.target.value })}
                          />
                        ) : (
                          formatCurrency(inv.price)
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
                          />
                        ) : (
                          total
                        )}
                      </td>
                      <td style={styles.td}>{booked}</td>
                      <td style={styles.td}>{available}</td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              style={{ ...styles.btn, ...styles.btnPrimary, padding: '4px 10px', fontSize: '0.8rem' }}
                              onClick={() => saveEdit(inv)}
                            >
                              Save
                            </button>
                            <button
                              style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 10px', fontSize: '0.8rem' }}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            style={{ ...styles.btn, ...styles.btnSecondary, padding: '4px 10px', fontSize: '0.8rem' }}
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
