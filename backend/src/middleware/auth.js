const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'high1-resort-secret-key-2026';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    // Explicitly list columns so we never leak the password hash, but
    // include `avatar_url` / `google_id` so the client UI can render
    // Google profile pictures and surface the social-login state.
    const user = db.prepare(
      'SELECT id, email, name, phone, nationality, role, language, avatar_url, google_id, created_at FROM users WHERE id = ?'
    ).get(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found. Token may be invalid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, JWT_SECRET };
