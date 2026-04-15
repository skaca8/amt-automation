// ============================================================================
// /api/tickets — 티켓 목록/상세/가용성 조회 (공개 API)
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   GET /                 — 활성 티켓 목록 (category / search 필터)
//   GET /:id              — 티켓 상세
//   GET /:id/availability — 특정 날짜의 잔여 수량/가격 조회
//
// hotels.js 와 모양이 거의 같지만 인벤토리 단위가 "방 x 날짜" 가 아니라
// "수량 x 단일 날짜" 라서 availability 로직이 단순하다(루프 없음).
// 정렬 규칙: is_featured DESC → sort_order ASC → id DESC.
// ============================================================================

const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

/**
 * GET / — 활성 티켓 목록.
 *
 * Query: { category?, search? }
 * 응답: 200 { tickets: [...] } | 500 내부 에러
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category, search } = req.query;

    let query = 'SELECT * FROM tickets WHERE status = ?';
    const params = ['active'];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (name_en LIKE ? OR name_cn LIKE ? OR description_en LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY is_featured DESC, sort_order ASC, id DESC';

    const tickets = db.prepare(query).all(...params);

    res.json({ tickets });
  } catch (err) {
    console.error('List tickets error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id — 티켓 상세.
 * 응답: 200 { ticket } | 404 없음 | 500 내부 에러.
 * tickets.images / tickets.amenities 같은 JSON 컬럼은 이 파일에서는
 * 파싱하지 않는다 — 프런트가 필요 시 직접 파싱.
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    res.json({ ticket });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id/availability — 특정 날짜의 잔여 수량/가격.
 *
 * Query: { date }  — YYYY-MM-DD 필수.
 * 응답:
 *   200 { ticket: {id,name_en,name_cn}, date, available, price, is_available }
 *   400 date 누락 | 404 티켓 없음 | 500 내부 에러
 *
 * 가격 우선순위: ticket_inventory.price (있으면) → tickets.base_price.
 */
router.get('/:id/availability', (req, res) => {
  try {
    const db = getDb();
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD).' });
    }

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const inventory = db.prepare(`
      SELECT date, total_quantity, booked_quantity, price
      FROM ticket_inventory
      WHERE ticket_id = ? AND date = ?
    `).get(ticket.id, date);

    const available = inventory ? inventory.total_quantity - inventory.booked_quantity : 0;
    const price = inventory ? (inventory.price || ticket.base_price) : ticket.base_price;

    res.json({
      ticket: {
        id: ticket.id,
        name_en: ticket.name_en,
        name_cn: ticket.name_cn
      },
      date,
      available,
      price,
      is_available: available > 0
    });
  } catch (err) {
    console.error('Check ticket availability error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
