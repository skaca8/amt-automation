import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put, del } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ImageUploader from '../components/ImageUploader'
import RichTextEditor from '../components/RichTextEditor'
import BulkInventoryManager from '../components/BulkInventoryManager'
import PromotionManager from '../components/PromotionManager'

const emptyPackage = {
  name_en: '', name_cn: '', description_en: '', description_cn: '',
  price: '', status: 'active', items: [], images: [],
}

export default function PackageManagement() {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyPackage })
  const [saving, setSaving] = useState(false)
  const [hotels, setHotels] = useState([])
  const [tickets, setTickets] = useState([])
  const [hotelRooms, setHotelRooms] = useState({})

  // Inventory modal state
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [inventoryPkg, setInventoryPkg] = useState(null)

  // Promotions modal state
  const [showPromotionsModal, setShowPromotionsModal] = useState(false)
  const [promotionsPkg, setPromotionsPkg] = useState(null)

  const loadPackages = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get('/admin/products/packages')
      setPackages(res.packages || res.data || res || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPackages()
    loadProductOptions()
  }, [loadPackages])

  const loadProductOptions = async () => {
    try {
      const [h, t] = await Promise.all([
        get('/admin/products').catch(() => ({ hotels: [] })),
        get('/admin/products/tickets').catch(() => ({ tickets: [] })),
      ])
      const hotelList = h.hotels || h.data || h || []
      setHotels(hotelList)
      setTickets(t.tickets || t.data || t || [])

      const roomMap = {}
      for (const hotel of hotelList) {
        const hid = hotel._id || hotel.id
        try {
          const roomRes = await get(`/admin/products/room-types?hotel_id=${hid}`)
          roomMap[hid] = roomRes.room_types || roomRes.rooms || roomRes.data || []
        } catch {
          roomMap[hid] = []
        }
      }
      setHotelRooms(roomMap)
    } catch {
      // Silently handle
    }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyPackage, items: [], images: [] })
    setShowModal(true)
  }

  const openEdit = (pkg) => {
    setEditing(pkg)
    setForm({
      name_en: pkg.name_en || '',
      name_cn: pkg.name_cn || '',
      description_en: pkg.description_en || '',
      description_cn: pkg.description_cn || '',
      price: pkg.price || pkg.base_price || '',
      status: pkg.status || 'active',
      items: pkg.items || [],
      images: pkg.images || [],
    })
    setShowModal(true)
  }

  const savePackage = async () => {
    setSaving(true)
    try {
      const payload = { ...form, base_price: Number(form.price) }
      if (editing) {
        await put(`/admin/products/packages/${editing._id || editing.id}`, payload)
      } else {
        await post('/admin/products/packages', payload)
      }
      setShowModal(false)
      loadPackages()
    } catch (err) {
      alert('Failed to save package: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const deletePackage = async (pkg) => {
    if (!window.confirm(`Delete "${pkg.name_en}"? This action cannot be undone.`)) return
    try {
      await del(`/admin/products/packages/${pkg._id || pkg.id}`)
      loadPackages()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { type: 'hotel', product_id: '', room_type_id: '', quantity: 1 }],
    })
  }

  const updateItem = (index, field, value) => {
    const updated = [...form.items]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'type') {
      updated[index].product_id = ''
      updated[index].room_type_id = ''
    }
    setForm({ ...form, items: updated })
  }

  const removeItem = (index) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) })
  }

  const openInventoryModal = (pkg) => {
    setInventoryPkg(pkg)
    setShowInventoryModal(true)
  }

  const openPromotionsModal = (pkg) => {
    setPromotionsPkg(pkg)
    setShowPromotionsModal(true)
  }

  const formatCurrency = (v) => v != null && v !== '' ? '\u20a9' + Number(v).toLocaleString() : '-'

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div><h1>Package Management</h1><p>Manage bundled packages and deals</p></div>
        </div>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 16, color: '#64748b' }}>Loading packages...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Package Management</h1>
          <p>Manage bundled packages and deals</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Add Package
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Items</th>
              <th>Base Price</th>
              <th>Status</th>
              <th style={{ width: 340 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {packages.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="table-empty">
                    <p>No packages found. Click "Add Package" to create one.</p>
                  </div>
                </td>
              </tr>
            ) : (
              packages.map((pkg) => {
                const pid = pkg._id || pkg.id
                return (
                  <tr key={pid}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{pkg.name_en}</div>
                      {pkg.name_cn && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{pkg.name_cn}</div>
                      )}
                    </td>
                    <td>{pkg.items?.length || 0} items</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(pkg.price || pkg.base_price)}</td>
                    <td><StatusBadge status={pkg.status} /></td>
                    <td>
                      <div className="btn-group" style={{ flexWrap: 'wrap', gap: 4 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(pkg)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600 }}
                          onClick={() => openInventoryModal(pkg)}
                        >
                          {'\uC7AC\uACE0 \uBC0F \uAC00\uACA9 \uAD00\uB9AC'}
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 600 }}
                          onClick={() => openPromotionsModal(pkg)}
                        >
                          {'\uD504\uB85C\uBAA8\uC158'}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deletePackage(pkg)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Package Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Package' : 'Add Package'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={savePackage} disabled={saving}>
              {saving ? 'Saving...' : 'Save Package'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label>Name (English) *</label>
            <input
              className="form-control"
              value={form.name_en}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
              placeholder="Package name in English"
            />
          </div>
          <div className="form-group">
            <label>Name (Chinese)</label>
            <input
              className="form-control"
              value={form.name_cn}
              onChange={(e) => setForm({ ...form, name_cn: e.target.value })}
              placeholder="Package name in Chinese"
            />
          </div>
        </div>
        <div className="form-group">
          <label>Description (English)</label>
          <RichTextEditor
            value={form.description_en}
            onChange={(html) => setForm({ ...form, description_en: html })}
            placeholder="Package description in English"
          />
        </div>
        <div className="form-group">
          <label>Description (Chinese)</label>
          <RichTextEditor
            value={form.description_cn}
            onChange={(html) => setForm({ ...form, description_cn: html })}
            placeholder="Package description in Chinese"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Package Price ({'\u20a9'})</label>
            <input
              type="number"
              className="form-control"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              className="form-control"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Images</label>
          <ImageUploader
            images={form.images}
            onChange={(imgs) => setForm({ ...form, images: imgs })}
          />
        </div>

        {/* Package Items */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Package Items</h4>
            <button className="btn btn-sm btn-secondary" onClick={addItem}>
              + Add Item
            </button>
          </div>

          {form.items.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: 16 }}>
              No items added. Click "Add Item" to include hotel rooms or tickets.
            </p>
          ) : (
            form.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-end',
                  marginBottom: 12,
                  padding: 12,
                  background: '#f8fafc',
                  borderRadius: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div className="form-group" style={{ marginBottom: 0, minWidth: 100 }}>
                  <label>Type</label>
                  <select
                    className="form-control"
                    value={item.type}
                    onChange={(e) => updateItem(idx, 'type', e.target.value)}
                  >
                    <option value="hotel">Hotel Room</option>
                    <option value="ticket">Ticket</option>
                  </select>
                </div>

                {item.type === 'hotel' ? (
                  <>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
                      <label>Hotel</label>
                      <select
                        className="form-control"
                        value={item.product_id}
                        onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                      >
                        <option value="">Select hotel</option>
                        {hotels.map((h) => (
                          <option key={h._id || h.id} value={h._id || h.id}>
                            {h.name_en}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
                      <label>Room Type</label>
                      <select
                        className="form-control"
                        value={item.room_type_id || ''}
                        onChange={(e) => updateItem(idx, 'room_type_id', e.target.value)}
                      >
                        <option value="">Select room</option>
                        {(hotelRooms[item.product_id] || []).map((r) => (
                          <option key={r._id || r.id} value={r._id || r.id}>
                            {r.name_en}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                    <label>Ticket</label>
                    <select
                      className="form-control"
                      value={item.product_id}
                      onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                    >
                      <option value="">Select ticket</option>
                      {tickets.map((t) => (
                        <option key={t._id || t.id} value={t._id || t.id}>
                          {t.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0, width: 80 }}>
                  <label>Qty</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                  />
                </div>

                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => removeItem(idx)}
                  style={{ marginBottom: 0 }}
                >
                  {'\u2715'}
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Inventory & Pricing Modal (Large) */}
      <Modal
        isOpen={showInventoryModal}
        onClose={() => { setShowInventoryModal(false); setInventoryPkg(null) }}
        title={`\uC7AC\uACE0 \uBC0F \uAC00\uACA9 \uAD00\uB9AC: ${inventoryPkg?.name_en || 'Package'}`}
        size="xl"
      >
        {inventoryPkg && (
          <BulkInventoryManager
            productType="package"
            productId={inventoryPkg._id || inventoryPkg.id}
          />
        )}
      </Modal>

      {/* Promotions Modal (Large) */}
      <Modal
        isOpen={showPromotionsModal}
        onClose={() => { setShowPromotionsModal(false); setPromotionsPkg(null) }}
        title={`\uD504\uB85C\uBAA8\uC158 \uAD00\uB9AC: ${promotionsPkg?.name_en || 'Package'}`}
        size="xl"
      >
        {promotionsPkg && (
          <PromotionManager
            productType="package"
            productId={promotionsPkg._id || promotionsPkg.id}
          />
        )}
      </Modal>
    </div>
  )
}
