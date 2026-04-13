// ============================================================================
// Admin — 호텔 관리 페이지 HotelManagement
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 호텔 목록을 조회·생성·수정·삭제(soft delete) 한다.
//   2) 각 호텔 행을 확장하면 해당 호텔의 Room Type(객실 타입) 목록이 나타나고,
//      거기서 객실 타입 자체도 CRUD 할 수 있다.
//   3) 객실 타입 레벨에서 "재고 관리 모달" 과 "프로모션 관리 모달" 을 띄운다.
//      - 재고: <BulkInventoryManager productType="room" productId={roomTypeId} />
//      - 프로모션: <PromotionManager productType="hotel" productId={hotelId} />
//   4) "Featured" 토글과 sort_order 업데이트로 프런트엔드 홈화면 노출을 제어.
//
// 렌더링 위치: /products/hotels 라우트.
//
// 백엔드 엔드포인트 요약:
//   GET    /admin/products                     (호텔 목록)
//   POST   /admin/products/hotels              (호텔 생성)
//   PUT    /admin/products/hotels/:id          (호텔 수정)
//   DELETE /admin/products/hotels/:id          (호텔 soft delete)
//   GET    /admin/products/room-types?hotel_id=
//   POST/PUT/DELETE  /admin/products/room-types(/:id)
//   PUT    /admin/products/featured            (featured 플래그/정렬)
//
// 주의:
//   - Featured 토글은 optimistic UI 이다. 서버 실패 시 즉시 값 복구.
//   - amenities 는 서버에 ','-구분 문자열로 저장되며 UI 도 그대로 노출.
//   - description_en/cn 은 RichTextEditor 의 innerHTML 문자열이다.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put, del } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ImageUploader from '../components/ImageUploader'
import RichTextEditor from '../components/RichTextEditor'
import BulkInventoryManager from '../components/BulkInventoryManager'
import PromotionManager from '../components/PromotionManager'

// 새 호텔 생성 시 사용하는 초기 폼 값.
const emptyHotel = {
  name_en: '', name_cn: '', description_en: '', description_cn: '',
  address: '', amenities: '', status: 'active', images: [],
  is_featured: 0, sort_order: 0,
}

// 새 객실 타입 생성 시 초기 폼 값. max_guests 는 2명 기본.
const emptyRoom = {
  name_en: '', name_cn: '', description_en: '', description_cn: '',
  max_guests: 2, bed_type: '', base_price: '', status: 'active', images: [],
}

// 드롭다운용 고정 옵션. DB 에는 문자열 그대로 저장된다.
const BED_TYPES = ['Single', 'Double', 'Twin', 'Queen', 'King', 'Suite']

/**
 * HotelManagement — 호텔/객실 타입 CRUD + 재고/프로모션 진입 UI.
 *
 * Props: 없음.
 *
 * 부작용:
 *   - /admin/products, /admin/products/hotels, /admin/products/room-types,
 *     /admin/products/featured 에 대한 GET/POST/PUT/DELETE.
 *   - 모달 열기/닫기, 목록 재조회.
 */
