const express = require('express');
const { getDb } = require('../config/database');

const router = express.Router();

// GET / - list all active hotels
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { search } = req.query;

    let query = 'SELECT * FROM hotels WHERE status = ?';
    const params = ['active'];

    if (search) {
      query += ' AND (name_en LIKE ? OR name_cn LIKE ? OR address LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY is_featured DESC, sort_order ASC, rating DESC, id ASC';

    const hotels = db.prepare(query).all(...params);

    const result = hotels.map(hotel => ({
      ...hotel,
      amenities: JSON.parse(hotel.amenities || '[]')
    }));

    res.json({ hotels: result });
  } catch (err) {
    console.error('List hotels error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /:id - hotel detail with room types
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);

    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    hotel.amenities = JSON.parse(hotel.amenities || '[]');

    const roomTypes = db.prepare('SELECT * FROM room_types WHERE hotel_id = ? AND status = ?').all(hotel.id, 'active');

    const result = roomTypes.map(rt => ({
      ...rt,
      amenities: JSON.parse(rt.amenities || '[]')
    }));

    res.json({ hotel, room_types: result });
  } catch (err) {
    console.error('Get hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /:id/availability?check_in=&check_out=
router.get('/:id/availability', (req, res) => {
  try {
    const db = getDb();
    const { check_in, check_out } = req.query;

    if (!check_in || !check_out) {
      return res.status(400).json({ error: 'check_in and check_out dates are required (YYYY-MM-DD).' });
    }

    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    const roomTypes = db.prepare('SELECT * FROM room_types WHERE hotel_id = ? AND status = ?').all(hotel.id, 'active');

    const availability = roomTypes.map(rt => {
      const inventory = db.prepare(`
        SELECT date, total_rooms, booked_rooms, price
        FROM room_inventory
        WHERE room_type_id = ? AND date >= ? AND date < ?
        ORDER BY date ASC
      `).all(rt.id, check_in, check_out);

      // Build date-by-date availability
      const dates = [];
      let currentDate = new Date(check_in);
      const endDate = new Date(check_out);
      let minAvailable = Infinity;
      let totalPrice = 0;
      let nights = 0;

      while (currentDate < endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const inv = inventory.find(i => i.date === dateStr);

        const available = inv ? inv.total_rooms - inv.booked_rooms : 0;
        const price = inv ? (inv.price || rt.base_price) : rt.base_price;

        if (available < minAvailable) minAvailable = available;
        totalPrice += price;
        nights++;

        dates.push({
          date: dateStr,
          available,
          price
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (minAvailable === Infinity) minAvailable = 0;

      return {
        room_type: {
          ...rt,
          amenities: JSON.parse(rt.amenities || '[]')
        },
        dates,
        min_available: minAvailable,
        total_price: totalPrice,
        nights,
        is_available: minAvailable > 0
      };
    });

    res.json({
      hotel: {
        id: hotel.id,
        name_en: hotel.name_en,
        name_cn: hotel.name_cn
      },
      check_in,
      check_out,
      availability
    });
  } catch (err) {
    console.error('Check availability error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
