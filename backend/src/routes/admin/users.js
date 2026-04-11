const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticate, requireAdmin);

// GET /stats - user statistics
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

// GET / - list all users with search and pagination
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

// GET /:id - user detail with booking history
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

// PUT /:id - update user info
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
