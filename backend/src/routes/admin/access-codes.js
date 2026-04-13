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

// product_type → 실제 테이블 이름 매핑.
// 상품 존재 여부를 검증할 때 쓴다 (generate-access-code 시 대상 상품이
// DB 에 진짜 있는지 확인해, "없는 상품에 묶인 고아 코드" 가 발급되는 걸
// 막는다).
const PRODUCT_TABLES = {
  hotel: 'hotels',
  ticket: 'tickets',
  package: 'packages',
};

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

/**
 * POST / — 새 access code 발급.
 *
 * 요청 바디:
 *   {
 *     user_id:      number,                              // 코드를 받을 유저
 *     product_type: 'hotel' | 'ticket' | 'package',
 *     product_id:   number,
 *     max_uses?:    number,  // 기본 1. 최소 1. N > 1 이면 같은 코드로
 *                            // N개의 예약을 만들 수 있다.
 *     valid_until?: string,  // 'YYYY-MM-DD' 또는 ISO 문자열. 없으면 무기한.
 *     note?:        string,  // 관리자 내부 메모
 *   }
 *
 * 응답:
 *   201 { message, access_code: { id, code, ... } }
 *   400 필수 필드 누락 / 잘못된 product_type / max_uses < 1
 *   404 user_id 가 가리키는 유저가 없음 / product_id 가 가리키는 상품이 없음
 *   500 내부 에러
 *
 * 설계 메모:
 *   - 코드 문자열은 서버가 generateAccessCode() 로 생성한다. 클라이언트가
 *     임의 문자열을 주입할 수 없어 "짧고 예측 가능한 코드" 같은 실수를
 *     원천 차단.
 *   - user + product 존재성 사전 검증을 수행해, INSERT 는 FK 제약으로
 *     조용히 실패하는 대신 바로 404 를 돌려준다 (관리자에게 더 명확).
 *   - product 가 is_restricted=0 이어도 발급은 허용한다. 그래야 "코드 먼저
 *     만들고 나중에 상품을 restricted 로 전환" 하는 워크플로가 가능하다.
 *     대신 is_restricted=0 인 상품에 대해 발급되면 아무 효과 없이 의미
 *     없는 코드가 되므로, 응답에 product_is_restricted 를 포함해 관리자
 *     UI 가 경고 배너를 띄울 수 있게 한다.
 *   - issued_by 에는 현재 관리자 id (req.user.id) 를 기록한다. 감사 용.
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { user_id, product_type, product_id, max_uses, valid_until, note } = req.body || {};

    // 1) 필수 필드 검증.
    if (!user_id || !product_type || !product_id) {
      return res.status(400).json({
        error: 'user_id, product_type, and product_id are required.',
      });
    }
    if (!ALLOWED_PRODUCT_TYPES.includes(product_type)) {
      return res.status(400).json({
        error: `product_type must be one of: ${ALLOWED_PRODUCT_TYPES.join(', ')}.`,
      });
    }

    // 2) max_uses 정규화. 값이 없거나 1 미만이면 1 로 clamp.
    //    상한은 의도적으로 걸지 않는다 — 관리자가 원하면 큰 값도 허용.
    const parsedMaxUses = Number.isFinite(Number(max_uses)) && Number(max_uses) >= 1
      ? Math.floor(Number(max_uses))
      : 1;

    // 3) 대상 유저 존재 확인. users.id 가 없으면 FK 제약 대신 404 로 회신.
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!user) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    // 4) 대상 상품 존재 확인 + is_restricted 플래그 조회.
    //    PRODUCT_TABLES 의 값은 서버 내부 상수이므로 동적 table 이름이어도 안전.
    const productTable = PRODUCT_TABLES[product_type];
    const product = db
      .prepare(`SELECT id, is_restricted FROM ${productTable} WHERE id = ?`)
      .get(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Target product not found.' });
    }

    // 5) 유니크 코드 생성. UNIQUE 제약이 최종 방어선이지만 이 자리에서
    //    충돌을 기대하진 않는다(12자 hex 확률적으로 거의 0).
    const code = generateAccessCode();

    // 6) INSERT. issued_by 는 현재 로그인한 관리자 id.
    const result = db.prepare(`
      INSERT INTO access_codes
        (code, user_id, product_type, product_id, max_uses, current_uses,
         valid_until, note, status, issued_by)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'active', ?)
    `).run(
      code,
      user_id,
      product_type,
      product_id,
      parsedMaxUses,
      valid_until || null,
      note || null,
      req.user.id,
    );

    // 7) 생성된 row 를 다시 읽어서 반환 (created_at 등 서버 생성 컬럼 포함).
    const created = db.prepare('SELECT * FROM access_codes WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Access code issued successfully.',
      access_code: created,
      // product 가 아직 restricted 로 표시되지 않은 상태라면 UI 가
      // "이 상품은 현재 공개 상품이어서 코드가 효력이 없다" 배너를 띄울
      // 수 있도록 힌트를 같이 반환한다.
      product_is_restricted: product.is_restricted === 1,
    });
  } catch (err) {
    console.error('Admin create access code error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
// generateAccessCode 를 바깥으로도 노출해 후속 커밋에서 재사용할 여지를
// 둔다(예: 대량 생성 스크립트). 현재 정상 경로는 POST / 안에서만 호출.
module.exports.generateAccessCode = generateAccessCode;
