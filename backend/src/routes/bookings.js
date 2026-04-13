// ============================================================================
// /api/bookings — 예약 생성/조회/취소 라우트 (공개 + 인증 혼합)
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   POST /                — 예약 생성 (비회원/회원 모두 가능)
//   GET  /lookup          — 비회원용 booking_number + 이메일 조회
//   GET  /my              — 로그인 사용자의 예약 목록
//   GET  /:id             — 예약 상세 (+ voucher/payment/product)
//   PUT  /:id/cancel      — 예약 취소 + 인벤토리 복원
//
// 핵심 설계:
//   - 고객이 로그인하지 않은 "게스트 예약" 도 지원한다. 그래서 POST / 는
//     authenticate 미들웨어를 쓰지 않고, 대신 tryGetUserId() 로 토큰이
//     있으면 user_id 를 붙이고, 없으면 user_id = NULL 로 INSERT.
//   - 게스트가 나중에 예약을 다시 조회하려면 guest_email 을 query/body
//     로 제공해야 한다(isAuthorizedForBooking). 이렇게 해서 booking.id
//     나열만으로 임의 예약을 훔쳐보지 못하게 한다.
//   - 예약 생성 / 취소는 반드시 transaction() 으로 감싼다. 가용성 확인 →
//     인벤토리 감소 → 예약/결제/바우처 INSERT 가 한 단위여야 하고,
//     실패 시 전부 롤백돼야 하기 때문.
//
// 주의할 점:
//   - restoreBookingInventory 는 이 파일 외에도 admin/bookings.js 에서
//     module.exports 로 재사용된다. 동일한 MAX(0, x-qty) 로직을 두 번
//     적으면 동기화 버그가 생기기 쉬워 한 곳에만 둔다.
//   - 트랜잭션 콜백 안에서 throw 한 Error 에 `.status` 필드를 붙이면
//     위에서 HTTP 응답 코드로 번역된다 (400/404/500).
// ============================================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// Helpers
// ============================================================

/**
 * 사람이 보기 쉬운 예약 번호를 만든다. 형식: "BK-XXXXXXXXXXXX" (12자리 hex 대문자).
 * UUID v4 에서 dash 를 제거하고 앞 12자를 잘라 대문자로 변환한다.
 * 충돌 확률은 12자 대문자 hex ≈ 1/16^12 ≈ 무시할 수준이지만, DB 의
 * UNIQUE 제약이 최종 방어선 역할을 한다.
 */
function generateBookingNumber() {
  return 'BK-' + uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
}

/**
 * 고객 대면 바우처 코드를 만든다. 형식: "VCR-XXXXXXXXXX" (10자리).
 * vouchers.code 컬럼도 UNIQUE.
 */
function generateVoucherCode() {
  return 'VCR-' + uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase();
}

/**
 * 예약이 점유했던 인벤토리를 한 건씩 되돌린다(booked_* 감소).
 *
 * @param {DatabaseWrapper} db
 * @param {object} booking  bookings 테이블 row
 *
 * 하는 일:
 *   - hotel: check_in ~ check_out 범위의 매 날짜마다 room_inventory
 *            의 booked_rooms 를 qty 만큼 감소.
 *   - ticket: visit_date 하루치 ticket_inventory.booked_quantity 감소.
 *   - package: visit_date 하루치 package_inventory.booked_quantity 감소.
 *
 * 모든 UPDATE 는 `MAX(0, booked_* - qty)` 를 사용한다. 이렇게 해야
 * 관리자가 이미 취소된 예약을 다시 cancel/refund 해도 카운터가 음수로
 * 내려가지 않는다(double-call 안전).
 *
 * 주의: 이 함수는 자체적으로 transaction 을 시작하지 않는다.
 *       호출 측에서 db.transaction(...) 안에 넣어 사용할 것.
 *
 * 재사용: admin/bookings.js 의 취소/환불 경로가 module.exports 를 통해
 *         이 함수를 다시 import 한다.
 */
