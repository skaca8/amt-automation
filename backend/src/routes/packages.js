// ============================================================================
// /api/packages — 패키지 목록/상세/가용성 조회 (공개 API)
// ----------------------------------------------------------------------------
// 패키지는 "호텔 + 티켓" 조합 상품이다. package_items 테이블이 패키지 한
// 건이 어떤 room_type / ticket 을 얼마만큼 포함하는지를 기록한다.
//
// 이 파일이 제공하는 엔드포인트:
//   GET /                 — 활성 패키지 목록 (search 필터)
//   GET /:id              — 패키지 상세 + 포함 아이템 상세까지 resolve
//   GET /:id/availability — 특정 날짜의 가용 수량/가격
//
// includes 컬럼은 JSON 문자열(한눈에 보이는 구성 요약 배열)로, 응답 전에
// 배열로 파싱해 내보낸다.
// ============================================================================

const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

/**
 * GET / — 활성 패키지 목록.
 *
 * Query: { search? }
 * 응답: 200 { packages: [...] } — includes 는 JSON 파싱된 배열.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { search } = req.query;

    let query = 'SELECT * FROM packages WHERE status = ?';
    const params = ['active'];

    if (search) {
      query += ' AND (name_en LIKE ? OR name_cn LIKE ? OR description_en LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY is_featured DESC, sort_order ASC, id DESC';

    const packages = db.prepare(query).all(...params);

    const result = packages.map(pkg => ({
      ...pkg,
      includes: JSON.parse(pkg.includes || '[]')
    }));

    res.json({ packages: result });
  } catch (err) {
    console.error('List packages error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id — 패키지 상세 + package_items 의 각 아이템을 resolve 해서
 * 최소한의 이름/가격/이미지 정보를 함께 반환한다.
 *
 * 응답:
 *   200 {
 *     package: { ...pkg, includes: [...] },
 *     items: [{ ...package_items row, detail: {...} | null }]
 *   }
 *   404 패키지 없음 | 500 내부 에러
 *
 * item_type 분기:
 *   - 'hotel'     → hotels 에서 id/name/image_url
 *   - 'room_type' → room_types 에서 id/name/hotel_id/base_price/image
 *   - 'ticket'    → tickets 에서 id/name/base_price/image_url
 * 알 수 없는 타입은 detail = null.
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    pkg.includes = JSON.parse(pkg.includes || '[]');

    const items = db.prepare('SELECT * FROM package_items WHERE package_id = ?').all(pkg.id);

    // item_type 에 따라 참조하는 테이블이 다르므로 분기해 필요한 필드만
    // SELECT 한다. 이 선택적인 필드 목록은 프런트엔드 카드 UI 가 보여
    // 주는 최소 정보에 맞춰 둔 것이다.
    const resolvedItems = items.map(item => {
      let detail = null;
      if (item.item_type === 'hotel') {
        detail = db.prepare('SELECT id, name_en, name_cn, image_url FROM hotels WHERE id = ?').get(item.item_id);
      } else if (item.item_type === 'room_type') {
        detail = db.prepare('SELECT id, name_en, name_cn, hotel_id, base_price, image_url FROM room_types WHERE id = ?').get(item.item_id);
      } else if (item.item_type === 'ticket') {
        detail = db.prepare('SELECT id, name_en, name_cn, base_price, image_url FROM tickets WHERE id = ?').get(item.item_id);
      }

      return {
        ...item,
        detail
      };
    });

    res.json({ package: pkg, items: resolvedItems });
  } catch (err) {
    console.error('Get package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id/availability — 특정 날짜의 패키지 가용성/가격.
 *
 * Query: { date } 필수.
 * 응답: 200 { package: {id,name_en,name_cn}, date, available, price, is_available }
 *       400 date 누락 | 404 패키지 없음 | 500 내부 에러
 *
 * tickets.js 의 availability 와 거의 동일하지만 package_inventory 를 조회.
 */
router.get('/:id/availability', (req, res) => {
  try {
    const db = getDb();
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD).' });
    }

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    const inventory = db.prepare(`
      SELECT date, total_quantity, booked_quantity, price
      FROM package_inventory
      WHERE package_id = ? AND date = ?
    `).get(pkg.id, date);

    const available = inventory ? inventory.total_quantity - inventory.booked_quantity : 0;
    const price = inventory ? (inventory.price || pkg.base_price) : pkg.base_price;

    res.json({
      package: {
        id: pkg.id,
        name_en: pkg.name_en,
        name_cn: pkg.name_cn
      },
      date,
      available,
      price,
      is_available: available > 0
    });
  } catch (err) {
    console.error('Check package availability error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
