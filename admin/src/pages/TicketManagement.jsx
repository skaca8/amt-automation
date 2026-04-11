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

  // Inventory modal state
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [inventoryTicket, setInventoryTicket] = useState(null)

  // Promotions modal state
  const [showPromotionsModal, setShowPromotionsModal] = useState(false)
  const [promotionsTicket, setPromotionsTicket] = useState(null)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get('/admin/products/tickets')
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
      price: ticket.price || ticket.base_price || '',
      status: ticket.status || 'active',
      images: ticket.images || [],
    })
    setShowModal(true)
  }

  const saveTicket = async () => {
    setSaving(true)
    try {
      const payload = { ...form, base_price: Number(form.price) }
      if (editing) {
        await put(`/admin/products/tickets/${editing._id || editing.id}`, payload)
      } else {
        await post('/admin/products/tickets', payload)
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
      await del(`/admin/products/tickets/${ticket._id || ticket.id}`)
      loadTickets()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  const openInventoryModal = (ticket) => {
    setInventoryTicket(ticket)
    setShowInventoryModal(true)
  }

  const openPromotionsModal = (ticket) => {
    setPromotionsTicket(ticket)
    setShowPromotionsModal(true)
  }

  const formatCurrency = (v) => v != null && v !== '' ? '\u20a9' + Number(v).toLocaleString() : '-'

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
              <th>Name</th>
              <th>Category</th>
              <th>Base Price</th>
              <th>Status</th>
              <th style={{ width: 340 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="table-empty">
                    <p>No tickets found. Click "Add Ticket" to create one.</p>
                  </div>
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
                const tid = ticket._id || ticket.id
                return (
                  <tr key={tid}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ticket.name_en}</div>
                      {ticket.name_cn && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{ticket.name_cn}</div>
                      )}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{ticket.category || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(ticket.price || ticket.base_price)}</td>
                    <td><StatusBadge status={ticket.status} /></td>
                    <td>
                      <div className="btn-group" style={{ flexWrap: 'wrap', gap: 4 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(ticket)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600 }}
                          onClick={() => openInventoryModal(ticket)}
                        >
                          {'\uC7AC\uACE0 \uBC0F \uAC00\uACA9 \uAD00\uB9AC'}
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 600 }}
                          onClick={() => openPromotionsModal(ticket)}
                        >
                          {'\uD504\uB85C\uBAA8\uC158'}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteTicket(ticket)}>
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
            <label>Base Price ({'\u20a9'})</label>
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

      {/* Inventory & Pricing Modal (Large) */}
      <Modal
        isOpen={showInventoryModal}
        onClose={() => { setShowInventoryModal(false); setInventoryTicket(null) }}
        title={`\uC7AC\uACE0 \uBC0F \uAC00\uACA9 \uAD00\uB9AC: ${inventoryTicket?.name_en || 'Ticket'}`}
        size="xl"
      >
        {inventoryTicket && (
          <BulkInventoryManager
            productType="ticket"
            productId={inventoryTicket._id || inventoryTicket.id}
          />
        )}
      </Modal>

      {/* Promotions Modal (Large) */}
      <Modal
        isOpen={showPromotionsModal}
        onClose={() => { setShowPromotionsModal(false); setPromotionsTicket(null) }}
        title={`\uD504\uB85C\uBAA8\uC158 \uAD00\uB9AC: ${promotionsTicket?.name_en || 'Ticket'}`}
        size="xl"
      >
        {promotionsTicket && (
          <PromotionManager
            productType="ticket"
            productId={promotionsTicket._id || promotionsTicket.id}
          />
        )}
      </Modal>
    </div>
  )
}
