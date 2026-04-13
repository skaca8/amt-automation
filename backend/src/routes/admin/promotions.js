// ============================================================================
// /api/admin/promotions — 프로모션(할인) 관리 라우트
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   GET    /active  — 현재 활성 중인 프로모션 (start/end 날짜 범위 충족)
//   GET    /        — 전체 프로모션 목록 (status, product_type 필터)
//   POST   /        — 프로모션 생성
//   PUT    /:id     — 프로모션 수정 (부분 업데이트)
//   DELETE /:id     — soft delete (status = 'inactive')
//
// 특이 컬럼 blackout_dates:
//   - DB 에 JSON 문자열(TEXT)로 저장. 응답 직전에 JSON.parse 해서 배열로
//     내보낸다. INSERT/UPDATE 시 배열이면 stringify, 이미 문자열이면 그대로
//     사용해 이중 인코딩을 피한다.
//   - 프런트엔드가 배열로 다루기 쉽게 parseBlackoutDates 헬퍼를 통해
//     일관되게 변환한다.
// ============================================================================

const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

/**
 * blackout_dates 컬럼(TEXT JSON)을 배열로 파싱해 promo row 에 다시 붙인다.
 * JSON.parse 실패나 null 컬럼에 대해서도 안전하게 [] 를 반환한다.
 * 같은 객체를 수정해서 반환(in-place mutation).
 */
function parseBlackoutDates(promo) {
  if (promo && promo.blackout_dates) {
    try {
      promo.blackout_dates = JSON.parse(promo.blackout_dates);
    } catch {
      promo.blackout_dates = [];
    }
  } else if (promo) {
    promo.blackout_dates = [];
  }
  return promo;
}

/**
 * GET /active — 오늘 날짜가 start_date ~ end_date 범위에 들어가고 status=active
 * 인 프로모션을 반환한다. start/end 가 NULL 인 프로모션(무기한)도 포함.
 */
router.get('/active', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const promotions = db.prepare(`
      SELECT * FROM promotions
      WHERE status = 'active'
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY id DESC
    `).all(today, today).map(parseBlackoutDates);
    res.json({ promotions });
  } catch (err) {
    console.error('List active promotions error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET / — 프로모션 목록.
 * Query: { status?, product_type? }  — 단순 일치 필터.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, product_type } = req.query;

    let query = 'SELECT * FROM promotions WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (product_type) {
      query += ' AND product_type = ?';
      params.push(product_type);
    }

    query += ' ORDER BY id DESC';

    const promotions = db.prepare(query).all(...params).map(parseBlackoutDates);
    res.json({ promotions });
  } catch (err) {
    console.error('List promotions error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST / — 프로모션 생성.
 *
 * Body:
 *   { name, discount_type?, discount_value, product_type?, product_id?,
 *     start_date?, end_date?, min_quantity?, max_uses?, status?,
 *     blackout_dates? }
 *
 * - discount_type 기본값은 'percentage'. 'fixed' 도 허용.
 * - blackout_dates 가 배열이면 stringify, 문자열이면 그대로 저장해
 *   이중 인코딩을 막는다.
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      name, discount_type, discount_value, product_type, product_id,
      start_date, end_date, min_quantity, max_uses, status, blackout_dates
    } = req.body;

    if (!name || discount_value === undefined) {
      return res.status(400).json({ error: 'name and discount_value are required.' });
    }

    const validTypes = ['fixed', 'percentage'];
    if (discount_type && !validTypes.includes(discount_type)) {
      return res.status(400).json({ error: 'discount_type must be "fixed" or "percentage".' });
    }

    // 배열이면 직렬화, 이미 문자열이면 그대로. 이중 인코딩(예: "\"[...]\"")
    // 을 만들지 않도록 타입을 확인한다. undefined 이면 빈 배열.
    const blackoutStr = blackout_dates
      ? (typeof blackout_dates === 'string' ? blackout_dates : JSON.stringify(blackout_dates))
      : '[]';

    const result = db.prepare(`
      INSERT INTO promotions (name, discount_type, discount_value, product_type, product_id, start_date, end_date, min_quantity, max_uses, status, blackout_dates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      discount_type || 'percentage',
      discount_value,
      product_type || null,
      product_id || null,
      start_date || null,
      end_date || null,
      min_quantity || 1,
      max_uses || null,
      status || 'active',
      blackoutStr
    );

    const promotion = parseBlackoutDates(db.prepare('SELECT * FROM promotions WHERE id = ?').get(result.lastInsertRowid));
    res.status(201).json({ message: 'Promotion created.', promotion });
  } catch (err) {
    console.error('Create promotion error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /:id — 프로모션 부분 수정.
 *
 * 같은 동적 UPDATE 빌더 패턴을 사용해 바디에 들어온 필드만 SET.
 * discount_type 이 들어오면 'fixed'/'percentage' 유효성 검증을 추가로 한다.
 */
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const promotion = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id);
    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found.' });
    }

    const {
      name, discount_type, discount_value, product_type, product_id,
      start_date, end_date, min_quantity, max_uses, current_uses, status, blackout_dates
    } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (discount_type !== undefined) {
      const validTypes = ['fixed', 'percentage'];
      if (!validTypes.includes(discount_type)) {
        return res.status(400).json({ error: 'discount_type must be "fixed" or "percentage".' });
      }
      updates.push('discount_type = ?'); values.push(discount_type);
    }
    if (discount_value !== undefined) { updates.push('discount_value = ?'); values.push(discount_value); }
    if (product_type !== undefined) { updates.push('product_type = ?'); values.push(product_type); }
    if (product_id !== undefined) { updates.push('product_id = ?'); values.push(product_id); }
    if (start_date !== undefined) { updates.push('start_date = ?'); values.push(start_date); }
    if (end_date !== undefined) { updates.push('end_date = ?'); values.push(end_date); }
    if (min_quantity !== undefined) { updates.push('min_quantity = ?'); values.push(min_quantity); }
    if (max_uses !== undefined) { updates.push('max_uses = ?'); values.push(max_uses); }
    if (current_uses !== undefined) { updates.push('current_uses = ?'); values.push(current_uses); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (blackout_dates !== undefined) {
      const blackoutStr = typeof blackout_dates === 'string' ? blackout_dates : JSON.stringify(blackout_dates);
      updates.push('blackout_dates = ?'); values.push(blackoutStr);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE promotions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = parseBlackoutDates(db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id));
    res.json({ message: 'Promotion updated.', promotion: updated });
  } catch (err) {
    console.error('Update promotion error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * DELETE /:id — soft delete. 레코드를 실제로 지우지 않고
 * status = 'inactive' 로 표기한다 (과거 사용 내역 추적을 위해).
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const promotion = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id);
    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found.' });
    }

    db.prepare("UPDATE promotions SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Promotion deleted.' });
  } catch (err) {
    console.error('Delete promotion error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
