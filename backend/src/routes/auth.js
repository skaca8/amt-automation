const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

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

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, phone, nationality, language)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email, hashedPassword, phone || null, nationality || null, language || 'en');

    const user = db.prepare('SELECT id, email, name, phone, nationality, role, language, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

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

// POST /login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

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
