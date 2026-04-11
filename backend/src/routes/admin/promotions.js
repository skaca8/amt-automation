const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

// GET /active - get currently active promotions
router.get('/active', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const promotions = db.prepare(`
      SELECT * FROM promotions
      WHERE status = 'active'
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY id DESC
    `).all(today, today);
    res.json({ promotions });
  } catch (err) {
    console.error('List active promotions error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET / - list all promotions
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, product_type } = req.query;

    let query = 'SELECT * FROM promotions WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (product_type) {
      query += ' AND product_type = ?';
      params.push(product_type);
    }

    query += ' ORDER BY id DESC';

    const promotions = db.prepare(query).all(...params);
    res.json({ promotions });
  } catch (err) {
    console.error('List promotions error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST / - create promotion
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      name, discount_type, discount_value, product_type, product_id,
      start_date, end_date, min_quantity, max_uses, status
    } = req.body;

    if (!name || discount_value === undefined) {
      return res.status(400).json({ error: 'name and discount_value are required.' });
    }

    const validTypes = ['fixed', 'percentage'];
    if (discount_type && !validTypes.includes(discount_type)) {
      return res.status(400).json({ error: 'discount_type must be "fixed" or "percentage".' });
    }

    const result = db.prepare(`
      INSERT INTO promotions (name, discount_type, discount_value, product_type, product_id, start_date, end_date, min_quantity, max_uses, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      discount_type || 'percentage',
      discount_value,
      product_type || null,
      product_id || null,
      start_date || null,
      end_date || null,
      min_quantity || 1,
      max_uses || null,
      status || 'active'
    );

    const promotion = db.prepare('SELECT * FROM promotions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Promotion created.', promotion });
  } catch (err) {
    console.error('Create promotion error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /:id - update promotion
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const promotion = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id);
    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found.' });
    }

    const {
      name, discount_type, discount_value, product_type, product_id,
      start_date, end_date, min_quantity, max_uses, current_uses, status
    } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (discount_type !== undefined) {
      const validTypes = ['fixed', 'percentage'];
      if (!validTypes.includes(discount_type)) {
        return res.status(400).json({ error: 'discount_type must be "fixed" or "percentage".' });
      }
      updates.push('discount_type = ?'); values.push(discount_type);
    }
    if (discount_value !== undefined) { updates.push('discount_value = ?'); values.push(discount_value); }
    if (product_type !== undefined) { updates.push('product_type = ?'); values.push(product_type); }
    if (product_id !== undefined) { updates.push('product_id = ?'); values.push(product_id); }
    if (start_date !== undefined) { updates.push('start_date = ?'); values.push(start_date); }
    if (end_date !== undefined) { updates.push('end_date = ?'); values.push(end_date); }
    if (min_quantity !== undefined) { updates.push('min_quantity = ?'); values.push(min_quantity); }
    if (max_uses !== undefined) { updates.push('max_uses = ?'); values.push(max_uses); }
    if (current_uses !== undefined) { updates.push('current_uses = ?'); values.push(current_uses); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE promotions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id);
    res.json({ message: 'Promotion updated.', promotion: updated });
  } catch (err) {
    console.error('Update promotion error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /:id - soft delete promotion
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const promotion = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id);
    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found.' });
    }

    db.prepare("UPDATE promotions SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Promotion deleted.' });
  } catch (err) {
    console.error('Delete promotion error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