function restoreBookingInventory(db, booking) {
  if (!booking) return;
  const qty = booking.quantity || 1;

  if (booking.product_type === 'hotel' && booking.room_type_id && booking.check_in && booking.check_out) {
    // [check_in, check_out) 반 개방 구간을 하루씩 순회하며 감소.
    // 같은 prepared statement 를 재사용해서 매 루프마다 SQL 파싱 비용을
    // 줄인다.
    const updateInv = db.prepare(
      'UPDATE room_inventory SET booked_rooms = MAX(0, booked_rooms - ?) WHERE room_type_id = ? AND date = ?'
    );
    const cursor = new Date(booking.check_in);
    const endDate = new Date(booking.check_out);
    while (cursor < endDate) {
      // YYYY-MM-DD 로 정규화해 DB 의 date 컬럼과 매칭.
      const dateStr = cursor.toISOString().split('T')[0];
      updateInv.run(qty, booking.room_type_id, dateStr);
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (booking.product_type === 'ticket' && booking.visit_date) {
    db.prepare(
      'UPDATE ticket_inventory SET booked_quantity = MAX(0, booked_quantity - ?) WHERE ticket_id = ? AND date = ?'
    ).run(qty, booking.product_id, booking.visit_date);
  } else if (booking.product_type === 'package' && booking.visit_date) {
    db.prepare(
      'UPDATE package_inventory SET booked_quantity = MAX(0, booked_quantity - ?) WHERE package_id = ? AND date = ?'
    ).run(qty, booking.product_id, booking.visit_date);
  }
}

/**
 * Authorization 헤더에서 토큰을 선택적으로 디코드해 userId 를 꺼낸다.
 *
 * - 헤더가 없으면 null.
 * - 토큰이 잘못됐거나 만료됐으면 null (예외를 throw 하지 않음).
 *
 * "익명 접근 허용 + 로그인했다면 user_id 를 붙이기" 패턴이 필요한
 * 라우트(= 게스트 예약)에서 사용한다. authenticate 미들웨어처럼
 * 401 을 돌려주면 게스트 플로우 자체가 막히기 때문에 실패를 조용히
 * 흡수한다.
 */
function tryGetUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    return decoded.userId || null;
  } catch (e) {
    return null;
  }
}

/**
 * 주어진 booking 에 대한 접근 권한을 검사한다.
 *
 * 통과 조건(셋 중 하나라도 참이면 true):
 *   1) 로그인 상태이고 해당 예약의 user_id 가 본인 id 와 일치.
 *   2) 로그인 상태이고 role 이 admin.
 *   3) 요청 body 또는 query 에 제공된 guest_email 이 DB 의
 *      booking.guest_email 과 대소문자 무시로 일치.
 *
 * 3) 조건이 존재하는 이유: 게스트 예약(user_id = NULL) 도 예약 번호만
 *    알면 상세 조회/취소가 가능해야 하지만, ID 순차 조회(1,2,3..)로
 *    남의 예약을 훑는 것은 막아야 한다. "이메일 소유자만 접근 가능"
 *    규칙으로 타협했다.
 */
function isAuthorizedForBooking(req, booking) {
  const userId = tryGetUserId(req);
  if (userId) {
    const db = getDb();
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (user && user.role === 'admin') return true;
    if (user && booking.user_id && user.id === booking.user_id) return true;
  }

  // 게스트 검증: 호출자가 예약에 등록된 이메일을 알고 있음을 증명해야 한다.
  const providedEmail = (req.body && req.body.guest_email) || (req.query && req.query.guest_email);
  if (providedEmail && booking.guest_email &&
      providedEmail.toString().trim().toLowerCase() === booking.guest_email.toLowerCase()) {
    return true;
  }
  return false;
}

// ============================================================
// Routes
// ============================================================

