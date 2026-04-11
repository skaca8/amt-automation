import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put, del } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ImageUploader from '../components/ImageUploader'
import RichTextEditor from '../components/RichTextEditor'
import BulkInventoryManager from '../components/BulkInventoryManager'
import PromotionManager from '../components/PromotionManager'

const emptyHotel = {
  name_en: '', name_cn: '', description_en: '', description_cn: '',
  address: '', amenities: '', status: 'active', images: [],
}

const emptyRoom = {
  name_en: '', name_cn: '', description_en: '', description_cn: '',
  max_guests: 2, status: 'active', images: [],
}

export default function HotelManagement() {
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showHotelModal, setShowHotelModal] = useState(false)
  const [editingHotel, setEditingHotel] = useState(null)
  const [hotelForm, setHotelForm] = useState({ ...emptyHotel })
  const [saving, setSaving] = useState(false)
  const [expandedHotel, setExpandedHotel] = useState(null)
  const [roomTypes, setRoomTypes] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomForm, setRoomForm] = useState({ ...emptyRoom })
  const [expandedRoom, setExpandedRoom] = useState(null)
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [inventoryRoom, setInventoryRoom] = useState(null)
  const [inventoryData, setInventoryData] = useState([])
  const [newInventory, setNewInventory] = useState({ date: '', price: '', quantity: '' })

  const loadHotels = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get('/admin/hotels')
      setHotels(res.hotels || res.data || res || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHotels()
  }, [loadHotels])

  const loadRoomTypes = async (hotelId) => {
    setLoadingRooms(true)
    try {
      const res = await get(`/admin/hotels/${hotelId}/rooms`)
      setRoomTypes(res.rooms || res.data || res || [])
    } catch {
      setRoomTypes([])
    } finally {
      setLoadingRooms(false)
    }
  }

  const toggleExpand = (hotelId) => {
    if (expandedHotel === hotelId) {
      setExpandedHotel(null)
      setRoomTypes([])
      setExpandedRoom(null)
    } else {
      setExpandedHotel(hotelId)
      setExpandedRoom(null)
      loadRoomTypes(hotelId)
    }
  }

  // Hotel CRUD
  const openAddHotel = () => {
    setEditingHotel(null)
    setHotelForm({ ...emptyHotel })
    setShowHotelModal(true)
  }

  const openEditHotel = (hotel) => {
    setEditingHotel(hotel)
    setHotelForm({
      name_en: hotel.name_en || '',
      name_cn: hotel.name_cn || '',
      description_en: hotel.description_en || '',
      description_cn: hotel.description_cn || '',
      address: hotel.address || '',
      amenities: Array.isArray(hotel.amenities) ? hotel.amenities.join(', ') : (hotel.amenities || ''),
      status: hotel.status || 'active',
      images: hotel.images || [],
    })
    setShowHotelModal(true)
  }

  const saveHotel = async () => {
    setSaving(true)
    try {
      const payload = {
        ...hotelForm,
        amenities: typeof hotelForm.amenities === 'string'
          ? hotelForm.amenities.split(',').map((a) => a.trim()).filter(Boolean)
          : hotelForm.amenities,
      }
      if (editingHotel) {
        await put(`/admin/hotels/${editingHotel._id || editingHotel.id}`, payload)
      } else {
        await post('/admin/hotels', payload)
      }
      setShowHotelModal(false)
      loadHotels()
    } catch (err) {
      alert('Failed to save hotel: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteHotel = async (hotel) => {
    if (!window.confirm(`Delete "${hotel.name_en}"? This action cannot be undone.`)) return
    try {
      await del(`/admin/hotels/${hotel._id || hotel.id}`)
      loadHotels()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  // Room CRUD
  const openAddRoom = () => {
    setEditingRoom(null)
    setRoomForm({ ...emptyRoom })
    setShowRoomModal(true)
  }

  const openEditRoom = (room) => {
    setEditingRoom(room)
    setRoomForm({
      name_en: room.name_en || '',
      name_cn: room.name_cn || '',
      description_en: room.description_en || '',
      description_cn: room.description_cn || '',
      max_guests: room.max_guests || room.maxGuests || 2,
      status: room.status || 'active',
      images: room.images || [],
    })
    setShowRoomModal(true)
  }

  const saveRoom = async () => {
    setSaving(true)
    try {
      const payload = { ...roomForm, max_guests: Number(roomForm.max_guests) }
      if (editingRoom) {
        await put(`/admin/hotels/${expandedHotel}/rooms/${editingRoom._id || editingRoom.id}`, payload)
      } else {
        await post(`/admin/hotels/${expandedHotel}/rooms`, payload)
      }
      setShowRoomModal(false)
      loadRoomTypes(expandedHotel)
    } catch (err) {
      alert('Failed to save room type: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteRoom = async (room) => {
    if (!window.confirm(`Delete room type "${room.name_en}"?`)) return
    try {
      await del(`/admin/hotels/${expandedHotel}/rooms/${room._id || room.id}`)
      loadRoomTypes(expandedHotel)
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  // Inventory
  const openInventory = async (room) => {
    setInventoryRoom(room)
    setShowInventoryModal(true)
    try {
      const res = await get(`/admin/hotels/${expandedHotel}/rooms/${room._id || room.id}/inventory`)
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
      await post(`/admin/hotels/${expandedHotel}/rooms/${inventoryRoom._id || inventoryRoom.id}/inventory`, {
        date: newInventory.date,
        price: Number(newInventory.price),
        quantity: Number(newInventory.quantity),
      })
      setNewInventory({ date: '', price: '', quantity: '' })
      const res = await get(`/admin/hotels/${expandedHotel}/rooms/${inventoryRoom._id || inventoryRoom.id}/inventory`)
      setInventoryData(res.inventory || res.data || res || [])
    } catch (err) {
      alert('Failed to add inventory: ' + err.message)
    }
  }

  const toggleRoomExpand = (roomId) => {
    setExpandedRoom(expandedRoom === roomId ? null : roomId)
  }

  const formatCurrency = (v) => v != null ? '\u20a9' + Number(v).toLocaleString() : '-'

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div><h1>Hotel Management</h1><p>Manage hotel properties and room types</p></div>
        </div>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 16, color: '#64748b' }}>Loading hotels...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Hotel Management</h1>
          <p>Manage hotel properties and room types</p>
        </div>
        <button className="btn btn-primary" onClick={openAddHotel}>
          + Add Hotel
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Name</th>
              <th>Address</th>
              <th>Rooms</th>
              <th>Status</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {hotels.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="table-empty">
                    <p>No hotels found. Click "Add Hotel" to create one.</p>
                  </div>
                </td>
              </tr>
            ) : (
              hotels.map((hotel) => {
                const hid = hotel._id || hotel.id
                const isExpanded = expandedHotel === hid
                return (
                  <React.Fragment key={hid}>
                    <tr>
                      <td>
                        <button
                          className="btn btn-icon btn-secondary"
                          style={{ width: 28, height: 28, fontSize: '0.7rem' }}
                          onClick={() => toggleExpand(hid)}
                        >
                          {isExpanded ? '\u25BC' : '\u25B6'}
                        </button>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{hotel.name_en}</div>
                        {hotel.name_cn && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{hotel.name_cn}</div>
                        )}
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{hotel.address || '-'}</td>
                      <td>{hotel.room_count || hotel.roomCount || hotel.rooms?.length || '-'}</td>
                      <td><StatusBadge status={hotel.status} /></td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-sm btn-secondary" onClick={() => openEditHotel(hotel)}>
                            Edit
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteHotel(hotel)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ background: '#f8fafc', padding: '16px 24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Room Types</h4>
                            <button className="btn btn-sm btn-primary" onClick={openAddRoom}>
                              + Add Room Type
                            </button>
                          </div>
                          {loadingRooms ? (
                            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading rooms...</div>
                          ) : roomTypes.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                              No room types. Click "Add Room Type" to create one.
                            </div>
                          ) : (
                            <table style={{ background: '#ffffff', borderRadius: 8 }}>
                              <thead>
                                <tr>
                                  <th style={{ width: 32 }}></th>
                                  <th>Name</th>
                                  <th>Max Guests</th>
                                  <th>Status</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {roomTypes.map((room) => {
                                  const rid = room._id || room.id
                                  const isRoomExpanded = expandedRoom === rid
                                  return (
                                    <React.Fragment key={rid}>
                                      <tr>
                                        <td>
                                          <button
                                            className="btn btn-icon btn-secondary"
                                            style={{ width: 24, height: 24, fontSize: '0.6rem' }}
                                            onClick={() => toggleRoomExpand(rid)}
                                          >
                                            {isRoomExpanded ? '\u25BC' : '\u25B6'}
                                          </button>
                                        </td>
                                        <td>
                                          <div style={{ fontWeight: 500 }}>{room.name_en}</div>
                                          {room.name_cn && (
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{room.name_cn}</div>
                                          )}
                                        </td>
                                        <td>{room.max_guests || room.maxGuests || '-'}</td>
                                        <td><StatusBadge status={room.status} /></td>
                                        <td>
                                          <div className="btn-group">
                                            <button className="btn btn-sm btn-secondary" onClick={() => openEditRoom(room)}>
                                              Edit
                                            </button>
                                            <button className="btn btn-sm btn-primary" onClick={() => openInventory(room)}>
                                              Inventory
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => deleteRoom(room)}>
                                              Delete
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                      {isRoomExpanded && (
                                        <tr>
                                          <td colSpan={5} style={{ padding: '16px 12px', background: '#f1f5f9' }}>
                                            <BulkInventoryManager
                                              productType="room"
                                              productId={rid}
                                            />
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}

                          {/* Promotions for this hotel */}
                          <div style={{ marginTop: 24 }}>
                            <PromotionManager productType="hotel" productId={hid} />
                          </div>
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

      {/* Hotel Modal */}
      <Modal
        isOpen={showHotelModal}
        onClose={() => setShowHotelModal(false)}
        title={editingHotel ? 'Edit Hotel' : 'Add Hotel'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowHotelModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveHotel} disabled={saving}>
              {saving ? 'Saving...' : 'Save Hotel'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label>Name (English) *</label>
            <input
              className="form-control"
              value={hotelForm.name_en}
              onChange={(e) => setHotelForm({ ...hotelForm, name_en: e.target.value })}
              placeholder="Hotel name in English"
            />
          </div>
          <div className="form-group">
            <label>Name (Chinese)</label>
            <input
              className="form-control"
              value={hotelForm.name_cn}
              onChange={(e) => setHotelForm({ ...hotelForm, name_cn: e.target.value })}
              placeholder="Hotel name in Chinese"
            />
          </div>
        </div>
        <div className="form-group">
          <label>Description (English)</label>
          <RichTextEditor
            value={hotelForm.description_en}
            onChange={(html) => setHotelForm({ ...hotelForm, description_en: html })}
            placeholder="Hotel description in English"
          />
        </div>
        <div className="form-group">
          <label>Description (Chinese)</label>
          <RichTextEditor
            value={hotelForm.description_cn}
            onChange={(html) => setHotelForm({ ...hotelForm, description_cn: html })}
            placeholder="Hotel description in Chinese"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Address</label>
            <input
              className="form-control"
              value={hotelForm.address}
              onChange={(e) => setHotelForm({ ...hotelForm, address: e.target.value })}
              placeholder="Full address"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              className="form-control"
              value={hotelForm.status}
              onChange={(e) => setHotelForm({ ...hotelForm, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Amenities (comma-separated)</label>
          <input
            className="form-control"
            value={hotelForm.amenities}
            onChange={(e) => setHotelForm({ ...hotelForm, amenities: e.target.value })}
            placeholder="WiFi, Pool, Spa, Restaurant, Parking"
          />
        </div>
        <div className="form-group">
          <label>Images</label>
          <ImageUploader
            images={hotelForm.images}
            onChange={(imgs) => setHotelForm({ ...hotelForm, images: imgs })}
          />
        </div>
      </Modal>

      {/* Room Type Modal */}
      <Modal
        isOpen={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        title={editingRoom ? 'Edit Room Type' : 'Add Room Type'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowRoomModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveRoom} disabled={saving}>
              {saving ? 'Saving...' : 'Save Room Type'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label>Name (English) *</label>
            <input
              className="form-control"
              value={roomForm.name_en}
              onChange={(e) => setRoomForm({ ...roomForm, name_en: e.target.value })}
              placeholder="Room type name in English"
            />
          </div>
          <div className="form-group">
            <label>Name (Chinese)</label>
            <input
              className="form-control"
              value={roomForm.name_cn}
              onChange={(e) => setRoomForm({ ...roomForm, name_cn: e.target.value })}
              placeholder="Room type name in Chinese"
            />
          </div>
        </div>
        <div className="form-group">
          <label>Description (English)</label>
          <RichTextEditor
            value={roomForm.description_en}
            onChange={(html) => setRoomForm({ ...roomForm, description_en: html })}
            placeholder="Room description in English"
          />
        </div>
        <div className="form-group">
          <label>Description (Chinese)</label>
          <RichTextEditor
            value={roomForm.description_cn}
            onChange={(html) => setRoomForm({ ...roomForm, description_cn: html })}
            placeholder="Room description in Chinese"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Max Guests</label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={roomForm.max_guests}
              onChange={(e) => setRoomForm({ ...roomForm, max_guests: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              className="form-control"
              value={roomForm.status}
              onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Images</label>
          <ImageUploader
            images={roomForm.images}
            onChange={(imgs) => setRoomForm({ ...roomForm, images: imgs })}
          />
        </div>
      </Modal>

      {/* Inventory Modal */}
      <Modal
        isOpen={showInventoryModal}
        onClose={() => { setShowInventoryModal(false); setInventoryData([]); setInventoryRoom(null) }}
        title={`Inventory: ${inventoryRoom?.name_en || 'Room'}`}
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
