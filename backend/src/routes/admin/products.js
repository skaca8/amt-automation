// ============================================================================
// /api/admin/products — 관리자 상품 CRUD (+ 인벤토리 관리)
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트는 4개 리소스를 다룬다:
//
//   HOTELS:
//     GET /                POST /               PUT /:id              DELETE /:id
//
//   ROOM TYPES:
//     GET /room-types      POST /room-types     PUT /room-types/:id   DELETE /room-types/:id
//
//   TICKETS:
//     GET /tickets         POST /tickets        PUT /tickets/:id      DELETE /tickets/:id
//
//   PACKAGES:
//     GET /packages        POST /packages       PUT /packages/:id     DELETE /packages/:id
//
//   INVENTORY:
//     GET/PUT /room-inventory, /ticket-inventory, /package-inventory
//     POST /*-inventory/bulk   — 날짜 범위 + 요일 필터 기반 일괄 설정
//
//   공통:
//     PUT /featured        — 상품의 is_featured / sort_order 빠른 토글
//
// 공통 규약:
//   - DELETE 는 soft delete. row 를 지우지 않고 status='inactive' 로 표기한다.
//     공개 목록 라우트가 WHERE status='active' 로 필터링하므로 자동으로 숨는다.
//   - amenities / images / includes 컬럼은 JSON 문자열 저장. 응답 전에
//     JSON.parse, INSERT/UPDATE 시 JSON.stringify.
//   - 인벤토리 UPSERT 는 `ON CONFLICT(...) DO UPDATE` 로 날짜별 중복을 덮어쓴다.
//     bulk 버전은 `CASE WHEN ? IS NOT NULL THEN ? ELSE existing END` 패턴으로
//     "null 로 넘기면 기존 값 유지" 의미론을 구현한다.
// ============================================================================

const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// 전체 라우터에 관리자 인증 적용.
router.use(authenticate, requireAdmin);

// 허용된 product_type 값 → 실제 테이블 이름 매핑. 명시적인 allow-list 를
// 두는 이유: 과거 구현에서는 알 수 없는 product_type 이 조용히 'packages'
// 로 폴백돼 엉뚱한 테이블에 쓰는 버그가 있었다. 이 map 에 없는 값은
// 400 으로 거부된다.
const PRODUCT_TABLES = {
  hotel: 'hotels',
  ticket: 'tickets',
  package: 'packages',
};

/**
 * PUT /featured — 상품의 featured 플래그 / sort_order 를 빠르게 토글.
 *
 * Body: { product_type, product_id, is_featured?, sort_order? }
 *
 * product_type 이 PRODUCT_TABLES 에 없으면 400. 이 allow-list 덕분에
 * 동적 table 문자열 삽입도 안전하다(사용자 입력이 직접 SQL 에 가지 않음).
 *
 * 응답: 200 { message } | 400 유효성 | 500 내부 에러
 */
