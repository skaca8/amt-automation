import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put, del } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ImageUploader from '../components/ImageUploader'
import RichTextEditor from '../components/RichTextEditor'
import BulkInventoryManager from '../components/BulkInventoryManager'
import PromotionManager from '../components/PromotionManager'

const emptyTicket = {
  name_en: '', name_cn: '', description_en: '', description_cn: '',
  category: '', price: '', status: 'active', images: [],
}

export default function TicketManagement() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyTicket })
  const [saving, setSaving] = useState(false)
  const [expandedTicket, setExpandedTicket] = useState(null)
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [inventoryTicket, setInventoryTicket] = useState(null)
  const [inventoryData, setInventoryData] = useState([])
  const [newInventory, setNewInventory] = useState({ date: '', price: '', quantity: '' })

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get('/admin/tickets')
      setTickets(res.tickets || res.data || res || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyTicket })
    setShowModal(true)
  }

  const openEdit = (ticket) => {
    setEditing(ticket)
    setForm({
      name_en: ticket.name_en || '',
      name_cn: ticket.name_cn || '',
      description_en: ticket.description_en || '',
      description_cn: ticket.description_cn || '',
      category: ticket.category || '',
      price: ticket.price || '',
      status: ticket.status || 'active',
      images: ticket.images || [],
    })
    setShowModal(true)
  }

  const saveTicket = async () => {
    setSaving(true)
    try {
      const payload = { ...form, price: Number(form.price) }
      if (editing) {
        await put(`/admin/tickets/${editing._id || editing.id}`, payload)
      } else {
        await post('/admin/tickets', payload)
      }
      setShowModal(false)
      loadTickets()
    } catch (err) {
      alert('Failed to save ticket: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteTicket = async (ticket) => {
    if (!window.confirm(`Delete "${ticket.name_en}"? This action cannot be undone.`)) return
    try {
      await del(`/admin/tickets/${ticket._id || ticket.id}`)
      loadTickets()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  const toggleExpand = (ticketId) => {
    setExpandedTicket(expandedTicket === ticketId ? null : ticketId)
  }

  const openInventory = async (ticket) => {
    setInventoryTicket(ticket)
    setShowInventoryModal(true)
    try {
      const res = await get(`/admin/tickets/${ticket._id || ticket.id}/inventory`)
      setInventoryData(res.inventory || res.data || res || [])
    } catch {
      setInventoryData([])
    }
  }

  const addInventory = async () => {
    if (!newInventory.date || !newInventory.price || !newInventory.quantity) {
      alert('Please fill all inventory fields')
      return
    }
    try {
      await post(`/admin/tickets/${inventoryTicket._id || inventoryTicket.id}/inventory`, {
        date: newInventory.date,
        price: Number(newInventory.price),
        quantity: Number(newInventory.quantity),
      })
      setNewInventory({ date: '', price: '', quantity: '' })
      const res = await get(`/admin/tickets/${inventoryTicket._id || inventoryTicket.id}/inventory`)
      setInventoryData(res.inventory || res.data || res || [])
    } catch (err) {
      alert('Failed to add inventory: ' + err.message)
    }
  }

  const formatCurrency = (v) => v != null ? '\u20a9' + Number(v).toLocaleString() : '-'

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div><h1>Ticket Management</h1><p>Manage ski passes and activity tickets</p></div>
        </div>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 16, color: '#64748b' }}>Loading tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Ticket Management</h1>
          <p>Manage ski passes and activity tickets</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Add Ticket
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Name</th>
              <th>Category</th>
              <th>Base Price</th>
              <th>Status</th>
              <th style={{ width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="table-empty">
                    <p>No tickets found. Click "Add Ticket" to create one.</p>
                  </div>
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
                const tid = ticket._id || ticket.id
                const isExpanded = expandedTicket === tid
                return (
                  <React.Fragment key={tid}>
                    <tr>
                      <td>
                        <button
                          className="btn btn-icon btn-secondary"
                          style={{ width: 28, height: 28, fontSize: '0.7rem' }}
                          onClick={() => toggleExpand(tid)}
                        >
                          {isExpanded ? '\u25BC' : '\u25B6'}
                        </button>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ticket.name_en}</div>
                        {ticket.name_cn && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{ticket.name_cn}</div>
                        )}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{ticket.category || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(ticket.price)}</td>
                      <td><StatusBadge status={ticket.status} /></td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-sm btn-secondary" onClick={() => openEdit(ticket)}>
                            Edit
                          </button>
                          <button className="btn btn-sm btn-primary" onClick={() => openInventory(ticket)}>
                            Inventory
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteTicket(ticket)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ background: '#f8fafc', padding: '16px 24px' }}>
                          <div style={{ marginBottom: 24 }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>
                              Bulk Inventory Management
                            </h4>
                            <BulkInventoryManager
                              productType="ticket"
                              productId={tid}
                            />
                          </div>
                          <PromotionManager productType="ticket" productId={tid} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Ticket Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Ticket' : 'Add Ticket'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveTicket} disabled={saving}>
              {saving ? 'Saving...' : 'Save Ticket'}
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
              placeholder="Ticket name in English"
            />
          </div>
          <div className="form-group">
            <label>Name (Chinese)</label>
            <input
              className="form-control"
              value={form.name_cn}
              onChange={(e) => setForm({ ...form, name_cn: e.target.value })}
              placeholder="Ticket name in Chinese"
            />
          </div>
        </div>
        <div className="form-group">
          <label>Description (English)</label>
          <RichTextEditor
            value={form.description_en}
            onChange={(html) => setForm({ ...form, description_en: html })}
            placeholder="Ticket description in English"
          />
        </div>
        <div className="form-group">
          <label>Description (Chinese)</label>
          <RichTextEditor
            value={form.description_cn}
            onChange={(html) => setForm({ ...form, description_cn: html })}
            placeholder="Ticket description in Chinese"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Category</label>
            <select
              className="form-control"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Select category</option>
              <option value="ski">Ski Pass</option>
              <option value="snowboard">Snowboard</option>
              <option value="activity">Activity</option>
              <option value="rental">Equipment Rental</option>
              <option value="lesson">Lesson</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Base Price (KRW)</label>
            <input
              type="number"
              className="form-control"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0"
            />
          </div>
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
        <div className="form-group">
          <label>Images</label>
          <ImageUploader
            images={form.images}
            onChange={(imgs) => setForm({ ...form, images: imgs })}
          />
        </div>
      </Modal>

      {/* Inventory Modal */}
      <Modal
        isOpen={showInventoryModal}
        onClose={() => { setShowInventoryModal(false); setInventoryData([]); setInventoryTicket(null) }}
        title={`Inventory: ${inventoryTicket?.name_en || 'Ticket'}`}
        size="lg"
      >
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Add Inventory</h4>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <input
                type="date"
                className="form-control"
                value={newInventory.date}
                onChange={(e) => setNewInventory({ ...newInventory, date: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Price (KRW)</label>
              <input
                type="number"
                className="form-control"
                value={newInventory.price}
                onChange={(e) => setNewInventory({ ...newInventory, price: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Quantity</label>
              <input
                type="number"
                className="form-control"
                min={0}
                value={newInventory.quantity}
                onChange={(e) => setNewInventory({ ...newInventory, quantity: e.target.value })}
                placeholder="0"
              />
            </div>
            <button className="btn btn-primary" onClick={addInventory}>Add</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Price</th>
                <th>Total Qty</th>
                <th>Available</th>
                <th>Booked</th>
              </tr>
            </thead>
            <tbody>
              {inventoryData.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                    No inventory data. Add dates above.
                  </td>
                </tr>
              ) : (
                inventoryData.map((inv, i) => (
                  <tr key={i}>
                    <td>{new Date(inv.date).toLocaleDateString()}</td>
                    <td>{formatCurrency(inv.price)}</td>
                    <td>{inv.quantity ?? inv.totalQuantity ?? '-'}</td>
                    <td>{inv.available ?? inv.availableQuantity ?? '-'}</td>
                    <td>{inv.booked ?? inv.bookedQuantity ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}