export default function HotelManagement() {
  // ----------------------------------------------------------------------
  // 호텔 레벨 상태
  //   hotels         : 호텔 목록
  //   showHotelModal : 호텔 생성/수정 모달
  //   editingHotel   : 수정 대상 호텔 (null 이면 생성)
  //   hotelForm      : 현재 편집 중 폼 값
  //   saving         : 저장 버튼 disable 플래그
  //   expandedHotel  : 현재 확장된 호텔의 id (객실 타입 드로어)
  // ----------------------------------------------------------------------
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showHotelModal, setShowHotelModal] = useState(false)
  const [editingHotel, setEditingHotel] = useState(null)
  const [hotelForm, setHotelForm] = useState({ ...emptyHotel })
  const [saving, setSaving] = useState(false)
  const [expandedHotel, setExpandedHotel] = useState(null)

  // ----------------------------------------------------------------------
  // 객실 타입 상태 (확장된 호텔 기준)
  //   roomTypes      : 현재 확장된 호텔의 객실 타입 배열
  //   showRoomModal  : 객실 타입 생성/수정 모달
  //   editingRoom    : 수정 대상 객실 타입
  //   roomForm       : 현재 편집 중 객실 폼
  // ----------------------------------------------------------------------
  const [roomTypes, setRoomTypes] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomForm, setRoomForm] = useState({ ...emptyRoom })

  // 재고 관리 모달: 어느 객실 타입의 재고를 편집 중인지.
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [inventoryRoom, setInventoryRoom] = useState(null)

  // 프로모션 모달: 어느 호텔 범위의 프로모션을 관리 중인지.
  const [showPromotionsModal, setShowPromotionsModal] = useState(false)
  const [promotionsHotelId, setPromotionsHotelId] = useState(null)

  const loadHotels = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await get('/admin/products')
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
      const res = await get(`/admin/products/room-types?hotel_id=${hotelId}`)
      setRoomTypes(res.room_types || res.rooms || res.data || [])
    } catch {
      setRoomTypes([])
    } finally {
      setLoadingRooms(false)
    }
  }

  // ----------------------------------------------------------------------
  // toggleFeatured — "홈 화면 피처드" 플래그 토글.
  // optimistic update: 먼저 UI 를 바꾸고, 서버가 실패하면 원상 복구.
  // (롤백 시 그냥 이전 hotel.is_featured 값을 다시 쓰면 된다.)
  // ----------------------------------------------------------------------
  const toggleFeatured = async (hotel) => {
    const hid = hotel._id || hotel.id
    const newVal = hotel.is_featured ? 0 : 1
    setHotels(prev => prev.map(h => (h._id || h.id) === hid ? { ...h, is_featured: newVal } : h))
    try {
      await put('/admin/products/featured', { product_type: 'hotel', product_id: hid, is_featured: newVal })
    } catch {
      setHotels(prev => prev.map(h => (h._id || h.id) === hid ? { ...h, is_featured: hotel.is_featured } : h))
    }
  }

  // 정렬 순서 업데이트. 숫자 입력이 바뀔 때마다 optimistic 반영.
  // 실패 시 롤백을 생략한 이유: 정렬은 사용자에게 시각적 크리티컬 수준이
  // 아니며, 다음 새로고침에서 자연스레 서버 값이 다시 반영된다.
  const updateSortOrder = async (hotel, newOrder) => {
    const hid = hotel._id || hotel.id
    const val = Number(newOrder) || 0
    setHotels(prev => prev.map(h => (h._id || h.id) === hid ? { ...h, sort_order: val } : h))
    try {
      await put('/admin/products/featured', { product_type: 'hotel', product_id: hid, sort_order: val })
    } catch {
      // revert silently
    }
  }

  // 같은 호텔을 다시 누르면 접고, 다른 호텔이면 확장 + 객실 타입 로드.
  const toggleExpand = (hotelId) => {
    if (expandedHotel === hotelId) {
      setExpandedHotel(null)
      setRoomTypes([])
    } else {
      setExpandedHotel(hotelId)
      loadRoomTypes(hotelId)
    }
  }

  // ---------- 호텔 CRUD 핸들러 ----------
  // 신규 호텔 생성 모달 열기.
  const openAddHotel = () => {
    setEditingHotel(null)
    setHotelForm({ ...emptyHotel })
    setShowHotelModal(true)
  }

  // 기존 호텔 수정 모달 열기. amenities 는 서버에서 배열로 내려오면 쉼표
  // 문자열로 합쳐서 input 에 넣어 준다(사용자는 쉼표 구분으로 편집).
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
      is_featured: hotel.is_featured || 0,
      sort_order: hotel.sort_order || 0,
    })
    setShowHotelModal(true)
  }

  // 저장: amenities 문자열을 서버용 배열로 파싱한 뒤 PUT/POST 호출.
  const saveHotel = async () => {
    setSaving(true)
    try {
      const payload = {
        ...hotelForm,
        // 'Pool, Gym, Spa' → ['Pool','Gym','Spa']. 빈 값은 제거.
        amenities: typeof hotelForm.amenities === 'string'
          ? hotelForm.amenities.split(',').map((a) => a.trim()).filter(Boolean)
          : hotelForm.amenities,
      }
      if (editingHotel) {
        await put(`/admin/products/${editingHotel._id || editingHotel.id}`, payload)
      } else {
        await post('/admin/products', payload)
      }
      setShowHotelModal(false)
      loadHotels()
    } catch (err) {
      alert('Failed to save hotel: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // 삭제 확인 후 DELETE 호출. 백엔드는 soft-delete(status='deleted')로 처리한다.
  const deleteHotel = async (hotel) => {
    if (!window.confirm(`Delete "${hotel.name_en}"? This action cannot be undone.`)) return
    try {
      await del(`/admin/products/${hotel._id || hotel.id}`)
      loadHotels()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  // ---------- 객실 타입 CRUD 핸들러 ----------
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
      bed_type: room.bed_type || '',
      base_price: room.base_price || '',
      status: room.status || 'active',
      images: room.images || [],
    })
    setShowRoomModal(true)
  }

  // 객실 타입 저장. 신규 생성 시에는 현재 확장된 호텔 id 를 hotel_id 로 붙인다.
  const saveRoom = async () => {
    setSaving(true)
    try {
      const payload = {
        ...roomForm,
        max_guests: Number(roomForm.max_guests),
        base_price: Number(roomForm.base_price) || 0,
      }
      if (editingRoom) {
        await put(`/admin/products/room-types/${editingRoom._id || editingRoom.id}`, payload)
      } else {
        await post('/admin/products/room-types', { ...payload, hotel_id: expandedHotel })
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
      await del(`/admin/products/room-types/${room._id || room.id}`)
      loadRoomTypes(expandedHotel)
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  // 재고 모달 열기 — 대상 객실 타입을 inventoryRoom 에 저장하고 표시.
  // 모달 내부는 BulkInventoryManager 에 위임한다.
  const openInventoryModal = (room) => {
    setInventoryRoom(room)
    setShowInventoryModal(true)
  }

  // 프로모션 모달 열기 — 대상 호텔 id 를 저장하고, PromotionManager 를 임베드.
  const openPromotionsModal = (hotelId) => {
    setPromotionsHotelId(hotelId)
    setShowPromotionsModal(true)
  }

  const formatCurrency = (v) => v != null && v !== '' ? '\u20a9' + Number(v).toLocaleString() : '-'

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
              <th style={{ width: 60 }}>Featured</th>
              <th style={{ width: 70 }}>Order</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {hotels.length === 0 ? (
              <tr>
                <td colSpan={8}>
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
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => toggleFeatured(hotel)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: hotel.is_featured ? '#f59e0b' : '#cbd5e1' }}
                          title={hotel.is_featured ? 'Remove from featured' : 'Mark as featured'}
                        >
                          {hotel.is_featured ? '\u2605' : '\u2606'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          value={hotel.sort_order || 0}
                          onChange={(e) => updateSortOrder(hotel, e.target.value)}
                          style={{ width: 50, padding: '2px 4px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.85rem' }}
                        />
                      </td>
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
                        <td colSpan={8} style={{ background: '#f8fafc', padding: '16px 24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Room Types</h4>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-sm"
                                style={{ background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 600 }}
                                onClick={() => openPromotionsModal(hid)}
                              >
                                {'\uD504\uB85C\uBAA8\uC158'} Promotions
                              </button>
                              <button className="btn btn-sm btn-primary" onClick={openAddRoom}>
                                + Add Room Type
                              </button>
                            </div>
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
                                  <th>Name</th>
                                  <th>Base Price</th>
                                  <th>Bed Type</th>
                                  <th>Max Guests</th>
                                  <th>Status</th>
                                  <th style={{ width: 320 }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {roomTypes.map((room) => {
                                  const rid = room._id || room.id
                                  return (
                                    <tr key={rid}>
                                      <td>
                                        <div style={{ fontWeight: 500 }}>{room.name_en}</div>
                                        {room.name_cn && (
                                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{room.name_cn}</div>
                                        )}
                                      </td>
                                      <td style={{ fontWeight: 600 }}>{formatCurrency(room.base_price)}</td>
                                      <td>{room.bed_type || '-'}</td>
                                      <td>{room.max_guests || room.maxGuests || '-'}</td>
                                      <td><StatusBadge status={room.status} /></td>
                                      <td>
                                        <div className="btn-group" style={{ flexWrap: 'wrap', gap: 4 }}>
                                          <button className="btn btn-sm btn-secondary" onClick={() => openEditRoom(room)}>
                                            Edit
                                          </button>
                                          <button
                                            className="btn btn-sm"
                                            style={{ background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600 }}
                                            onClick={() => openInventoryModal(room)}
                                          >
                                            {'\uC7AC\uACE0 \uBC0F \uAC00\uACA9 \uAD00\uB9AC'}
                                          </button>
                                          <button className="btn btn-sm btn-danger" onClick={() => deleteRoom(room)}>
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
        <div className="form-row">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={!!hotelForm.is_featured}
                onChange={(e) => setHotelForm({ ...hotelForm, is_featured: e.target.checked ? 1 : 0 })}
              />
              Featured on Homepage
            </label>
          </div>
          <div className="form-group">
            <label>Display Order (lower = first)</label>
            <input
              type="number"
              className="form-control"
              value={hotelForm.sort_order}
              onChange={(e) => setHotelForm({ ...hotelForm, sort_order: Number(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
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
            <label>Base Price ({'\u20a9'}) *</label>
            <input
              type="number"
              className="form-control"
              min={0}
              value={roomForm.base_price}
              onChange={(e) => setRoomForm({ ...roomForm, base_price: e.target.value })}
              placeholder="e.g. 150000"
            />
          </div>
          <div className="form-group">
            <label>Bed Type</label>
            <select
              className="form-control"
              value={roomForm.bed_type}
              onChange={(e) => setRoomForm({ ...roomForm, bed_type: e.target.value })}
            >
              <option value="">Select bed type</option>
              {BED_TYPES.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </div>
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

      {/* Inventory & Pricing Modal (Large) */}
      <Modal
        isOpen={showInventoryModal}
        onClose={() => { setShowInventoryModal(false); setInventoryRoom(null) }}
        title={`\uC7AC\uACE0 \uBC0F \uAC00\uACA9 \uAD00\uB9AC: ${inventoryRoom?.name_en || 'Room'}`}
        size="xl"
      >
        {inventoryRoom && (
          <BulkInventoryManager
            productType="room"
            productId={inventoryRoom._id || inventoryRoom.id}
          />
        )}
      </Modal>

      {/* Promotions Modal (Large) */}
      <Modal
        isOpen={showPromotionsModal}
        onClose={() => { setShowPromotionsModal(false); setPromotionsHotelId(null) }}
        title={`\uD504\uB85C\uBAA8\uC158 \uAD00\uB9AC (Hotel Promotions)`}
        size="xl"
      >
        {promotionsHotelId && (
          <PromotionManager productType="hotel" productId={promotionsHotelId} />
        )}
      </Modal>
    </div>
  )
}
