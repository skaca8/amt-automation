// ============================================================================
// /api/auth — 인증 라우트
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   POST /register   — 이메일/비밀번호 가입
//   POST /login      — 이메일/비밀번호 로그인
//   POST /google     — 구글 ID token 교환 (소셜 로그인)
//   GET  /me         — 현재 로그인 사용자 정보
//   PUT  /me         — 프로필 부분 수정
//
// 모든 성공 응답은 우리 자체 JWT(7일 만료) 와 password 컬럼을 제거한
// 사용자 객체 `{ token, user }` 를 돌려준다. 프런트엔드 AuthContext 는
// password-login 과 구글-login 을 동일하게 처리할 수 있다.
//
// 주의할 점:
//   - users.password 컬럼은 NOT NULL. 구글 로그인으로 가입한 계정도 이
//     컬럼을 채워야 하므로, randomPasswordHash() 로 사용 불가능한 값을
//     집어넣는다.
//   - 이메일 동일 → 계정 연결(linking) 규칙: 이미 비밀번호로 가입한
//     사용자가 동일 이메일로 구글 로그인을 시도하면 새 계정을 만들지
//     않고 기존 row 에 google_id 를 붙인다.
//   - GOOGLE_CLIENT_ID 가 미설정이면 /google 은 503 으로 응답한다.
//     서버 자체는 기동된다.
// ============================================================================

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { getDb } = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ----------------------------------------------------------------------------
// Google Sign-In 설정 — lazy 초기화
// ----------------------------------------------------------------------------
// GOOGLE_CLIENT_ID 환경 변수가 없으면 서버는 여전히 부팅되고 비밀번호 기반
// 엔드포인트는 정상 작동한다. /google 엔드포인트만 503 을 돌려준다.
// 이렇게 하는 이유: 개발자가 .env 를 채우지 않아도 나머지 라우트를
// 바로 테스트할 수 있게 하기 위함.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
let googleClient = null;

/**
 * OAuth2Client 를 lazy 하게 반환한다. CLIENT_ID 가 없으면 null.
 * 캐싱해 두기 때문에 첫 호출 이후로는 즉시 반환된다.
 */
function getGoogleClient() {
  if (!GOOGLE_CLIENT_ID) return null;
  if (!googleClient) googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  return googleClient;
}

/**
 * 소셜 로그인 계정용 "사용 불가 비밀번호" 해시를 생성한다.
 *
 * users.password 컬럼이 NOT NULL 이라서 INSERT 할 값이 반드시 있어야
 * 하는데, 구글 로그인 계정은 비밀번호로 로그인할 수 없어야 한다.
 * 32바이트 랜덤을 bcrypt 해시하면 어떠한 평문 비밀번호와도 절대로
 * 매칭되지 않는 값이 나오므로 이 딜레마가 해결된다.
 *
 * @returns {string} bcrypt 해시 문자열
 */
function randomPasswordHash() {
  const randomSecret = crypto.randomBytes(32).toString('hex');
  return bcrypt.hashSync(randomSecret, 10);
}

/**
 * 응답으로 내보내기 전에 사용자 row 에서 password 해시를 제거한다.
 * 비밀번호 해시가 절대 wire 로 나가지 않도록 하는 최종 방어선.
 */
function sanitizeUser(user) {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
}

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

/**
 * POST /register — 신규 사용자 가입.
 *
 * 요청 바디:
 *   { name, email, password, phone?, nationality?, language? }
 *
 * 응답:
 *   201 { message, token, user }  — user 는 password 제외 컬럼만.
 *   400 필수 필드 누락 / 비밀번호 6자 미만
 *   409 이메일 중복
 *   500 내부 에러
 *
 * 부작용: users 테이블 INSERT (bcrypt 해시된 password 로).
 */
