// ============================================================================
// /api/admin/users — 관리자 사용자 관리 라우트
// ----------------------------------------------------------------------------
// 이 파일이 제공하는 엔드포인트:
//   GET /stats   — 사용자 통계 (role / 국적 / 언어 / top bookers)
//   GET /        — 사용자 목록 (search + filter + pagination)
//   GET /:id     — 사용자 상세 + 예약 이력 + booking_stats
//   PUT /:id     — 사용자 기본 정보 및 role 수정
//
// password 컬럼은 절대 응답으로 내보내지 않도록 SELECT 시 필요한 컬럼만
// 명시적으로 열거한다.
// ============================================================================

const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// 관리자 인증 필수.
router.use(authenticate, requireAdmin);

/**
 * GET /stats — 사용자 통계.
 *
 * 응답:
 *   {
 *     total_users, customer_count, admin_count, new_users_today,
 *     nationality_breakdown: [{ nationality, count }],
 *     language_breakdown:    [{ language, count }],
 *     top_bookers: [{ id, name, email, booking_count, total_spent }]
 *   }
 *
 * top_bookers 는 예약 건수 상위 10명 — 고객 세그먼트 분석용.
 */
router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const customerCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get().count;
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;

    const today = new Date().toISOString().split('T')[0];
    const newUsersToday = db.prepare("SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = ?").get(today).count;

    const nationalityBreakdown = db.prepare(`
      SELECT nationality, COUNT(*) as count FROM users WHERE nationality IS NOT NULL GROUP BY nationality ORDER BY count DESC
    `).all();

    const languageBreakdown = db.prepare(`
      SELECT language, COUNT(*) as count FROM users GROUP BY language ORDER BY count DESC
    `).all();

    // Users with most bookings
    const topBookers = db.prepare(`
      SELECT u.id, u.name, u.email, COUNT(b.id) as booking_count, COALESCE(SUM(b.total_price), 0) as total_spent
      FROM users u
      LEFT JOIN bookings b ON u.id = b.user_id
      WHERE u.role = 'customer'
      GROUP BY u.id
      ORDER BY booking_count DESC
      LIMIT 10
    `).all();

    res.json({
      total_users: totalUsers,
      customer_count: customerCount,
      admin_count: adminCount,
      new_users_today: newUsersToday,
      nationality_breakdown: nationalityBreakdown,
      language_breakdown: languageBreakdown,
      top_bookers: topBookers
    });
  } catch (err) {
    console.error('Admin user stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET / — 사용자 목록 (검색 + 필터 + 페이지네이션).
 *
 * Query: { search?, role?, page=1, limit=20 }
 *   - search: name / email / phone 부분 일치
 *   - role: 'customer' | 'admin'
 *
 * 응답: { users: [...], pagination: {...} }
 * SELECT 에서 password 를 제외한 컬럼만 명시한다 — 누설 방지.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { search, role, page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`).get(...params).count;

    const users = db.prepare(`
      SELECT id, email, name, phone, nationality, role, language, created_at, updated_at
      FROM users ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /:id — 사용자 상세 + 해당 사용자의 모든 예약 + 집계 통계.
 *
 * 응답:
 *   {
 *     user,
 *     bookings: [...],
 *     booking_stats: {
 *       total_bookings, total_spent,
 *       confirmed_bookings, cancelled_bookings
 *     }
 *   }
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, phone, nationality, role, language, created_at, updated_at FROM users WHERE id = ?').get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const bookings = db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(user.id);

    const bookingStats = db.prepare(`
      SELECT
        COUNT(*) as total_bookings,
        COALESCE(SUM(total_price), 0) as total_spent,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings
      FROM bookings WHERE user_id = ?
    `).get(user.id);

    res.json({ user, bookings, booking_stats: bookingStats });
  } catch (err) {
    console.error('Admin get user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * PUT /:id — 사용자 기본 정보 및 role 수정.
 *
 * Body(모두 optional): { name, phone, nationality, role, language }
 *
 * email 은 수정 대상에 포함하지 않는다 — 이메일 변경은 별도 플로우 필요.
 * password 도 여기서 바꾸지 않는다 — 전용 reset 엔드포인트가 필요.
 * role 은 이 엔드포인트에서만 바꿀 수 있는 유일한 경로다 (일반 고객 앱의
 * PUT /auth/me 에는 role 필드가 빠져 있다).
 */
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { name, phone, nationality, role, language } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (nationality !== undefined) { updates.push('nationality = ?'); values.push(nationality); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (language !== undefined) { updates.push('language = ?'); values.push(language); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.params.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT id, email, name, phone, nationality, role, language, created_at, updated_at FROM users WHERE id = ?').get(req.params.id);

    res.json({ message: 'User updated.', user: updated });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
