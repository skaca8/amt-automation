// ============================================================================
// /api/admin/payments — 관리자 결제 관리 라우트
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   GET /stats         — 결제 통계 (금액/건수/상태별)
//   GET /              — 결제 목록 (filter + pagination + booking JOIN)
//   GET /:id           — 결제 상세 (+ 연관 booking 요약)
//   PUT /:id/status    — 결제 상태 수정 (+ bookings.payment_status 동기화)
//
// 쿼리 파라미터 관례: from_date / to_date 는 YYYY-MM-DD 형식 문자열로
// `DATE(p.created_at)` 와 비교한다. 관리자 필터 UI 가 이 이름을 그대로
// 쓰므로 바꾸지 말 것.
// ============================================================================

const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// 관리자 인증 필수.
router.use(authenticate, requireAdmin);

/**
 * GET /stats — 결제 통계.
 *
 * 응답:
 *   {
 *     total_payments, total_amount, total_refunds, pending_payments,
 *     status_breakdown: [{ status, count, total_amount }],
 *     method_breakdown: [{ method, count, total_amount }],
 *     today: { count, total }
 *   }
 */
router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    const totalPayments = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
    const totalAmount = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'paid'").get().total;
    const totalRefunds = db.prepare("SELECT COALESCE(SUM(refund_amount), 0) as total FROM payments WHERE refund_amount > 0").get().total;
    const pendingPayments = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'").get().count;

    const statusBreakdown = db.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
      FROM payments
      GROUP BY status
    `).all();

    const methodBreakdown = db.prepare(`
      SELECT method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
      FROM payments
      GROUP BY method
    `).all();

    const today = new Date().toISOString().split('T')[0];
    const todayPayments = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(created_at) = ? AND status = 'paid'").get(today);

    res.json({
      total_payments: totalPayments,
      total_amount: totalAmount,
      total_refunds: totalRefunds,
      pending_payments: pendingPayments,
      status_breakdown: statusBreakdown,
      method_breakdown: methodBreakdown,
      today: {
        count: todayPayments.count,
        total: todayPayments.total
      }
    });
  } catch (err) {
    console.error('Admin payment stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET / — 결제 목록 (필터 + 페이지네이션).
 *
 * Query: { status?, method?, from_date?, to_date?, page=1, limit=20 }
 * 응답: { payments: [...], pagination: {...} }
 *
 * payments 에 bookings 를 LEFT JOIN 해서 guest_name/email/booking_number
 * 까지 한 번에 내보낸다 — 관리자 테이블 렌더링의 두 번째 round-trip 제거.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, method, from_date, to_date, page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }
    if (method) {
      whereClause += ' AND p.method = ?';
      params.push(method);
    }
    if (from_date) {
      whereClause += ' AND DATE(p.created_at) >= ?';
      params.push(from_date);
    }
    if (to_date) {
      whereClause += ' AND DATE(p.created_at) <= ?';
      params.push(to_date);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM payments p ${whereClause}`).get(...params).count;

    const payments = db.prepare(`
      SELECT p.*, b.booking_number, b.guest_name, b.guest_email, b.product_type
      FROM payments p
      LEFT JOIN bookings b ON p.booking_id = b.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      payments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Admin list payments error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id — 결제 상세 (+ 연관 booking 요약 필드).
 *
 * 응답: 200 { payment } | 404 없음 | 500 내부 에러
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const payment = db.prepare(`
      SELECT p.*, b.booking_number, b.guest_name, b.guest_email, b.guest_phone,
             b.product_type, b.product_id, b.total_price, b.status as booking_status
      FROM payments p
      LEFT JOIN bookings b ON p.booking_id = b.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    res.json({ payment });
  } catch (err) {
    console.error('Admin get payment error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /:id/status — 결제 상태를 직접 수정.
 *
 * Body: { status, stripe_payment_id? }
 *
 * 부작용:
 *   1) payments.status (+ stripe_payment_id) 갱신
 *   2) bookings.payment_status 도 동일 값으로 갱신
 *   3) 'paid' 로 바뀌었고 예약이 'pending' 이었으면 자동으로 confirmed
 *
 * NOTE: 이 라우트는 admin/bookings.js 의 PUT /:id/payment 와 유사한
 * 역할을 하지만 진입점이 다르다 (관리자 결제 화면에서 직접 편집).
 */
router.put('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status, stripe_payment_id } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const updates = ['status = ?'];
    const values = [status];

    if (stripe_payment_id) {
      updates.push('stripe_payment_id = ?');
      values.push(stripe_payment_id);
    }

    values.push(req.params.id);
    db.prepare(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // bookings.payment_status 와 동기화 — 두 테이블의 불일치 방지.
    db.prepare("UPDATE bookings SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, payment.booking_id);

    // 결제가 'paid' 로 확정되면 pending 예약을 confirmed 로 자동 승격.
    if (status === 'paid') {
      db.prepare("UPDATE bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").run(payment.booking_id);
    }

    const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    res.json({ message: 'Payment status updated.', payment: updated });
  } catch (err) {
    console.error('Admin update payment status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