/**
 * POST / — 예약 생성. 인증/비인증 모두 허용.
 *
 * 요청 바디:
 *   {
 *     guest_name, guest_email, guest_phone?,
 *     product_type: 'hotel'|'ticket'|'package',
 *     product_id,
 *     room_type_id?, check_in?, check_out?,   // hotel
 *     visit_date?,                             // ticket/package
 *     guests?, quantity?, special_requests?
 *   }
 *
 * 응답:
 *   201 { message, booking, voucher }
 *   400 필수 필드 누락 / 잘못된 product_type / 가용성 없음
 *   404 상품 없음
 *   500 내부 에러
 *
 * 트랜잭션 흐름:
 *   1) product_type 에 따라 가용성 확인 + 총액 계산.
 *   2) 동일 트랜잭션 안에서 해당 날짜의 booked_* 카운터 증가.
 *   3) bookings / payments / vouchers 세 테이블 INSERT.
 *   4) 어느 단계에서 에러가 나면 전체 ROLLBACK — 인벤토리 변경이
 *      되돌려져 "결제 안 된 유령 예약이 인벤토리만 먹은" 상태를 방지.
 *
 * 로그인 사용자: Authorization 헤더가 있으면 tryGetUserId() 로 user_id
 * 를 추출해 예약 row 에 붙인다. 아니면 NULL (= 게스트 예약).
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      guest_name,
      guest_email,
      guest_phone,
      product_type,
      product_id,
      room_type_id,
      check_in,
      check_out,
      visit_date,
      guests,
      quantity,
      special_requests
    } = req.body;

    // DB 에 손대기 전에 공통 필수 필드 검증. product_type 별 추가 검증은
    // 트랜잭션 내부에서 한다 (에러 throw → 자동 롤백).
    if (!guest_name || !guest_email || !product_type || !product_id) {
      return res.status(400).json({ error: 'guest_name, guest_email, product_type, and product_id are required.' });
    }

    if (!['hotel', 'ticket', 'package'].includes(product_type)) {
      return res.status(400).json({ error: 'product_type must be hotel, ticket, or package.' });
    }

    // 토큰이 있으면 로그인 사용자와 예약을 연결. 없거나 만료면 NULL 로
    // 두고 "게스트 예약" 으로 처리한다.
    const userId = tryGetUserId(req);

    const qty = quantity || 1;
    const guestCount = guests || 1;

    // config/database.js 의 transaction() 래퍼는 내부의 모든 saveDb()
    // 호출을 억제하고, 콜백이 정상 종료하면 COMMIT + saveDb 를 한 번에,
    // 예외가 throw 되면 ROLLBACK 을 실행한다. 아래 콜백 안의 어떤
    // 지점에서 throw 해도 자동으로 인벤토리 감소가 되돌려진다.
    let created;
    try {
      created = db.transaction(() => {
        let totalPrice = 0;
        let nights = 1;

        if (product_type === 'hotel') {
          if (!room_type_id || !check_in || !check_out) {
            // Error 객체에 .status 힌트를 붙여 throw 하면, 트랜잭션이
            // 롤백된 뒤 바깥 catch 블록이 그 값을 HTTP 상태 코드로
            // 변환해 응답한다. 일반 500 으로 덮지 않기 위한 패턴.
            const err = new Error('room_type_id, check_in, and check_out are required for hotel bookings.');
            err.status = 400;
            throw err;
          }

          const roomType = db.prepare('SELECT * FROM room_types WHERE id = ? AND status = ?').get(room_type_id, 'active');
          if (!roomType) {
            const err = new Error('Room type not found.');
            err.status = 404;
            throw err;
          }

          const startDate = new Date(check_in);
          const endDate = new Date(check_out);
          // 밀리초 단위 차이를 ms/day 로 나누고 올림. check_out 이
          // check_in 과 같거나 앞서면 nights <= 0 으로 걸러진다.
          nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
          if (nights <= 0) {
            const err = new Error('check_out must be after check_in.');
            err.status = 400;
            throw err;
          }

          // 가용성 검증과 인벤토리 증가를 한 번에 처리. 뒤에서 실패하면
          // 트랜잭션이 이 UPDATE 들을 전부 롤백한다.
          const updateInv = db.prepare('UPDATE room_inventory SET booked_rooms = booked_rooms + ? WHERE room_type_id = ? AND date = ?');
          const cursor = new Date(check_in);
          while (cursor < endDate) {
            const dateStr = cursor.toISOString().split('T')[0];
            const inv = db.prepare('SELECT * FROM room_inventory WHERE room_type_id = ? AND date = ?').get(room_type_id, dateStr);

            if (!inv || (inv.total_rooms - inv.booked_rooms) < qty) {
              // 단 하루라도 가용성이 부족하면 전체 실패 → 트랜잭션 롤백.
              const err = new Error(`No availability for ${dateStr}.`);
              err.status = 400;
              throw err;
            }

            // 가격은 해당 날짜의 인벤토리 per-date 가격이 있으면 그것을,
            // 없으면 room_type 의 기본 base_price 를 쓴다.
            const nightPrice = inv.price || roomType.base_price;
            totalPrice += nightPrice * qty;

            updateInv.run(qty, room_type_id, dateStr);
            cursor.setDate(cursor.getDate() + 1);
          }
        } else if (product_type === 'ticket') {
          if (!visit_date) {
            const err = new Error('visit_date is required for ticket bookings.');
            err.status = 400;
            throw err;
          }

          const ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND status = ?').get(product_id, 'active');
          if (!ticket) {
            const err = new Error('Ticket not found.');
            err.status = 404;
            throw err;
          }

          const inv = db.prepare('SELECT * FROM ticket_inventory WHERE ticket_id = ? AND date = ?').get(product_id, visit_date);
          if (!inv || (inv.total_quantity - inv.booked_quantity) < qty) {
            const err = new Error(`No availability for ${visit_date}.`);
            err.status = 400;
            throw err;
          }

          const price = inv.price || ticket.base_price;
          totalPrice = price * qty;

          db.prepare('UPDATE ticket_inventory SET booked_quantity = booked_quantity + ? WHERE ticket_id = ? AND date = ?')
            .run(qty, product_id, visit_date);
        } else if (product_type === 'package') {
          if (!visit_date) {
            const err = new Error('visit_date is required for package bookings.');
            err.status = 400;
            throw err;
          }

          const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND status = ?').get(product_id, 'active');
          if (!pkg) {
            const err = new Error('Package not found.');
            err.status = 404;
            throw err;
          }

          const inv = db.prepare('SELECT * FROM package_inventory WHERE package_id = ? AND date = ?').get(product_id, visit_date);
          if (!inv || (inv.total_quantity - inv.booked_quantity) < qty) {
            const err = new Error(`No availability for ${visit_date}.`);
            err.status = 400;
            throw err;
          }

          const price = inv.price || pkg.base_price;
          totalPrice = price * qty;

          db.prepare('UPDATE package_inventory SET booked_quantity = booked_quantity + ? WHERE package_id = ? AND date = ?')
            .run(qty, product_id, visit_date);
        }

        const bookingNumber = generateBookingNumber();

        // 예약 / 결제(초기 상태: pending) / 바우처를 동일 트랜잭션 안에서
        // INSERT 한다. 한 건이라도 실패하면 위의 인벤토리 감소까지 전부
        // 롤백된다.
        const insertResult = db.prepare(`
          INSERT INTO bookings (booking_number, user_id, guest_name, guest_email, guest_phone, product_type, product_id, room_type_id, check_in, check_out, visit_date, guests, quantity, nights, total_price, special_requests)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          bookingNumber, userId, guest_name, guest_email, guest_phone || null,
          product_type, product_id, room_type_id || null,
          check_in || null, check_out || null, visit_date || null,
          guestCount, qty, nights, totalPrice, special_requests || null
        );

        const bookingId = insertResult.lastInsertRowid;
        if (!bookingId) {
          // 심층 방어(defense-in-depth): lastInsertRowid 가 비는 경우는
          // 정상 플로우에선 올 수 없지만, 여기서 중단해 결제/바우처가
          // 붙을 booking row 없이 고아 레코드가 생기는 일을 막는다.
          const err = new Error('Failed to persist booking.');
          err.status = 500;
          throw err;
        }

        db.prepare(`
          INSERT INTO payments (booking_id, amount, currency, method, status)
          VALUES (?, ?, 'KRW', 'stripe', 'pending')
        `).run(bookingId, totalPrice);

        const voucherCode = generateVoucherCode();
        const qrData = JSON.stringify({
          booking_number: bookingNumber,
          voucher_code: voucherCode,
          product_type,
          guest_name,
          total_price: totalPrice
        });

        db.prepare(`
          INSERT INTO vouchers (booking_id, code, qr_data)
          VALUES (?, ?, ?)
        `).run(bookingId, voucherCode, qrData);

        const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
        const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(bookingId);
        return { booking, voucher };
      })();
    } catch (txErr) {
      // 트랜잭션 내부에서 throw 된 Error 의 .status 힌트를 실제 HTTP
      // 응답 코드로 변환한다. .status 가 없는 예외는 진짜 서버 버그로
      // 간주하고 outer catch → 500 으로 흘려보낸다.
      if (txErr && txErr.status) {
        return res.status(txErr.status).json({ error: txErr.message });
      }
      throw txErr;
    }

    res.status(201).json({
      message: 'Booking created successfully.',
      booking: created.booking,
      voucher: created.voucher
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /lookup — 게스트용 예약 조회.
 *
 * Query: { email?, phone?, booking_number? }
 * 적어도 booking_number 또는 email 이 있어야 한다.
 *
 * 응답: { bookings: [{ ...booking, voucher }] }
 *
 * 의도적으로 공개(미인증) 엔드포인트다. 확인 메일을 잃어버린 게스트도
 * 이메일 + 예약 번호만으로 내 예약을 다시 찾을 수 있어야 하기 때문.
 * 악용 가능성이 있어 WHERE 조건은 전부 exact match (LIKE 아님) 이다.
 */
