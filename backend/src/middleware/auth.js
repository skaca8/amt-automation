// ============================================================================
// 인증 / 인가 미들웨어
// ----------------------------------------------------------------------------
// 이 파일이 하는 일:
//   1) authenticate(): Authorization: Bearer <JWT> 헤더를 검증해서
//      req.user 에 DB에서 읽은 안전한 사용자 레코드(패스워드 제외)를
//      꽂아 준다. 다음 핸들러에서 req.user.id / req.user.role 을 바로
//      쓸 수 있게 하기 위함.
//   2) requireAdmin(): authenticate 뒤에 체이닝해서 role === 'admin' 만
//      통과시키는 가드.
//
// 누가 import 하나:
//   - routes/auth.js 의 /me, PUT /me
//   - routes/bookings.js 의 /my (그리고 tryGetUserId 가 JWT_SECRET 재사용)
//   - routes/admin/** 전 라우터(router.use(authenticate, requireAdmin))
//
// 주의할 점:
//   - JWT_SECRET 은 환경 변수 우선이지만, 설정되지 않으면 하드코딩된
//     개발용 기본값으로 폴백한다. 운영 환경에서는 반드시 JWT_SECRET 을
//     세팅할 것. 기본값으로 기동되면 토큰 위조가 가능하다.
//   - /auth/me 응답용 컬럼 목록을 명시적으로 열거하는 이유:
//       * password 해시가 절대 wire 로 나가면 안 된다.
//       * google_id / avatar_url 은 프런트엔드가 소셜 로그인 상태와
//         프로필 사진을 렌더링하는 데 쓰므로 포함시켰다.
//   - 실패 응답은 전부 { error: string } 으로 통일 — 프런트엔드 fetch
//     wrapper 가 이 키를 읽는다.
// ============================================================================

const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

// JWT 서명/검증에 쓰는 비밀 키. 운영에서는 반드시 환경 변수로 주입.
// 기본값은 개발 편의용 폴백이며 운영에서 그대로 쓰면 안 된다.
const JWT_SECRET = process.env.JWT_SECRET || 'high1-resort-secret-key-2026';

/**
 * Express 미들웨어 — Authorization 헤더의 JWT 를 검증한다.
 *
 * 동작 요약:
 *   1) Authorization: Bearer <token> 형식 여부를 확인 (없으면 401).
 *   2) jwt.verify 로 서명/만료 검사 (실패 시 401, 만료는 별도 메시지).
 *   3) decoded.userId 로 DB 에서 사용자 레코드를 다시 읽는다. 이렇게
 *      하는 이유는 토큰이 유효해도 사용자가 이미 삭제됐을 수 있기
 *      때문 — 그 경우 401 로 떨군다.
 *   4) password 해시를 제외한 안전한 컬럼만 req.user 에 붙이고 next().
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 *
 * 실패 응답:
 *   - 401 "Authentication required." : 헤더 없음/형식 불일치
 *   - 401 "Token has expired."       : jwt.verify 가 TokenExpiredError
 *   - 401 "Invalid token."           : 그 외 검증 실패
 *   - 401 "User not found."          : 토큰은 유효하지만 DB 사용자 없음
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 서명·만료 검증. 실패 시 예외가 throw 되어 아래 catch 로 흐른다.
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    // 컬럼을 명시적으로 열거한다:
    //   - password 해시는 절대 포함하지 않는다 (보안).
    //   - avatar_url / google_id 는 프런트가 구글 프로필 사진과
    //     소셜 로그인 배지를 렌더링하는 데 필요하므로 포함한다.
    const user = db.prepare(
      'SELECT id, email, name, phone, nationality, role, language, avatar_url, google_id, created_at FROM users WHERE id = ?'
    ).get(decoded.userId);

    if (!user) {
      // 토큰은 유효하지만 DB 에 해당 유저가 없다. 삭제된 계정이거나
      // 토큰 payload 가 조작된 경우.
      return res.status(401).json({ error: 'User not found. Token may be invalid.' });
    }

    // 이후 핸들러가 req.user.id, req.user.role 등을 바로 쓸 수 있게 주입.
    req.user = user;
    next();
  } catch (err) {
    // jsonwebtoken 은 만료일 때만 err.name === 'TokenExpiredError' 를
    // 던지므로, 분기해서 사용자에게 재로그인을 유도하는 메시지를 준다.
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Express 미들웨어 — authenticate 다음에 체이닝해서 관리자만 통과시킨다.
 *
 * req.user 가 반드시 먼저 세팅돼 있어야 하므로, 라우터에서는
 * `router.use(authenticate, requireAdmin)` 순서로 등록할 것.
 *
 * 실패 응답:
 *   - 403 "Admin access required." : req.user 없음 또는 role !== 'admin'
 *     (401 이 아닌 403 을 쓰는 이유: 인증 자체는 성공했지만 권한이
 *     부족한 상황이기 때문.)
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, JWT_SECRET };