router.put('/featured', (req, res) => {
  try {
    const db = getDb();
    const { product_type, product_id, is_featured, sort_order } = req.body;

    if (!product_type || !product_id) {
      return res.status(400).json({ error: 'product_type and product_id are required.' });
    }

    const table = PRODUCT_TABLES[product_type];
    if (!table) {
      return res.status(400).json({
        error: `product_type must be one of: ${Object.keys(PRODUCT_TABLES).join(', ')}.`
      });
    }

    const updates = [];
    const values = [];

    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(product_id);
    // `table` 은 PRODUCT_TABLES allow-list 에서 온 값이라 SQL 삽입이
    // 안전하다 — 사용자 입력 문자열이 직접 쿼리에 들어가지 않는다.
    db.prepare(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Featured status updated.' });
  } catch (err) {
    console.error('Update featured error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// HOTELS CRUD
// ============================================================
// 관리자용이므로 status='inactive' 도 모두 반환한다 (공개 라우트
// routes/hotels.js 와는 달리). soft delete 된 호텔을 복구하거나 수정하기
// 위함.

/**
 * GET / — 모든 호텔 목록 (inactive 포함).
 * amenities / images 는 JSON.parse 된 배열로 반환.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const hotels = db.prepare('SELECT * FROM hotels ORDER BY id DESC').all();
    const result = hotels.map(h => ({
      ...h,
      amenities: JSON.parse(h.amenities || '[]'),
      images: JSON.parse(h.images || '[]')
    }));
    res.json({ hotels: result });
  } catch (err) {
    console.error('Admin list hotels error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST / — 호텔 생성.
 * 필수: name_en. 나머지는 null 허용 / 기본값 사용.
 * amenities, images 는 배열로 받아 JSON.stringify 후 저장.
 * is_featured 는 0/1 정수 컬럼이므로 boolean 을 캐스팅.
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, images, status, is_featured, sort_order } = req.body;

    if (!name_en) {
      return res.status(400).json({ error: 'name_en is required.' });
    }

    const result = db.prepare(`
      INSERT INTO hotels (name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, images, status, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_en, name_cn || null, description_en || null, description_cn || null,
      address || null, image_url || null, rating || 0,
      JSON.stringify(amenities || []), JSON.stringify(images || []), status || 'active',
      is_featured ? 1 : 0, sort_order || 0
    );

    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(result.lastInsertRowid);
    hotel.amenities = JSON.parse(hotel.amenities || '[]');
    hotel.images = JSON.parse(hotel.images || '[]');

    res.status(201).json({ message: 'Hotel created.', hotel });
  } catch (err) {
    console.error('Admin create hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /:id — 호텔 부분 수정. 동적 UPDATE 빌더 패턴 (req.body 에 들어온
 * 필드만 SET). amenities/images 는 배열 → JSON.stringify.
 */
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    const { name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, images, status, is_featured, sort_order } = req.body;

    const updates = [];
    const values = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (rating !== undefined) { updates.push('rating = ?'); values.push(rating); }
    if (amenities !== undefined) { updates.push('amenities = ?'); values.push(JSON.stringify(amenities)); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE hotels SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    updated.amenities = JSON.parse(updated.amenities || '[]');
    updated.images = JSON.parse(updated.images || '[]');

    res.json({ message: 'Hotel updated.', hotel: updated });
  } catch (err) {
    console.error('Admin update hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * DELETE /:id — 호텔 soft delete (status='inactive').
 * 실제 레코드 삭제가 아니므로 FK 참조(room_types, bookings)는 그대로 남는다.
 * 공개 라우트는 status='active' 만 반환하므로 자동으로 숨겨진다.
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    db.prepare("UPDATE hotels SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Hotel deleted.' });
  } catch (err) {
    console.error('Admin delete hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// ROOM TYPES CRUD
// ============================================================

/**
 * GET /room-types — 방 타입 목록.
 * Query: { hotel_id? }  — 호텔별 필터.
 * 응답: room_types 에 LEFT JOIN 으로 hotel_name 을 붙여서 반환.
 * amenities / images 는 JSON 파싱된 배열.
 */
router.get('/room-types', (req, res) => {
  try {
    const db = getDb();
    const { hotel_id } = req.query;

    let query = 'SELECT rt.*, h.name_en as hotel_name FROM room_types rt LEFT JOIN hotels h ON rt.hotel_id = h.id';
    const params = [];

    if (hotel_id) {
      query += ' WHERE rt.hotel_id = ?';
      params.push(hotel_id);
    }

    query += ' ORDER BY rt.id DESC';

    const roomTypes = db.prepare(query).all(...params);
    const result = roomTypes.map(rt => ({
      ...rt,
      amenities: JSON.parse(rt.amenities || '[]'),
      images: JSON.parse(rt.images || '[]')
    }));

    res.json({ room_types: result });
  } catch (err) {
    console.error('Admin list room types error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /room-types — 방 타입 생성.
 * 필수: hotel_id, name_en, base_price. hotel_id 존재 여부 확인 후 INSERT.
 */
router.post('/room-types', (req, res) => {
  try {
    const db = getDb();
    const { hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, images, base_price, status } = req.body;

    if (!hotel_id || !name_en || base_price === undefined) {
      return res.status(400).json({ error: 'hotel_id, name_en, and base_price are required.' });
    }

    const hotel = db.prepare('SELECT id FROM hotels WHERE id = ?').get(hotel_id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    const result = db.prepare(`
      INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, images, base_price, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hotel_id, name_en, name_cn || null, description_en || null, description_cn || null,
      max_guests || 2, bed_type || null, JSON.stringify(amenities || []),
      image_url || null, JSON.stringify(images || []), base_price, status || 'active'
    );

    const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(result.lastInsertRowid);
    roomType.amenities = JSON.parse(roomType.amenities || '[]');
    roomType.images = JSON.parse(roomType.images || '[]');

    res.status(201).json({ message: 'Room type created.', room_type: roomType });
  } catch (err) {
    console.error('Admin create room type error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /room-types/:id — 방 타입 부분 수정.
 * hotel_id 까지 변경 가능하다 (한 호텔의 방을 다른 호텔로 이관 등).
 */
router.put('/room-types/:id', (req, res) => {
  try {
    const db = getDb();
    const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found.' });
    }

    const { hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, images, base_price, status } = req.body;

    const updates = [];
    const values = [];

    if (hotel_id !== undefined) { updates.push('hotel_id = ?'); values.push(hotel_id); }
    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (max_guests !== undefined) { updates.push('max_guests = ?'); values.push(max_guests); }
    if (bed_type !== undefined) { updates.push('bed_type = ?'); values.push(bed_type); }
    if (amenities !== undefined) { updates.push('amenities = ?'); values.push(JSON.stringify(amenities)); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (base_price !== undefined) { updates.push('base_price = ?'); values.push(base_price); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE room_types SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
    updated.amenities = JSON.parse(updated.amenities || '[]');
    updated.images = JSON.parse(updated.images || '[]');

    res.json({ message: 'Room type updated.', room_type: updated });
  } catch (err) {
    console.error('Admin update room type error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * DELETE /room-types/:id — 방 타입 soft delete.
 */
router.delete('/room-types/:id', (req, res) => {
  try {
    const db = getDb();
    const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found.' });
    }

    db.prepare("UPDATE room_types SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Room type deleted.' });
  } catch (err) {
    console.error('Admin delete room type error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// TICKETS CRUD
// ============================================================
// 기본 구조는 HOTELS 와 동일. 주요 차이점은 category/duration/location
// 같은 티켓 전용 필드가 있다는 것뿐.

/** GET /tickets — 모든 티켓 목록. */
router.get('/tickets', (req, res) => {
  try {
    const db = getDb();
    const tickets = db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();
    res.json({ tickets });
  } catch (err) {
    console.error('Admin list tickets error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** POST /tickets — 티켓 생성. 필수: name_en, base_price. */
router.post('/tickets', (req, res) => {
  try {
    const db = getDb();
    const { name_en, name_cn, description_en, description_cn, category, image_url, images, base_price, duration, location, status, is_featured, sort_order } = req.body;

    if (!name_en || base_price === undefined) {
      return res.status(400).json({ error: 'name_en and base_price are required.' });
    }

    const result = db.prepare(`
      INSERT INTO tickets (name_en, name_cn, description_en, description_cn, category, image_url, images, base_price, duration, location, status, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_en, name_cn || null, description_en || null, description_cn || null,
      category || null, image_url || null, JSON.stringify(images || []), base_price,
      duration || null, location || null, status || 'active',
      is_featured ? 1 : 0, sort_order || 0
    );

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid);
    ticket.images = JSON.parse(ticket.images || '[]');
    res.status(201).json({ message: 'Ticket created.', ticket });
  } catch (err) {
    console.error('Admin create ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** PUT /tickets/:id — 티켓 부분 수정. */
router.put('/tickets/:id', (req, res) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const { name_en, name_cn, description_en, description_cn, category, image_url, images, base_price, duration, location, status, is_featured, sort_order } = req.body;

    const updates = [];
    const values = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (base_price !== undefined) { updates.push('base_price = ?'); values.push(base_price); }
    if (duration !== undefined) { updates.push('duration = ?'); values.push(duration); }
    if (location !== undefined) { updates.push('location = ?'); values.push(location); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    updated.images = JSON.parse(updated.images || '[]');
    res.json({ message: 'Ticket updated.', ticket: updated });
  } catch (err) {
    console.error('Admin update ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** DELETE /tickets/:id — 티켓 soft delete. */
router.delete('/tickets/:id', (req, res) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    db.prepare("UPDATE tickets SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Ticket deleted.' });
  } catch (err) {
    console.error('Admin delete ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// PACKAGES CRUD
// ============================================================
// 패키지는 package_items 라는 자식 테이블을 가진다. POST/PUT 에서
// items 배열을 받으면 package_items 를 DELETE-and-INSERT 방식으로
// 전부 새로 쓴다 (diff 계산보다 단순/안전하고, 아이템 수가 적어 부담
// 없음).

/** GET /packages — 모든 패키지 목록 (includes/images JSON 파싱). */
router.get('/packages', (req, res) => {
  try {
    const db = getDb();
    const packages = db.prepare('SELECT * FROM packages ORDER BY id DESC').all();
    const result = packages.map(p => ({
      ...p,
      includes: JSON.parse(p.includes || '[]'),
      images: JSON.parse(p.images || '[]')
    }));
    res.json({ packages: result });
  } catch (err) {
    console.error('Admin list packages error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /packages — 패키지 생성 + 선택적으로 package_items 일괄 INSERT.
 *
 * Body: { ...package fields, items?: [{ item_type, item_id, quantity? }] }
 *
 * items 배열이 있으면 패키지 INSERT 후 각 item 을 package_items 에
 * INSERT 한다. item_type 은 seed 와 동일하게 'hotel' | 'room_type' |
 * 'ticket' 중 하나를 사용하는 것이 관례.
 */
router.post('/packages', (req, res) => {
  try {
    const db = getDb();
    const { name_en, name_cn, description_en, description_cn, image_url, images, base_price, includes, duration, status, items, is_featured, sort_order } = req.body;

    if (!name_en || base_price === undefined) {
      return res.status(400).json({ error: 'name_en and base_price are required.' });
    }

    const result = db.prepare(`
      INSERT INTO packages (name_en, name_cn, description_en, description_cn, image_url, images, base_price, includes, duration, status, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_en, name_cn || null, description_en || null, description_cn || null,
      image_url || null, JSON.stringify(images || []), base_price, JSON.stringify(includes || []),
      duration || null, status || 'active',
      is_featured ? 1 : 0, sort_order || 0
    );

    const packageId = result.lastInsertRowid;

    // items 배열이 넘어왔으면 package_items 도 같이 INSERT. 같은 prepared
    // statement 를 재사용해 반복 SQL 파싱 비용을 피한다.
    if (items && Array.isArray(items)) {
      const insertItem = db.prepare('INSERT INTO package_items (package_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(packageId, item.item_type, item.item_id, item.quantity || 1);
      }
    }

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(packageId);
    pkg.includes = JSON.parse(pkg.includes || '[]');
    pkg.images = JSON.parse(pkg.images || '[]');
    const packageItems = db.prepare('SELECT * FROM package_items WHERE package_id = ?').all(packageId);

    res.status(201).json({ message: 'Package created.', package: pkg, items: packageItems });
  } catch (err) {
    console.error('Admin create package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /packages/:id — 패키지 부분 수정 + 옵션으로 items 전체 교체.
 *
 * items 배열이 넘어오면 package_items 를 DELETE 한 뒤 다시 INSERT 한다
 * (전체 교체 의미론). items 를 생략하면 기존 아이템 구성은 그대로 유지.
 */
router.put('/packages/:id', (req, res) => {
  try {
    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    const { name_en, name_cn, description_en, description_cn, image_url, images, base_price, includes, duration, status, items, is_featured, sort_order } = req.body;

    const updates = [];
    const values = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (base_price !== undefined) { updates.push('base_price = ?'); values.push(base_price); }
    if (includes !== undefined) { updates.push('includes = ?'); values.push(JSON.stringify(includes)); }
    if (duration !== undefined) { updates.push('duration = ?'); values.push(duration); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE packages SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // items 가 있으면 DELETE-and-INSERT 로 아이템 구성을 전체 교체.
    // diff 계산 없이 단순히 다 지우고 다시 넣는 편이 버그가 적다.
    if (items && Array.isArray(items)) {
      db.prepare('DELETE FROM package_items WHERE package_id = ?').run(req.params.id);
      const insertItem = db.prepare('INSERT INTO package_items (package_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(req.params.id, item.item_type, item.item_id, item.quantity || 1);
      }
    }

    const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    updated.includes = JSON.parse(updated.includes || '[]');
    updated.images = JSON.parse(updated.images || '[]');
    const packageItems = db.prepare('SELECT * FROM package_items WHERE package_id = ?').all(req.params.id);

    res.json({ message: 'Package updated.', package: updated, items: packageItems });
  } catch (err) {
    console.error('Admin update package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** DELETE /packages/:id — 패키지 soft delete. package_items 는 그대로 둔다. */
router.delete('/packages/:id', (req, res) => {
  try {
    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    db.prepare("UPDATE packages SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Package deleted.' });
  } catch (err) {
    console.error('Admin delete package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// INVENTORY MANAGEMENT
// ============================================================
// 각 상품 타입마다 날짜별 인벤토리(남은 수량 + 가격) 를 CRUD 하는
// 엔드포인트가 있다. 세 가지 테이블(room_inventory / ticket_inventory /
// package_inventory)은 컬럼 구조가 거의 같아서 코드 모양도 평행하다.
//
// 세 가지 패턴:
//   1) GET /{type}-inventory/:id?from_date=&to_date=
//        단순 기간 조회.
//   2) PUT /{type}-inventory
//        { id, items: [{ date, total, price }] } 를 받아 UPSERT 일괄.
//   3) POST /{type}-inventory/bulk
//        { id, start_date, end_date, total_quantity?, price?, days_of_week? }
//        로 날짜 범위에 걸쳐 UPSERT. days_of_week 가 없으면 모든 요일,
//        있으면 지정 요일(0=일요일~6=토요일)에만 적용한다.
//        total_quantity / price 를 null 로 넘기면 기존 값을 그대로 유지.

/** GET /room-inventory/:room_type_id — 특정 방 타입의 재고 기간 조회. */
router.get('/room-inventory/:room_type_id', (req, res) => {
  try {
    const db = getDb();
    const { from_date, to_date } = req.query;
    let query = 'SELECT * FROM room_inventory WHERE room_type_id = ?';
    const params = [req.params.room_type_id];
    if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
    query += ' ORDER BY date ASC';
    const inventory = db.prepare(query).all(...params);
    res.json({ inventory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** GET /ticket-inventory/:ticket_id — 티켓 재고 기간 조회. */
router.get('/ticket-inventory/:ticket_id', (req, res) => {
  try {
    const db = getDb();
    const { from_date, to_date } = req.query;
    let query = 'SELECT * FROM ticket_inventory WHERE ticket_id = ?';
    const params = [req.params.ticket_id];
    if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
    query += ' ORDER BY date ASC';
    const inventory = db.prepare(query).all(...params);
    res.json({ inventory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** GET /package-inventory/:package_id — 패키지 재고 기간 조회. */
router.get('/package-inventory/:package_id', (req, res) => {
  try {
    const db = getDb();
    const { from_date, to_date } = req.query;
    let query = 'SELECT * FROM package_inventory WHERE package_id = ?';
    const params = [req.params.package_id];
    if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
    query += ' ORDER BY date ASC';
    const inventory = db.prepare(query).all(...params);
    res.json({ inventory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /room-inventory — 명시적 날짜 배열 UPSERT.
 *
 * Body: { room_type_id, items: [{ date, total, price }] }
 *
 * `ON CONFLICT(room_type_id, date) DO UPDATE` 로 기존 row 를 덮어쓴다.
 * 전체 items 를 단일 트랜잭션으로 실행해 saveDb 호출을 한 번으로 줄인다.
 */
router.put('/room-inventory', (req, res) => {
  try {
    const db = getDb();
    const { room_type_id, items } = req.body;

    if (!room_type_id || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'room_type_id and items array are required.' });
    }

    const roomType = db.prepare('SELECT id FROM room_types WHERE id = ?').get(room_type_id);
    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found.' });
    }

    const upsert = db.prepare(`
      INSERT INTO room_inventory (room_type_id, date, total_rooms, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(room_type_id, date) DO UPDATE SET
        total_rooms = excluded.total_rooms,
        price = excluded.price
    `);

    const transaction = db.transaction((entries) => {
      for (const entry of entries) {
        upsert.run(room_type_id, entry.date, entry.total, entry.price);
      }
    });

    transaction(items);

    res.json({ message: `Room inventory updated for ${items.length} dates.` });
  } catch (err) {
    console.error('Admin update room inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** PUT /ticket-inventory — 동일 패턴을 ticket_inventory 에 적용. */
router.put('/ticket-inventory', (req, res) => {
  try {
    const db = getDb();
    const { ticket_id, items } = req.body;

    if (!ticket_id || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'ticket_id and items array are required.' });
    }

    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticket_id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const upsert = db.prepare(`
      INSERT INTO ticket_inventory (ticket_id, date, total_quantity, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(ticket_id, date) DO UPDATE SET
        total_quantity = excluded.total_quantity,
        price = excluded.price
    `);

    const transaction = db.transaction((entries) => {
      for (const entry of entries) {
        upsert.run(ticket_id, entry.date, entry.total, entry.price);
      }
    });

    transaction(items);

    res.json({ message: `Ticket inventory updated for ${items.length} dates.` });
  } catch (err) {
    console.error('Admin update ticket inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** PUT /package-inventory — 동일 패턴을 package_inventory 에 적용. */
router.put('/package-inventory', (req, res) => {
  try {
    const db = getDb();
    const { package_id, items } = req.body;

    if (!package_id || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'package_id and items array are required.' });
    }

    const pkg = db.prepare('SELECT id FROM packages WHERE id = ?').get(package_id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    const upsert = db.prepare(`
      INSERT INTO package_inventory (package_id, date, total_quantity, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(package_id, date) DO UPDATE SET
        total_quantity = excluded.total_quantity,
        price = excluded.price
    `);

    const transaction = db.transaction((entries) => {
      for (const entry of entries) {
        upsert.run(package_id, entry.date, entry.total, entry.price);
      }
    });

    transaction(items);

    res.json({ message: `Package inventory updated for ${items.length} dates.` });
  } catch (err) {
    console.error('Admin update package inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /room-inventory/bulk — 날짜 범위 + 요일 필터 기반 일괄 설정.
 *
 * Body:
 *   {
 *     room_type_id,
 *     start_date, end_date,       // YYYY-MM-DD
 *     total_rooms?, price?,       // null 이면 기존 값 유지 의미
 *     days_of_week?: number[]     // [0-6] 중 일부. 비면 모든 요일.
 *   }
 *
 * 주의: total_rooms 와 price 는 null 로 넘기면 기존 row 를 유지하는
 * "부분 업데이트" 의미가 되도록 SQL CASE 절에서 별도 처리한다. 이 때문에
 * bind 파라미터가 반복 사용된다 (t, t, p, p).
 */
router.post('/room-inventory/bulk', (req, res) => {
  try {
    const db = getDb();
    const { room_type_id, start_date, end_date, total_rooms, price, days_of_week } = req.body;
    // days_of_week: 0-6 정수 배열(0 = 일요일). 비어 있거나 생략되면
    // 모든 요일에 적용된다. "주말만 가격 올리기" 같은 유스케이스를
    // 지원하기 위한 필터.

    if (!room_type_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'room_type_id, start_date, and end_date are required.' });
    }

    const upsert = db.prepare(`
      INSERT INTO room_inventory (room_type_id, date, total_rooms, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(room_type_id, date) DO UPDATE SET
        total_rooms = CASE WHEN ? IS NOT NULL THEN ? ELSE room_inventory.total_rooms END,
        price = CASE WHEN ? IS NOT NULL THEN ? ELSE room_inventory.price END
    `);

    let count = 0;
    const current = new Date(start_date);
    const end = new Date(end_date);

    const transaction = db.transaction(() => {
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (!days_of_week || days_of_week.length === 0 || days_of_week.includes(dayOfWeek)) {
          const dateStr = current.toISOString().split('T')[0];
          const t = total_rooms !== undefined && total_rooms !== null ? total_rooms : null;
          const p = price !== undefined && price !== null ? price : null;
          upsert.run(room_type_id, dateStr, t || 0, p, t, t, p, p);
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
    });
    transaction();

    res.json({ message: `Room inventory updated for ${count} dates.` });
  } catch (err) {
    console.error('Bulk room inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** POST /ticket-inventory/bulk — 날짜 범위 기반 일괄 설정 (티켓). 패턴 동일. */
router.post('/ticket-inventory/bulk', (req, res) => {
  try {
    const db = getDb();
    const { ticket_id, start_date, end_date, total_quantity, price, days_of_week } = req.body;

    if (!ticket_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'ticket_id, start_date, and end_date are required.' });
    }

    const upsert = db.prepare(`
      INSERT INTO ticket_inventory (ticket_id, date, total_quantity, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(ticket_id, date) DO UPDATE SET
        total_quantity = CASE WHEN ? IS NOT NULL THEN ? ELSE ticket_inventory.total_quantity END,
        price = CASE WHEN ? IS NOT NULL THEN ? ELSE ticket_inventory.price END
    `);

    let count = 0;
    const current = new Date(start_date);
    const end = new Date(end_date);

    const transaction = db.transaction(() => {
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (!days_of_week || days_of_week.length === 0 || days_of_week.includes(dayOfWeek)) {
          const dateStr = current.toISOString().split('T')[0];
          const t = total_quantity !== undefined && total_quantity !== null ? total_quantity : null;
          const p = price !== undefined && price !== null ? price : null;
          upsert.run(ticket_id, dateStr, t || 0, p, t, t, p, p);
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
    });
    transaction();

    res.json({ message: `Ticket inventory updated for ${count} dates.` });
  } catch (err) {
    console.error('Bulk ticket inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/** POST /package-inventory/bulk — 날짜 범위 기반 일괄 설정 (패키지). */
router.post('/package-inventory/bulk', (req, res) => {
  try {
    const db = getDb();
    const { package_id, start_date, end_date, total_quantity, price, days_of_week } = req.body;

    if (!package_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'package_id, start_date, and end_date are required.' });
    }

    const upsert = db.prepare(`
      INSERT INTO package_inventory (package_id, date, total_quantity, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(package_id, date) DO UPDATE SET
        total_quantity = CASE WHEN ? IS NOT NULL THEN ? ELSE package_inventory.total_quantity END,
        price = CASE WHEN ? IS NOT NULL THEN ? ELSE package_inventory.price END
    `);

    let count = 0;
    const current = new Date(start_date);
    const end = new Date(end_date);

    const transaction = db.transaction(() => {
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (!days_of_week || days_of_week.length === 0 || days_of_week.includes(dayOfWeek)) {
          const dateStr = current.toISOString().split('T')[0];
          const t = total_quantity !== undefined && total_quantity !== null ? total_quantity : null;
          const p = price !== undefined && price !== null ? price : null;
          upsert.run(package_id, dateStr, t || 0, p, t, t, p, p);
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
    });
    transaction();

    res.json({ message: `Package inventory updated for ${count} dates.` });
  } catch (err) {
    console.error('Bulk package inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