// POST /register
router.post('/register', (req, res) => {
  try {
    const { name, email, password, phone, nationality, language } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const db = getDb();

    // 이메일 유니크 검사. DB 에 UNIQUE 제약도 걸려 있지만, 명시적으로
    // 409 를 돌려주기 위해 먼저 조회한다.
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    // bcrypt cost factor 10. 로그인 시점의 compareSync 도 같은 라운드를 쓴다.
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, phone, nationality, language)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email, hashedPassword, phone || null, nationality || null, language || 'en');

    // 응답에는 password 를 절대 포함하지 않도록 필요한 컬럼만 재조회.
    const user = db.prepare('SELECT id, email, name, phone, nationality, role, language, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    // 가입 직후 바로 로그인 상태로 만들기 위해 7일 만료 토큰을 발급.
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /login — 이메일/비밀번호 로그인.
 *
 * 요청 바디: { email, password }
 * 응답:
 *   200 { message, token, user }
 *   400 필드 누락
 *   401 이메일/비밀번호 불일치 — 두 경우 동일 메시지로 통일 (계정
 *       존재 여부 유출 방지)
 *   500 내부 에러
 */
// POST /login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = getDb();
    // SELECT * 가 필요한 이유: 아래에서 bcrypt.compareSync 로 password
    // 해시를 검증해야 하기 때문. 응답 직전에 password 를 벗겨낸다.
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      // 존재하지 않는 이메일과 비밀번호 오류를 동일 문구로 응답해
      // 사용자 열거(user enumeration) 공격을 어렵게 만든다.
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // 응답에서 password 해시 제거. sanitizeUser 와 같은 목적.
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful.',
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /google — 구글 ID 토큰 교환 (소셜 로그인 엔트리).
 *
 * 프런트엔드는 Google Identity Services 로 구글 버튼을 렌더링하고,
 * 로그인 성공 시 짧은 수명의 JWT ID 토큰을 받는다. 프런트는 그 토큰을
 * `{ credential }` 로 이 엔드포인트에 POST 한다. 백엔드는:
 *   1) 구글의 공개키로 ID 토큰 서명을 검증
 *   2) google_id 로 기존 계정을 찾거나, 이메일로 비밀번호 계정을 찾아
 *      링크하거나, 신규 계정을 생성
 *   3) 우리 자체 JWT 를 발급해 반환
 * 이후의 인증 흐름(Authorization: Bearer ...) 은 비밀번호 로그인과
 * 완전히 동일해진다.
 *
 * 계정 연결(linking) 규칙:
 *   이미 같은 이메일로 비밀번호 가입한 사용자가 구글 로그인을 시도하면
 *   새 계정을 만들지 않고 기존 row 에 google_id / avatar_url 을 붙인다.
 *   — 이메일이 "안정 식별자" 로 간주된다.
 *
 * 요청 바디: { credential: string }  // 구글이 발급한 ID 토큰
 * 응답:
 *   200 { message, token, user }  — password 제외
 *   400 credential 누락
 *   401 토큰 검증 실패 / 이메일 미포함 / 이메일 미검증
 *   503 GOOGLE_CLIENT_ID 환경 변수 미설정
 *   500 내부 에러
 *
 * 부작용: users 테이블에 INSERT 또는 UPDATE.
 */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ error: 'credential (Google ID token) is required.' });
    }

    const client = getGoogleClient();
    if (!client) {
      // 500 이 아니라 503 으로 응답하는 이유: 운영자/개발자가 로그만 보고도
      // "코드 버그" 가 아니라 "설정 미완료" 라는 걸 바로 구분할 수 있게
      // 하기 위함. (503 = Service Unavailable, 기능이 현재 비활성)
      return res.status(503).json({
        error: 'Google Sign-In is not configured on this server. Set GOOGLE_CLIENT_ID.'
      });
    }

    // 구글의 JWKs 로 ID 토큰 서명·만료·audience 를 검증한다. 이 호출은
    // 만료 / 잘못된 audience / 서명 불일치 시 예외를 던지므로, 그 경우는
    // 401 "Invalid Google credential." 로 변환한다.
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error('Google ID token verification failed:', verifyErr.message);
      return res.status(401).json({ error: 'Invalid Google credential.' });
    }

    if (!payload || !payload.sub || !payload.email) {
      // sub 또는 email 클레임이 없으면 식별이 불가능 → 진행 중단.
      return res.status(401).json({ error: 'Google credential did not include an email.' });
    }

    // 구글이 미검증으로 표시한 이메일(일부 Workspace 엣지 케이스)은 거부.
    // 검증되지 않은 이메일은 스푸핑 가능하고, "같은 이메일 = 같은 계정"
    // 링크 규칙의 의미를 무너뜨리기 때문이다.
    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'Google account email is not verified.' });
    }

    const googleId = payload.sub;
    // 이메일은 소문자로 정규화해 대소문자 차이로 인한 중복 계정 생성 방지.
    const email = payload.email.toLowerCase();
    // 이름 우선순위: 전체 이름 → 이름 → 이메일 local-part.
    const displayName = payload.name || payload.given_name || email.split('@')[0];
    const avatarUrl = payload.picture || null;

    const db = getDb();

    // 1단계: 저렴한 경로 — google_id 로 바로 매칭되는 소셜 로그인 계정.
    // 2단계: 이메일 매칭 → linking 로직.
    // 3단계: 둘 다 실패하면 신규 INSERT.
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
    if (!user) {
      const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (byEmail) {
        // 기존 비밀번호 계정에 이 구글 아이덴티티를 연결.
        // 이름/아바타도 최신 구글 값으로 갱신해 프로필이 최신 상태로
        // 유지되게 한다. avatar_url 은 COALESCE 로 null 인 경우
        // 기존 값을 유지한다.
        db.prepare(`
          UPDATE users
             SET google_id = ?,
                 avatar_url = COALESCE(?, avatar_url),
                 updated_at = datetime('now')
           WHERE id = ?
        `).run(googleId, avatarUrl, byEmail.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id);
      }
    }

    if (!user) {
      // 신규 사용자: customer role 로 row 를 만든다. password 컬럼은 NOT
      // NULL 이므로 randomPasswordHash() 로 매칭 불가능한 해시를 채워
      // 넣는다. language 는 기본 'en' 이고, 사용자가 중국어를 원하면
      // 로그인 후 PUT /auth/me 로 바꿀 수 있다.
      const insert = db.prepare(`
        INSERT INTO users (email, password, name, nationality, role, language, google_id, avatar_url)
        VALUES (?, ?, ?, ?, 'customer', 'en', ?, ?)
      `).run(
        email,
        randomPasswordHash(),
        displayName,
        null,
        googleId,
        avatarUrl
      );
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(insert.lastInsertRowid);
    }

    // Issue our own session token. Mirrors the shape used by /login so
    // the frontend AuthContext does not need to special-case Google.
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('Google sign-in error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PUT /me
router.put('/me', authenticate, (req, res) => {
  try {
    const { name, phone, nationality, language } = req.body;
    const db = getDb();

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (nationality !== undefined) { updates.push('nationality = ?'); values.push(nationality); }
    if (language !== undefined) { updates.push('language = ?'); values.push(language); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare('SELECT id, email, name, phone, nationality, role, language, created_at, updated_at FROM users WHERE id = ?').get(req.user.id);

    res.json({ message: 'Profile updated.', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
