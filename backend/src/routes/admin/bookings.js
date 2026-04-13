// ============================================================================
// /api/admin/bookings — 관리자 예약 관리 라우트
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   GET  /stats         — 대시보드용 예약 통계
//   GET  /export        — 필터 조건에 맞는 예약을 CSV 로 다운로드
//   GET  /              — 페이지네이션/필터가 붙은 예약 목록
//   GET  /:id           — 예약 상세 (+ voucher/payment/product/user)
//   PUT  /:id/status    — 상태 변경 (cancelled/refunded 시 인벤토리 복원)
//   PUT  /:id/payment   — 결제 상태 동기화 (bookings + payments 양쪽)
//   POST /:id/refund    — 환불 처리 (+ 인벤토리 복원 + 바우처 취소)
//
// 공통 동작:
//   - 전체 라우터에 authenticate + requireAdmin 을 일괄 적용.
//   - cancelled/refunded 로 전이할 때는 반드시 routes/bookings.js 의
//     restoreBookingInventory 로 인벤토리를 되돌린다.
//     (이전 버전에서는 이 복원이 빠져 있어 관리자가 취소할 때마다 방/
//      티켓이 영구적으로 "팔린 상태" 로 남는 버그가 있었다.)
//   - 상태 값은 반드시 ALLOWED_BOOKING_STATUSES 안에서만 허용된다.
//     알 수 없는 문자열이 bookings.status 에 들어가면 대시보드/필터가
//     조용히 깨진다.
// ============================================================================

const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');
// 고객 예약 라우트(routes/bookings.js)의 인벤토리 복원 루프를 그대로
// 재사용한다. 관리자 취소/환불도 원래 예약이 점유했던 같은 날짜별
// 카운터를 풀어야 하므로 로직을 한 곳에 유지한다.
const { restoreBookingInventory, restoreAccessCodeUsage } = require('../bookings');

const router = express.Router();

// 관리자가 설정 가능한 booking status 허용 목록. 이 allow-list 는 필수
// — 임의 문자열이 status 컬럼에 들어가면 통계/필터 쿼리가 조용히 어긋난다.
const ALLOWED_BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'refunded', 'completed'];

// 이 라우터의 모든 엔드포인트는 관리자 인증이 필요하다.
router.use(authenticate, requireAdmin);

/**
 * GET /stats — 관리자 대시보드용 예약 통계.
 *
 * 응답 JSON:
 *   {
 *     total_bookings,           // 전체 예약 수
 *     total_revenue,            // 취소 제외 합계
 *     today_bookings,           // 오늘 생성된 예약 수
 *     status_breakdown: [{ status, count }],
 *     payment_breakdown: [{ payment_status, count }],
 *     product_breakdown: [{ product_type, count }]
 *   }
 */
