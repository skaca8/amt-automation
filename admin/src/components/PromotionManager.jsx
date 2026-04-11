import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put, del } from '../utils/api'

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

function formatDiscount(type, value) {
  if (type === 'percentage') return `${value}%`
  return `\u20a9${Number(value).toLocaleString()}`
}

export default function PromotionManager({ productType, productId }) {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyPromotion })
  const [saving, setSaving] = useState(false)

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
