// ============================================================================
// /api/admin/access-codes — 관리자 전용: 구매 게이트용 access code 발급 CRUD
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   관리자가 "특정 유저 × 특정 상품" 조합으로 유니크한 구매 권한 코드를
//   발급/조회/수정/철회할 수 있게 한다. 발급된 코드는 POST /api/bookings
//   경로에서 is_restricted=1 상품에 대한 게이트 통과 증표로 소비된다.
//
//   이 라우터 자체는 코드의 "수명주기 관리" 만 담당하고, 실제 소비(예약
//   생성 시 current_uses ±1)는 routes/bookings.js 의 트랜잭션 안에서
//   일어난다. 그래야 가용성 체크 · 재고 감소 · 코드 소비가 한 단위로
//   원자적으로 커밋되거나 롤백된다.
//
// 엔드포인트:
//   GET    /        — 필터 + 페이지네이션 된 목록 (유저 이메일 join)
//   POST   /        — 새 코드 발급 (코드 문자열은 서버가 생성)
//   GET    /:id     — 상세 (해당 코드로 만들어진 예약 목록 join 포함)
//   PUT    /:id     — note / max_uses / valid_until / status 수정
//   DELETE /:id     — soft revoke (status='revoked')
//
// 모든 엔드포인트는 authenticate + requireAdmin 으로 게이팅된다.
// ============================================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// product_type allow-list. routes/admin/products.js 의 PRODUCT_TABLES 와
// 같은 3개 값만 허용한다. 여기 없는 값이 들어오면 어떤 라우트든 400.
const ALLOWED_PRODUCT_TYPES = ['hotel', 'ticket', 'package'];

// 관리자 전체 권한 게이트.
router.use(authenticate, requireAdmin);

/**
 * 사람이 복사/붙여넣기 가능한 access code 문자열을 생성한다.
 * 형식: "ACG-XXXXXXXXXXXX" (ACG = Access Grant, 12자리 hex 대문자).
 *
 * BK- / VCR- 코드와 동일한 패턴을 따른다. UNIQUE 제약이 DB 에 있어
 * 충돌 시 INSERT 가 실패하는데, 12자 hex 충돌 확률은 무시 가능 수준이다.
 */
function generateAccessCode() {
  return 'ACG-' + uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
}

/**
 * GET / — access code 목록 조회 (필터 + 페이지네이션).
 *
 * Query (전부 optional):
 *   user_id       — 특정 유저에게 발급된 코드만
 *   product_type  — 'hotel' | 'ticket' | 'package'
 *   product_id
 *   status        — 'active' | 'exhausted' | 'revoked'
 *   search        — code 문자열 부분 일치(ilike)
 *   page          — 1 기본
 *   limit         — 20 기본
 *
 * 응답:
 *   200 {
 *     access_codes: [{ ...row, user_email, user_name }],
 *     pagination: { page, limit, total, total_pages }
 *   }
 *
 * 유저 이메일/이름은 관리자 UI 가 리스트에서 한눈에 보기 쉽도록 join.
 * 상품 이름은 여기서 붙이지 않는다 — 관리자 UI 가 이미 상품 리스트를
 * 메모리에 갖고 있어 클라이언트에서 매핑하는 편이 단순하다.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { user_id, product_type, product_id, status, search, page, limit } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offset = (pageNum - 1) * limitNum;

    // WHERE 절을 동적으로 조립. 각 필터 값이 있을 때만 조건을 추가하는
    // 패턴은 routes/admin/bookings.js 의 GET / 와 동일하다.
    let where = ' WHERE 1=1';
    const params = [];

    if (user_id) { where += ' AND ac.user_id = ?'; params.push(user_id); }
    if (product_type) {
      // allow-list 범위 밖의 값은 거절 — 오탈자를 조용히 삼키지 않도록.
      if (!ALLOWED_PRODUCT_TYPES.includes(product_type)) {
        return res.status(400).json({
          error: `product_type must be one of: ${ALLOWED_PRODUCT_TYPES.join(', ')}.`
        });
      }
      where += ' AND ac.product_type = ?'; params.push(product_type);
    }
    if (product_id) { where += ' AND ac.product_id = ?'; params.push(product_id); }
    if (status) { where += ' AND ac.status = ?'; params.push(status); }
    if (search) { where += ' AND ac.code LIKE ?'; params.push('%' + search + '%'); }

    // COUNT 쿼리와 SELECT 쿼리가 같은 WHERE 를 공유한다.
    const total = db.prepare(`SELECT COUNT(*) as count FROM access_codes ac ${where}`)
      .get(...params).count;

    const rows = db.prepare(`
      SELECT ac.*, u.email AS user_email, u.name AS user_name
      FROM access_codes ac
      LEFT JOIN users u ON u.id = ac.user_id
      ${where}
      ORDER BY ac.issued_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      access_codes: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Admin list access codes error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
// generateAccessCode 를 바깥으로도 노출해 후속 커밋에서 재사용할 여지를
// 둔다(예: 대량 생성 스크립트). 현재 정상 경로는 POST / 안에서만 호출.
module.exports.generateAccessCode = generateAccessCode;
