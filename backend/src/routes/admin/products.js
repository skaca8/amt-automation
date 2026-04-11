const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticate, requireAdmin);

// PUT /featured - quick toggle featured status
router.put('/featured', (req, res) => {
  try {
    const db = getDb();
    const { product_type, product_id, is_featured, sort_order } = req.body;

    if (!product_type || !product_id) {
      return res.status(400).json({ error: 'product_type and product_id are required.' });
    }

    const table = product_type === 'hotel' ? 'hotels' : product_type === 'ticket' ? 'tickets' : 'packages';

    const updates = [];
    const values = [];

    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(product_id);
    db.prepare(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Featured status updated.' });
  } catch (err) {
    console.error('Update featured error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// HOTELS CRUD
// ============================================================

// GET / - list all hotels
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const hotels = db.prepare('SELECT * FROM hotels ORDER BY id DESC').all();
    const result = hotels.map(h => ({
      ...h,
      amenities: JSON.parse(h.amenities || '[]'),
      images: JSON.parse(h.images || '[]')
    }));
    res.json({ hotels: result });
  } catch (err) {
    console.error('Admin list hotels error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST / - create hotel
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, images, status, is_featured, sort_order } = req.body;

    if (!name_en) {
      return res.status(400).json({ error: 'name_en is required.' });
    }

    const result = db.prepare(`
      INSERT INTO hotels (name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, images, status, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_en, name_cn || null, description_en || null, description_cn || null,
      address || null, image_url || null, rating || 0,
      JSON.stringify(amenities || []), JSON.stringify(images || []), status || 'active',
      is_featured ? 1 : 0, sort_order || 0
    );

    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(result.lastInsertRowid);
    hotel.amenities = JSON.parse(hotel.amenities || '[]');
    hotel.images = JSON.parse(hotel.images || '[]');

    res.status(201).json({ message: 'Hotel created.', hotel });
  } catch (err) {
    console.error('Admin create hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /:id - update hotel
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    const { name_en, name_cn, description_en, description_cn, address, image_url, rating, amenities, images, status, is_featured, sort_order } = req.body;

    const updates = [];
    const values = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (rating !== undefined) { updates.push('rating = ?'); values.push(rating); }
    if (amenities !== undefined) { updates.push('amenities = ?'); values.push(JSON.stringify(amenities)); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE hotels SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    updated.amenities = JSON.parse(updated.amenities || '[]');
    updated.images = JSON.parse(updated.images || '[]');

    res.json({ message: 'Hotel updated.', hotel: updated });
  } catch (err) {
    console.error('Admin update hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /:id - delete hotel (soft delete by setting status to inactive)
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const hotel = db.prepare('SELECT * FROM hotels WHERE id = ?').get(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    db.prepare("UPDATE hotels SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Hotel deleted.' });
  } catch (err) {
    console.error('Admin delete hotel error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// ROOM TYPES CRUD
// ============================================================

// GET /room-types - list all room types
router.get('/room-types', (req, res) => {
  try {
    const db = getDb();
    const { hotel_id } = req.query;

    let query = 'SELECT rt.*, h.name_en as hotel_name FROM room_types rt LEFT JOIN hotels h ON rt.hotel_id = h.id';
    const params = [];

    if (hotel_id) {
      query += ' WHERE rt.hotel_id = ?';
      params.push(hotel_id);
    }

    query += ' ORDER BY rt.id DESC';

    const roomTypes = db.prepare(query).all(...params);
    const result = roomTypes.map(rt => ({
      ...rt,
      amenities: JSON.parse(rt.amenities || '[]'),
      images: JSON.parse(rt.images || '[]')
    }));

    res.json({ room_types: result });
  } catch (err) {
    console.error('Admin list room types error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /room-types - create room type
router.post('/room-types', (req, res) => {
  try {
    const db = getDb();
    const { hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, images, base_price, status } = req.body;

    if (!hotel_id || !name_en || base_price === undefined) {
      return res.status(400).json({ error: 'hotel_id, name_en, and base_price are required.' });
    }

    const hotel = db.prepare('SELECT id FROM hotels WHERE id = ?').get(hotel_id);
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found.' });
    }

    const result = db.prepare(`
      INSERT INTO room_types (hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, images, base_price, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hotel_id, name_en, name_cn || null, description_en || null, description_cn || null,
      max_guests || 2, bed_type || null, JSON.stringify(amenities || []),
      image_url || null, JSON.stringify(images || []), base_price, status || 'active'
    );

    const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(result.lastInsertRowid);
    roomType.amenities = JSON.parse(roomType.amenities || '[]');
    roomType.images = JSON.parse(roomType.images || '[]');

    res.status(201).json({ message: 'Room type created.', room_type: roomType });
  } catch (err) {
    console.error('Admin create room type error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /room-types/:id - update room type
router.put('/room-types/:id', (req, res) => {
  try {
    const db = getDb();
    const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found.' });
    }

    const { hotel_id, name_en, name_cn, description_en, description_cn, max_guests, bed_type, amenities, image_url, images, base_price, status } = req.body;

    const updates = [];
    const values = [];

    if (hotel_id !== undefined) { updates.push('hotel_id = ?'); values.push(hotel_id); }
    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (max_guests !== undefined) { updates.push('max_guests = ?'); values.push(max_guests); }
    if (bed_type !== undefined) { updates.push('bed_type = ?'); values.push(bed_type); }
    if (amenities !== undefined) { updates.push('amenities = ?'); values.push(JSON.stringify(amenities)); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (base_price !== undefined) { updates.push('base_price = ?'); values.push(base_price); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE room_types SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
    updated.amenities = JSON.parse(updated.amenities || '[]');
    updated.images = JSON.parse(updated.images || '[]');

    res.json({ message: 'Room type updated.', room_type: updated });
  } catch (err) {
    console.error('Admin update room type error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /room-types/:id - delete room type
router.delete('/room-types/:id', (req, res) => {
  try {
    const db = getDb();
    const roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(req.params.id);
    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found.' });
    }

    db.prepare("UPDATE room_types SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Room type deleted.' });
  } catch (err) {
    console.error('Admin delete room type error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// TICKETS CRUD
// ============================================================

// GET /tickets - list all tickets
router.get('/tickets', (req, res) => {
  try {
    const db = getDb();
    const tickets = db.prepare('SELECT * FROM tickets ORDER BY id DESC').all();
    res.json({ tickets });
  } catch (err) {
    console.error('Admin list tickets error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /tickets - create ticket
router.post('/tickets', (req, res) => {
  try {
    const db = getDb();
    const { name_en, name_cn, description_en, description_cn, category, image_url, images, base_price, duration, location, status, is_featured, sort_order } = req.body;

    if (!name_en || base_price === undefined) {
      return res.status(400).json({ error: 'name_en and base_price are required.' });
    }

    const result = db.prepare(`
      INSERT INTO tickets (name_en, name_cn, description_en, description_cn, category, image_url, images, base_price, duration, location, status, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_en, name_cn || null, description_en || null, description_cn || null,
      category || null, image_url || null, JSON.stringify(images || []), base_price,
      duration || null, location || null, status || 'active',
      is_featured ? 1 : 0, sort_order || 0
    );

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid);
    ticket.images = JSON.parse(ticket.images || '[]');
    res.status(201).json({ message: 'Ticket created.', ticket });
  } catch (err) {
    console.error('Admin create ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /tickets/:id - update ticket
router.put('/tickets/:id', (req, res) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const { name_en, name_cn, description_en, description_cn, category, image_url, images, base_price, duration, location, status, is_featured, sort_order } = req.body;

    const updates = [];
    const values = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (base_price !== undefined) { updates.push('base_price = ?'); values.push(base_price); }
    if (duration !== undefined) { updates.push('duration = ?'); values.push(duration); }
    if (location !== undefined) { updates.push('location = ?'); values.push(location); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    updated.images = JSON.parse(updated.images || '[]');
    res.json({ message: 'Ticket updated.', ticket: updated });
  } catch (err) {
    console.error('Admin update ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /tickets/:id - delete ticket
router.delete('/tickets/:id', (req, res) => {
  try {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    db.prepare("UPDATE tickets SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Ticket deleted.' });
  } catch (err) {
    console.error('Admin delete ticket error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// PACKAGES CRUD
// ============================================================

// GET /packages - list all packages
router.get('/packages', (req, res) => {
  try {
    const db = getDb();
    const packages = db.prepare('SELECT * FROM packages ORDER BY id DESC').all();
    const result = packages.map(p => ({
      ...p,
      includes: JSON.parse(p.includes || '[]'),
      images: JSON.parse(p.images || '[]')
    }));
    res.json({ packages: result });
  } catch (err) {
    console.error('Admin list packages error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /packages - create package
router.post('/packages', (req, res) => {
  try {
    const db = getDb();
    const { name_en, name_cn, description_en, description_cn, image_url, images, base_price, includes, duration, status, items, is_featured, sort_order } = req.body;

    if (!name_en || base_price === undefined) {
      return res.status(400).json({ error: 'name_en and base_price are required.' });
    }

    const result = db.prepare(`
      INSERT INTO packages (name_en, name_cn, description_en, description_cn, image_url, images, base_price, includes, duration, status, is_featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name_en, name_cn || null, description_en || null, description_cn || null,
      image_url || null, JSON.stringify(images || []), base_price, JSON.stringify(includes || []),
      duration || null, status || 'active',
      is_featured ? 1 : 0, sort_order || 0
    );

    const packageId = result.lastInsertRowid;

    // Insert package items if provided
    if (items && Array.isArray(items)) {
      const insertItem = db.prepare('INSERT INTO package_items (package_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(packageId, item.item_type, item.item_id, item.quantity || 1);
      }
    }

    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(packageId);
    pkg.includes = JSON.parse(pkg.includes || '[]');
    pkg.images = JSON.parse(pkg.images || '[]');
    const packageItems = db.prepare('SELECT * FROM package_items WHERE package_id = ?').all(packageId);

    res.status(201).json({ message: 'Package created.', package: pkg, items: packageItems });
  } catch (err) {
    console.error('Admin create package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /packages/:id - update package
router.put('/packages/:id', (req, res) => {
  try {
    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    const { name_en, name_cn, description_en, description_cn, image_url, images, base_price, includes, duration, status, items, is_featured, sort_order } = req.body;

    const updates = [];
    const values = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_cn !== undefined) { updates.push('name_cn = ?'); values.push(name_cn); }
    if (description_en !== undefined) { updates.push('description_en = ?'); values.push(description_en); }
    if (description_cn !== undefined) { updates.push('description_cn = ?'); values.push(description_cn); }
    if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); values.push(JSON.stringify(images)); }
    if (base_price !== undefined) { updates.push('base_price = ?'); values.push(base_price); }
    if (includes !== undefined) { updates.push('includes = ?'); values.push(JSON.stringify(includes)); }
    if (duration !== undefined) { updates.push('duration = ?'); values.push(duration); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE packages SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // Update package items if provided
    if (items && Array.isArray(items)) {
      db.prepare('DELETE FROM package_items WHERE package_id = ?').run(req.params.id);
      const insertItem = db.prepare('INSERT INTO package_items (package_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(req.params.id, item.item_type, item.item_id, item.quantity || 1);
      }
    }

    const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    updated.includes = JSON.parse(updated.includes || '[]');
    updated.images = JSON.parse(updated.images || '[]');
    const packageItems = db.prepare('SELECT * FROM package_items WHERE package_id = ?').all(req.params.id);

    res.json({ message: 'Package updated.', package: updated, items: packageItems });
  } catch (err) {
    console.error('Admin update package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /packages/:id - delete package
router.delete('/packages/:id', (req, res) => {
  try {
    const db = getDb();
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    db.prepare("UPDATE packages SET status = 'inactive' WHERE id = ?").run(req.params.id);
    res.json({ message: 'Package deleted.' });
  } catch (err) {
    console.error('Admin delete package error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// INVENTORY MANAGEMENT
// ============================================================

// GET /room-inventory/:room_type_id - get room inventory
router.get('/room-inventory/:room_type_id', (req, res) => {
  try {
    const db = getDb();
    const { from_date, to_date } = req.query;
    let query = 'SELECT * FROM room_inventory WHERE room_type_id = ?';
    const params = [req.params.room_type_id];
    if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
    query += ' ORDER BY date ASC';
    const inventory = db.prepare(query).all(...params);
    res.json({ inventory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /ticket-inventory/:ticket_id - get ticket inventory
router.get('/ticket-inventory/:ticket_id', (req, res) => {
  try {
    const db = getDb();
    const { from_date, to_date } = req.query;
    let query = 'SELECT * FROM ticket_inventory WHERE ticket_id = ?';
    const params = [req.params.ticket_id];
    if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
    query += ' ORDER BY date ASC';
    const inventory = db.prepare(query).all(...params);
    res.json({ inventory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /package-inventory/:package_id - get package inventory
router.get('/package-inventory/:package_id', (req, res) => {
  try {
    const db = getDb();
    const { from_date, to_date } = req.query;
    let query = 'SELECT * FROM package_inventory WHERE package_id = ?';
    const params = [req.params.package_id];
    if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
    query += ' ORDER BY date ASC';
    const inventory = db.prepare(query).all(...params);
    res.json({ inventory });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /room-inventory - bulk update room inventory
router.put('/room-inventory', (req, res) => {
  try {
    const db = getDb();
    const { room_type_id, items } = req.body;

    if (!room_type_id || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'room_type_id and items array are required.' });
    }

    const roomType = db.prepare('SELECT id FROM room_types WHERE id = ?').get(room_type_id);
    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found.' });
    }

    const upsert = db.prepare(`
      INSERT INTO room_inventory (room_type_id, date, total_rooms, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(room_type_id, date) DO UPDATE SET
        total_rooms = excluded.total_rooms,
        price = excluded.price
    `);

    const transaction = db.transaction((entries) => {
      for (const entry of entries) {
        upsert.run(room_type_id, entry.date, entry.total, entry.price);
      }
    });

    transaction(items);

    res.json({ message: `Room inventory updated for ${items.length} dates.` });
  } catch (err) {
    console.error('Admin update room inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /ticket-inventory - bulk update ticket inventory
router.put('/ticket-inventory', (req, res) => {
  try {
    const db = getDb();
    const { ticket_id, items } = req.body;

    if (!ticket_id || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'ticket_id and items array are required.' });
    }

    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticket_id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const upsert = db.prepare(`
      INSERT INTO ticket_inventory (ticket_id, date, total_quantity, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(ticket_id, date) DO UPDATE SET
        total_quantity = excluded.total_quantity,
        price = excluded.price
    `);

    const transaction = db.transaction((entries) => {
      for (const entry of entries) {
        upsert.run(ticket_id, entry.date, entry.total, entry.price);
      }
    });

    transaction(items);

    res.json({ message: `Ticket inventory updated for ${items.length} dates.` });
  } catch (err) {
    console.error('Admin update ticket inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /package-inventory - bulk update package inventory
router.put('/package-inventory', (req, res) => {
  try {
    const db = getDb();
    const { package_id, items } = req.body;

    if (!package_id || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'package_id and items array are required.' });
    }

    const pkg = db.prepare('SELECT id FROM packages WHERE id = ?').get(package_id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found.' });
    }

    const upsert = db.prepare(`
      INSERT INTO package_inventory (package_id, date, total_quantity, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(package_id, date) DO UPDATE SET
        total_quantity = excluded.total_quantity,
        price = excluded.price
    `);

    const transaction = db.transaction((entries) => {
      for (const entry of entries) {
        upsert.run(package_id, entry.date, entry.total, entry.price);
      }
    });

    transaction(items);

    res.json({ message: `Package inventory updated for ${items.length} dates.` });
  } catch (err) {
    console.error('Admin update package inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /room-inventory/bulk - bulk set room inventory by date range
router.post('/room-inventory/bulk', (req, res) => {
  try {
    const db = getDb();
    const { room_type_id, start_date, end_date, total_rooms, price, days_of_week } = req.body;
    // days_of_week is optional array of 0-6 (0=Sunday). If not provided, apply to all days.

    if (!room_type_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'room_type_id, start_date, and end_date are required.' });
    }

    const upsert = db.prepare(`
      INSERT INTO room_inventory (room_type_id, date, total_rooms, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(room_type_id, date) DO UPDATE SET
        total_rooms = CASE WHEN ? IS NOT NULL THEN ? ELSE room_inventory.total_rooms END,
        price = CASE WHEN ? IS NOT NULL THEN ? ELSE room_inventory.price END
    `);

    let count = 0;
    const current = new Date(start_date);
    const end = new Date(end_date);

    const transaction = db.transaction(() => {
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (!days_of_week || days_of_week.length === 0 || days_of_week.includes(dayOfWeek)) {
          const dateStr = current.toISOString().split('T')[0];
          const t = total_rooms !== undefined && total_rooms !== null ? total_rooms : null;
          const p = price !== undefined && price !== null ? price : null;
          upsert.run(room_type_id, dateStr, t || 0, p, t, t, p, p);
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
    });
    transaction();

    res.json({ message: `Room inventory updated for ${count} dates.` });
  } catch (err) {
    console.error('Bulk room inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /ticket-inventory/bulk - bulk set ticket inventory by date range
router.post('/ticket-inventory/bulk', (req, res) => {
  try {
    const db = getDb();
    const { ticket_id, start_date, end_date, total_quantity, price, days_of_week } = req.body;

    if (!ticket_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'ticket_id, start_date, and end_date are required.' });
    }

    const upsert = db.prepare(`
      INSERT INTO ticket_inventory (ticket_id, date, total_quantity, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(ticket_id, date) DO UPDATE SET
        total_quantity = CASE WHEN ? IS NOT NULL THEN ? ELSE ticket_inventory.total_quantity END,
        price = CASE WHEN ? IS NOT NULL THEN ? ELSE ticket_inventory.price END
    `);

    let count = 0;
    const current = new Date(start_date);
    const end = new Date(end_date);

    const transaction = db.transaction(() => {
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (!days_of_week || days_of_week.length === 0 || days_of_week.includes(dayOfWeek)) {
          const dateStr = current.toISOString().split('T')[0];
          const t = total_quantity !== undefined && total_quantity !== null ? total_quantity : null;
          const p = price !== undefined && price !== null ? price : null;
          upsert.run(ticket_id, dateStr, t || 0, p, t, t, p, p);
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
    });
    transaction();

    res.json({ message: `Ticket inventory updated for ${count} dates.` });
  } catch (err) {
    console.error('Bulk ticket inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /package-inventory/bulk - bulk set package inventory by date range
router.post('/package-inventory/bulk', (req, res) => {
  try {
    const db = getDb();
    const { package_id, start_date, end_date, total_quantity, price, days_of_week } = req.body;

    if (!package_id || !start_date || !end_date) {
      return res.status(400).json({ error: 'package_id, start_date, and end_date are required.' });
    }

    const upsert = db.prepare(`
      INSERT INTO package_inventory (package_id, date, total_quantity, price)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(package_id, date) DO UPDATE SET
        total_quantity = CASE WHEN ? IS NOT NULL THEN ? ELSE package_inventory.total_quantity END,
        price = CASE WHEN ? IS NOT NULL THEN ? ELSE package_inventory.price END
    `);

    let count = 0;
    const current = new Date(start_date);
    const end = new Date(end_date);

    const transaction = db.transaction(() => {
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (!days_of_week || days_of_week.length === 0 || days_of_week.includes(dayOfWeek)) {
          const dateStr = current.toISOString().split('T')[0];
          const t = total_quantity !== undefined && total_quantity !== null ? total_quantity : null;
          const p = price !== undefined && price !== null ? price : null;
          upsert.run(package_id, dateStr, t || 0, p, t, t, p, p);
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
    });
    transaction();

    res.json({ message: `Package inventory updated for ${count} dates.` });
  } catch (err) {
    console.error('Bulk package inventory error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
