// ============================================================================
// Admin — 패키지(번들 상품) 관리 페이지 PackageManagement
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) 패키지 상품 목록 CRUD. 패키지는 "여러 하위 상품을 묶은 번들" 이다.
//   2) 패키지 내부의 items 배열을 편집. 각 item 은
//      { type: 'hotel'|'ticket', ref_id: <id>, room_type_id?, quantity }
//      형태로, 패키지가 판매될 때 포함되는 하위 상품을 가리킨다.
//   3) 편집 폼을 위해 호텔/티켓/객실 타입 목록을 미리 가져와 드롭다운을 구성.
//      (loadProductOptions 에서 병렬로 조회한다.)
//   4) 재고/프로모션 관리 임베드 컴포넌트와 연동.
//
// 렌더링 위치: /products/packages 라우트.
//
// 주의:
//   - loadProductOptions 는 호텔/티켓 2번 + 각 호텔마다 객실 타입 1번씩
//     (N+2) 회의 요청을 순차 수행한다. 호텔이 많아지면 느려질 수 있으므로
//     추후 단일 bulk 엔드포인트로 최적화하는 것을 고려할 것.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react'
import { get, post, put, del } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ImageUploader from '../components/ImageUploader'
import RichTextEditor from '../components/RichTextEditor'
import BulkInventoryManager from '../components/BulkInventoryManager'
import PromotionManager from '../components/PromotionManager'

// 신규 패키지 폼의 초기값. items 는 배열이며 폼에서 push/remove 한다.
const emptyPackage = {
  name_en: '', name_cn: '', description_en: '', description_cn: '',
  price: '', status: 'active', items: [], images: [],
  is_featured: 0, sort_order: 0,
}

/**
 * PackageManagement — 패키지(번들) 상품 CRUD + 구성 아이템 편집.
 *
 * 부작용: /admin/products/packages 및 /admin/products/featured GET/POST/PUT/DELETE.
 * loadProductOptions 단계에서 hotels/tickets/room-types 도 추가 조회.
 */
export default function PackageManagement() {
  // 목록/폼 기본 상태.
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyPackage })
  const [saving, setSaving] = useState(false)

  // items 드롭다운 옵션용 — 패키지 구성품으로 선택 가능한 호텔/티켓/객실 목록.
  // hotelRooms 는 { [hotelId]: RoomType[] } 형태의 맵.
  const [hotels, setHotels] = useState([])
  const [tickets, setTickets] = useState([])
  const [hotelRooms, setHotelRooms] = useState({})

  // 재고 모달 상태
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [inventoryPkg, setInventoryPkg] = useState(null)

  // 프로모션 모달 상태
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

  const toggleFeatured = async (pkg) => {
    const pid = pkg._id || pkg.id
    const newVal = pkg.is_featured ? 0 : 1
    setPackages(prev => prev.map(p => (p._id || p.id) === pid ? { ...p, is_featured: newVal } : p))
    try {
      await put('/admin/products/featured', { product_type: 'package', product_id: pid, is_featured: newVal })
    } catch {
      setPackages(prev => prev.map(p => (p._id || p.id) === pid ? { ...p, is_featured: pkg.is_featured } : p))
    }
  }

  const updateSortOrder = async (pkg, newOrder) => {
    const pid = pkg._id || pkg.id
    const val = Number(newOrder) || 0
    setPackages(prev => prev.map(p => (p._id || p.id) === pid ? { ...p, sort_order: val } : p))
    try {
      await put('/admin/products/featured', { product_type: 'package', product_id: pid, sort_order: val })
    } catch {
      // revert silently
    }
  }

  // ----------------------------------------------------------------------
  // loadProductOptions — items 드롭다운에 넣을 모든 옵션을 미리 가져온다.
  //   1) 호텔 목록 + 티켓 목록 병렬 fetch.
  //   2) 각 호텔마다 객실 타입을 순차 fetch 해 { hotelId: rooms[] } 맵을 만든다.
  // 병렬 대신 순차인 이유: 호텔이 수십 개 이상이면 동시 요청이 백엔드에
  // 부담을 줄 수 있고, 사용자 화면에는 loading 중 스피너가 이미 떠 있다.
  // ----------------------------------------------------------------------
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
          // 특정 호텔의 객실 조회 실패는 빈 배열로 대체. 전체 로딩을 깨지 않는다.
          roomMap[hid] = []
        }
      }
      setHotelRooms(roomMap)
    } catch {
      // 전체 실패 시에도 조용히 무시. 드롭다운이 비게 되지만 에러 배너는 안 띄운다.
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
      is_featured: pkg.is_featured || 0,
      sort_order: pkg.sort_order || 0,
    })
    setShowModal(true)
  }

  // 저장. 티켓과 마찬가지로 UI 의 'price' → 서버의 'base_price' 로 매핑.
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

  // ---------- 패키지 구성 items 편집 헬퍼 ----------
  // 새 아이템 추가. 기본 타입은 호텔, 기본 수량 1.
  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { type: 'hotel', product_id: '', room_type_id: '', quantity: 1 }],
    })
  }

  // 인덱스 기반 필드 업데이트. type 이 바뀌면 product_id / room_type_id 를
  // 초기화한다 — 이전 타입에서 선택한 id 가 다음 타입 드롭다운에 남으면
  // 유효하지 않은 참조가 되기 때문이다.
  const updateItem = (index, field, value) => {
    const updated = [...form.items]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'type') {
      updated[index].product_id = ''
      updated[index].room_type_id = ''
    }
    setForm({ ...form, items: updated })
  }

  // 인덱스 기반 아이템 제거.
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
              <th style={{ width: 60 }}>Featured</th>
              <th style={{ width: 70 }}>Order</th>
              <th style={{ width: 340 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {packages.length === 0 ? (
              <tr>
                <td colSpan={7}>
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
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => toggleFeatured(pkg)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: pkg.is_featured ? '#f59e0b' : '#cbd5e1' }}
                        title={pkg.is_featured ? 'Remove from featured' : 'Mark as featured'}
                      >
                        {pkg.is_featured ? '\u2605' : '\u2606'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        value={pkg.sort_order || 0}
                        onChange={(e) => updateSortOrder(pkg, e.target.value)}
                        style={{ width: 50, padding: '2px 4px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.85rem' }}
                      />
                    </td>
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
        <div className="form-row">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={!!form.is_featured}
                onChange={(e) => setForm({ ...form, is_featured: e.target.checked ? 1 : 0 })}
              />
              Featured on Homepage
            </label>
          </div>
          <div className="form-group">
            <label>Display Order (lower = first)</label>
            <input
              type="number"
              className="form-control"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
              placeholder="0"
            />
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
