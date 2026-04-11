const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

// GET / - list all active tickets
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category, search } = req.query;

    let query = 'SELECT * FROM tickets WHERE status = ?';
    const params = ['active'];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (name_en LIKE ? OR name_cn LIKE ? OR description_en LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY is_featured DESC, sort_order ASC, id DESC';

    const tickets = db.prepare(query).all(...params);

    res.json({ tickets });
  } catch (err) {
    console.error('List tickets error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /:id - ticket detail
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    res.json({ ticket });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /:id/availability?date=
router.get('/:id/availability', (req, res) => {
  try {
    const db = getDb();
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD).' });
    }

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const inventory = db.prepare(`
      SELECT date, total_quantity, booked_quantity, price
      FROM ticket_inventory
      WHERE ticket_id = ? AND date = ?
    `).get(ticket.id, date);

    const available = inventory ? inventory.total_quantity - inventory.booked_quantity : 0;
    const price = inventory ? (inventory.price || ticket.base_price) : ticket.base_price;

    res.json({
      ticket: {
        id: ticket.id,
        name_en: ticket.name_en,
        name_cn: ticket.name_cn
      },
      date,
      available,
      price,
      is_available: available > 0
    });
  } catch (err) {
    console.error('Check ticket availability error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