router.get('/lookup', (req, res) => {
  try {
    const db = getDb();
    const { email, phone, booking_number } = req.query;

    if (!booking_number && !email) {
      return res.status(400).json({ error: 'booking_number or email is required for lookup.' });
    }

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (booking_number) {
      query += ' AND booking_number = ?';
      params.push(booking_number);
    }

    if (email) {
      query += ' AND guest_email = ?';
      params.push(email);
    }

    if (phone) {
      query += ' AND guest_phone = ?';
      params.push(phone);
    }

    query += ' ORDER BY created_at DESC';

    const bookings = db.prepare(query).all(...params);

    // 각 예약에 바우처를 합쳐 반환. 프런트엔드가 목록 페이지에서 바우처
    // 상태를 바로 보여줄 수 있게 해준다.
    const results = bookings.map(booking => {
      const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(booking.id);
      return { ...booking, voucher };
    });

    res.json({ bookings: results });
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /my — 로그인 사용자의 예약 목록.
 *
 * 인증 필수(authenticate 미들웨어). 각 예약에 바우처를 합쳐 반환한다.
 *
 * 응답: { bookings: [{ ...booking, voucher }] }
 */
router.get('/my', authenticate, (req, res) => {
  try {
    const db = getDb();
    const bookings = db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);

    const results = bookings.map(booking => {
      const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(booking.id);
      return { ...booking, voucher };
    });

    res.json({ bookings: results });
  } catch (err) {
    console.error('My bookings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id — 예약 상세 (+ voucher / payment / product / room_type).
 *
 * 권한: isAuthorizedForBooking 통과 필요. 순차 ID 로 남의 예약을
 * 열람하는 것을 막기 위해 게스트는 guest_email query 파라미터를
 * 반드시 같이 보내야 한다.
 *
 * 응답:
 *   200 { booking, voucher, payment, product, room_type }
 *       — product.amenities / package.includes 는 JSON 파싱한 배열.
 *   403 권한 없음
 *   404 예약 없음
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (!isAuthorizedForBooking(req, booking)) {
      return res.status(403).json({ error: 'Not authorized to view this booking.' });
    }

    const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(booking.id);
    const payment = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id);

    // 상품 세부 정보를 함께 채워 주어 프런트엔드 확인/상세 페이지가
    // 두 번째 round-trip 없이 렌더링할 수 있게 한다. JSON 배열 컬럼
    // (amenities / includes) 은 여기서 파싱한다.
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

    res.json({ booking, voucher, payment, product, room_type: roomType });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /:id/cancel — 고객 또는 관리자 측 예약 취소.
 *
 * 권한: GET /:id 와 동일 (isAuthorizedForBooking).
 *
 * 플로우(트랜잭션):
 *   1) restoreBookingInventory 로 점유 인벤토리 반환.
 *   2) bookings.status = 'cancelled', updated_at 갱신.
 *   3) vouchers.status = 'cancelled'.
 *
 * 응답:
 *   200 { message, booking } — 갱신된 booking row
 *   400 이미 취소됨
 *   403 권한 없음
 *   404 예약 없음
 *   500 내부 에러
 */
router.put('/:id/cancel', (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (!isAuthorizedForBooking(req, booking)) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking.' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled.' });
    }

    // 인벤토리 복원 → 예약 상태 변경 → 바우처 비활성을 한 트랜잭션에서
    // 처리한다. 중간에 크래시가 나도 "인벤토리는 풀렸는데 예약은 아직
    // confirmed" 같은 반쯤 취소된 상태가 생기지 않는다.
    const updated = db.transaction(() => {
      restoreBookingInventory(db, booking);
      db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(booking.id);
      db.prepare("UPDATE vouchers SET status = 'cancelled' WHERE booking_id = ?").run(booking.id);
      return db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    })();

    res.json({ message: 'Booking cancelled successfully.', booking: updated });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
// 관리자 라우트(routes/admin/bookings.js)가 동일한 인벤토리 복원
// 로직을 재사용할 수 있도록 함수 자체를 router 객체에 얹어 export 한다.
// require('../bookings').restoreBookingInventory 로 꺼내 쓴다.
module.exports.restoreBookingInventory = restoreBookingInventory;