router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings').get().count;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE status != 'cancelled'").get().total;

    const today = new Date().toISOString().split('T')[0];
    const todayBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE DATE(created_at) = ?").get(today).count;

    const statusBreakdown = db.prepare(`
      SELECT status, COUNT(*) as count FROM bookings GROUP BY status
    `).all();

    const paymentBreakdown = db.prepare(`
      SELECT payment_status, COUNT(*) as count FROM bookings GROUP BY payment_status
    `).all();

    const productBreakdown = db.prepare(`
      SELECT product_type, COUNT(*) as count FROM bookings GROUP BY product_type
    `).all();

    res.json({
      total_bookings: totalBookings,
      total_revenue: totalRevenue,
      today_bookings: todayBookings,
      status_breakdown: statusBreakdown,
      payment_breakdown: paymentBreakdown,
      product_breakdown: productBreakdown
    });
  } catch (err) {
    console.error('Admin booking stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /export — 필터된 예약 집합을 CSV 로 다운로드.
 *
 * Query (모두 optional): status, payment_status, product_type,
 *                       from_date, to_date (YYYY-MM-DD).
 *
 * 응답:
 *   Content-Type: text/csv
 *   Content-Disposition: attachment; filename=bookings_export.csv
 *
 * CSV 구축은 간단한 string concat 방식이지만, guest_name 은
 * 큰따옴표로 감싸고 내부의 " 를 "" 로 이스케이프해 RFC 4180 을 최소한
 * 준수한다. 다른 필드에 쉼표/따옴표가 포함될 가능성이 있다면 동일한
 * quote 로직을 적용해야 한다.
 */
router.get('/export', (req, res) => {
  try {
    const db = getDb();
    const { status, payment_status, product_type, from_date, to_date } = req.query;

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (payment_status) {
      query += ' AND payment_status = ?';
      params.push(payment_status);
    }
    if (product_type) {
      query += ' AND product_type = ?';
      params.push(product_type);
    }
    if (from_date) {
      query += ' AND DATE(created_at) >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND DATE(created_at) <= ?';
      params.push(to_date);
    }

    query += ' ORDER BY created_at DESC';

    const bookings = db.prepare(query).all(...params);

    // CSV 헤더 — 프런트 다운로드 UI 의 컬럼 라벨과 순서 맞춰 둔다.
    const headers = [
      'Booking Number', 'Guest Name', 'Guest Email', 'Guest Phone',
      'Product Type', 'Product ID', 'Check In', 'Check Out', 'Visit Date',
      'Guests', 'Quantity', 'Nights', 'Total Price', 'Currency',
      'Status', 'Payment Status', 'Created At'
    ];

    let csv = headers.join(',') + '\n';

    for (const b of bookings) {
      const row = [
        b.booking_number,
        // guest_name 은 쉼표/따옴표/한글 공백이 있을 수 있어 따옴표로 감싼다.
        // 내부 " 는 "" 로 이스케이프 — RFC 4180 CSV 규격.
        `"${(b.guest_name || '').replace(/"/g, '""')}"`,
        b.guest_email,
        b.guest_phone || '',
        b.product_type,
        b.product_id,
        b.check_in || '',
        b.check_out || '',
        b.visit_date || '',
        b.guests,
        b.quantity,
        b.nights,
        b.total_price,
        b.currency,
        b.status,
        b.payment_status,
        b.created_at
      ];
      csv += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bookings_export.csv');
    res.send(csv);
  } catch (err) {
    console.error('Admin export bookings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET / — 예약 목록 (필터 + 페이지네이션).
 *
 * Query:
 *   status, payment_status, product_type,
 *   from_date, to_date,
 *   search,                  // guest_name / email / booking_number 부분 일치
 *   page = 1, limit = 20
 *
 * 응답:
 *   200 {
 *     bookings: [...],
 *     pagination: { page, limit, total, total_pages }
 *   }
 *
 * 카운트 쿼리와 데이터 쿼리를 분리해 실행 — 같은 WHERE 절을 공유한다.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, payment_status, product_type, from_date, to_date, search, page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND b.status = ?';
      params.push(status);
    }
    if (payment_status) {
      whereClause += ' AND b.payment_status = ?';
      params.push(payment_status);
    }
    if (product_type) {
      whereClause += ' AND b.product_type = ?';
      params.push(product_type);
    }
    if (from_date) {
      whereClause += ' AND DATE(b.created_at) >= ?';
      params.push(from_date);
    }
    if (to_date) {
      whereClause += ' AND DATE(b.created_at) <= ?';
      params.push(to_date);
    }
    if (search) {
      whereClause += ' AND (b.guest_name LIKE ? OR b.guest_email LIKE ? OR b.booking_number LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const countQuery = `SELECT COUNT(*) as total FROM bookings b ${whereClause}`;
    const total = db.prepare(countQuery).get(...params).total;

    const dataQuery = `SELECT b.* FROM bookings b ${whereClause} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
    const bookings = db.prepare(dataQuery).all(...params, limitNum, offset);

    res.json({
      bookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Admin list bookings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id — 예약 상세. (고객용 GET /:id 와 비슷하지만 관리자용은
 * 소유자 검증 없이 언제나 열람 가능하고, 사용자 row 까지 함께 반환한다.)
 *
 * 응답: 200 { booking, voucher, payment, product, room_type, user }
 *       404 없음 | 500 내부 에러
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(booking.id);
    const payment = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id);

    let product = null;
    if (booking.product_type === 'hotel') {
      product = db.prepare('SELECT * FROM hotels WHERE id = ?').get(booking.product_id);
      if (product) product.amenities = JSON.parse(product.amenities || '[]');
    } else if (booking.product_type === 'ticket') {
      product = db.prepare('SELECT * FROM tickets WHERE id = ?').get(booking.product_id);
    } else if (booking.product_type === 'package') {
      product = db.prepare('SELECT * FROM packages WHERE id = ?').get(booking.product_id);
      if (product) product.includes = JSON.parse(product.includes || '[]');
    }

    let roomType = null;
    if (booking.room_type_id) {
      roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(booking.room_type_id);
      if (roomType) roomType.amenities = JSON.parse(roomType.amenities || '[]');
    }

    let user = null;
    if (booking.user_id) {
      user = db.prepare('SELECT id, email, name, phone, nationality, language FROM users WHERE id = ?').get(booking.user_id);
    }

    res.json({ booking, voucher, payment, product, room_type: roomType, user });
  } catch (err) {
    console.error('Admin get booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /:id/status — 예약 상태 변경.
 *
 * Body: { status }  // ALLOWED_BOOKING_STATUSES 중 하나
 *
 * 핵심 동작:
 *   - 상태가 `cancelled` 또는 `refunded` 로 전이할 때만 인벤토리를
 *     복원하고 바우처를 비활성화한다.
 *   - 이미 released 상태(already cancelled/refunded) 에서 다시 동일
 *     전이를 하면 double-decrement 방지를 위해 복원을 건너뛴다.
 *
 * 모든 쓰기는 db.transaction() 으로 감싸서, 중간에 실패해도 인벤토리만
 * 풀리고 status 는 그대로 남는 반쪽 상태가 생기지 않는다.
 *
 * 응답: 200 { message, booking } | 400 잘못된 status | 404 | 500
 *
 * 히스토리 노트: 예전 구현은 cancelled 로 바꿔도 인벤토리를 되돌리지
 * 않아 방/티켓이 조용히 "팔린 채" 로 남는 버그가 있었다. 이 구현은
 * 그 버그의 해결판이다.
 */
router.put('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }
    if (!ALLOWED_BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${ALLOWED_BOOKING_STATUSES.join(', ')}.`
      });
    }

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // 모든 쓰기를 단일 트랜잭션으로 감싼다. 중간 실패 시 인벤토리만 풀리고
    // status/바우처는 그대로 남는 불일치 상태를 방지한다.
    const updated = db.transaction(() => {
      // cancelled/refunded 로 전이할 때에만 인벤토리 복원. 이미 풀린
      // 상태였으면 복원을 건너뛰어 double-decrement 를 방지한다
      // (관리자가 취소 버튼을 두 번 누른 경우).
      const wasReleased = booking.status === 'cancelled' || booking.status === 'refunded';
      if (!wasReleased && (status === 'cancelled' || status === 'refunded')) {
        restoreBookingInventory(db, booking);
        // 이 예약이 access_code 로 만들어졌다면 해당 코드의 current_uses
        // 카운터도 1 되돌린다. booking.access_code_id 가 NULL 이면
        // no-op 이라 일반 예약에는 영향 없음. booking.js 의 고객 취소
        // 경로와 같은 헬퍼를 재사용해 로직이 두 곳으로 분기하지 않도록.
        restoreAccessCodeUsage(db, booking);
        db.prepare("UPDATE vouchers SET status = 'cancelled' WHERE booking_id = ?").run(booking.id);
      }

      db.prepare("UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .run(status, booking.id);

      return db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    })();

    res.json({ message: 'Booking status updated.', booking: updated });
  } catch (err) {
    console.error('Admin update booking status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /:id/payment — 결제 상태 동기화.
 *
 * Body: { payment_status, payment_id? }
 *
 * 세 개의 쓰기를 하나의 트랜잭션에 묶는다:
 *   1) bookings.payment_status (선택적으로 payment_id) 갱신
 *   2) 같은 booking 의 payments 행 status (선택적으로 stripe_payment_id) 갱신
 *   3) 결제가 'paid' 로 바뀌었고 예약이 아직 'pending' 이었다면 자동으로
 *      'confirmed' 로 승격
 *
 * 이 구조 덕분에 bookings 와 payments 두 테이블이 paid/unpaid 로 서로
 * 엇갈려 보이는 상태가 생기지 않는다.
 */
router.put('/:id/payment', (req, res) => {
  try {
    const db = getDb();
    const { payment_status, payment_id } = req.body;

    if (!payment_status) {
      return res.status(400).json({ error: 'payment_status is required.' });
    }

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const updated = db.transaction(() => {
      // bookings 테이블 측의 denormalized payment_status 를 갱신.
      // payment_id 는 결제 게이트웨이 참조 ID 를 저장하는 포인터.
      const updates = ["payment_status = ?", "updated_at = datetime('now')"];
      const values = [payment_status];

      if (payment_id) {
        updates.push('payment_id = ?');
        values.push(payment_id);
      }

      values.push(booking.id);
      db.prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      // 동일 변경을 payments 쪽에도 반영 — 두 테이블이 동기화된다.
      const paymentUpdates = ['status = ?'];
      const paymentValues = [payment_status];

      if (payment_id) {
        paymentUpdates.push('stripe_payment_id = ?');
        paymentValues.push(payment_id);
      }

      paymentValues.push(booking.id);
      db.prepare(`UPDATE payments SET ${paymentUpdates.join(', ')} WHERE booking_id = ?`).run(...paymentValues);

      // 결제가 방금 'paid' 로 바뀌었고 예약이 아직 'pending' 이라면
      // 자동으로 confirmed 로 승격. cancelled/refunded 같은 상태는
      // 의도적으로 건드리지 않는다.
      if (payment_status === 'paid') {
        db.prepare("UPDATE bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
          .run(booking.id);
      }

      return db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    })();

    res.json({ message: 'Payment status updated.', booking: updated });
  } catch (err) {
    console.error('Admin update payment status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /:id/refund — 환불 처리.
 *
 * Body: { refund_amount? }  // 생략 시 booking.total_price 전체 환불
 *
 * 동작(트랜잭션):
 *   - (아직 released 아님일 때만) 인벤토리 복원
 *   - payments.refund_amount 세팅, payments.status = 'refunded'
 *   - bookings.status / payment_status = 'refunded'
 *   - vouchers.status = 'cancelled'
 *
 * 응답: 200 { message, booking, payment } | 400 금액 유효성 | 404 | 500
 *
 * 인벤토리를 함께 풀지 않으면 리조트는 "환불했는데도 판매 가능한 수량
 * 이 줄어든 채" 남아 영원히 손해를 본다 — 반드시 복원한다.
 */
router.post('/:id/refund', (req, res) => {
  try {
    const db = getDb();
    const { refund_amount } = req.body;

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const payment = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    // refund_amount 가 없으면 전체 금액 환불. 0 이하거나 총액보다 크면 거부.
    const amount = refund_amount !== undefined ? refund_amount : booking.total_price;

    if (amount <= 0 || amount > booking.total_price) {
      return res.status(400).json({ error: 'Invalid refund amount.' });
    }

    const { updated, updatedPayment } = db.transaction(() => {
      // 이전 cancel/refund 로 이미 풀린 상태였다면 double-decrement 방지.
      const wasReleased = booking.status === 'cancelled' || booking.status === 'refunded';
      if (!wasReleased) {
        restoreBookingInventory(db, booking);
        // restricted 상품 예약이었다면 access code current_uses 도 1 반환.
        // 일반(코드 없는) 예약이면 booking.access_code_id == NULL 이어서
        // no-op. 고객 취소 경로와 같은 헬퍼를 재사용한다.
        restoreAccessCodeUsage(db, booking);
      }

      db.prepare("UPDATE payments SET refund_amount = ?, status = 'refunded' WHERE booking_id = ?")
        .run(amount, booking.id);

      db.prepare("UPDATE bookings SET status = 'refunded', payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?")
        .run(booking.id);

      db.prepare("UPDATE vouchers SET status = 'cancelled' WHERE booking_id = ?").run(booking.id);

      return {
        updated: db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id),
        updatedPayment: db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id)
      };
    })();

    res.json({
      message: 'Refund processed successfully.',
      booking: updated,
      payment: updatedPayment
    });
  } catch (err) {
    console.error('Admin refund error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
