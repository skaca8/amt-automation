const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

// GET / - list all active packages
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { search } = req.query;

    let query = 'SELECT * FROM packages WHERE status = ?';
    const params = ['active'];

    if (search) {
      query += ' AND (name_en LIKE ? OR name_cn LIKE ? OR description_en LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY id ASC';

    const packages = db.prepare(query).all(...params);

    const result = packages.map(pkg => ({
      ...pkg,
      includes: JSON.parse(pkg.includes || '[]')
    }));

    res.json({ packages: result });
  } catch (err) {
    console.error('List packages error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /:id - package detail with included items
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    pkg.includes = JSON.parse(pkg.includes || '[]');

    const items = db.prepare('SELECT * FROM package_items WHERE package_id = ?').all(pkg.id);

    // Resolve item details
    const resolvedItems = items.map(item => {
      let detail = null;
      if (item.item_type === 'hotel') {
        detail = db.prepare('SELECT id, name_en, name_cn, image_url FROM hotels WHERE id = ?').get(item.item_id);
      } else if (item.item_type === 'room_type') {
        detail = db.prepare('SELECT id, name_en, name_cn, hotel_id, base_price, image_url FROM room_types WHERE id = ?').get(item.item_id);
      } else if (item.item_type === 'ticket') {
        detail = db.prepare('SELECT id, name_en, name_cn, base_price, image_url FROM tickets WHERE id = ?').get(item.item_id);
      }

      return {
        ...item,
        detail
      };
    });

    res.json({ package: pkg, items: resolvedItems });
  } catch (err) {
    console.error('Get package error:', err);
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

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    const inventory = db.prepare(`
      SELECT date, total_quantity, booked_quantity, price
      FROM package_inventory
      WHERE package_id = ? AND date = ?
    `).get(pkg.id, date);

    const available = inventory ? inventory.total_quantity - inventory.booked_quantity : 0;
    const price = inventory ? (inventory.price || pkg.base_price) : pkg.base_price;

    res.json({
      package: {
        id: pkg.id,
        name_en: pkg.name_en,
        name_cn: pkg.name_cn
      },
      date,
      available,
      price,
      is_available: available > 0
    });
  } catch (err) {
    console.error('Check package availability error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
