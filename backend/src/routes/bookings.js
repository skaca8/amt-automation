const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function generateBookingNumber() {
  return 'BK-' + uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
}

function generateVoucherCode() {
  return 'VCR-' + uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase();
}

// POST / - create booking (guest or authenticated)
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      guest_name,
      guest_email,
      guest_phone,
      product_type,
      product_id,
      room_type_id,
      check_in,
      check_out,
      visit_date,
      guests,
      quantity,
      special_requests
    } = req.body;

    if (!guest_name || !guest_email || !product_type || !product_id) {
      return res.status(400).json({ error: 'guest_name, guest_email, product_type, and product_id are required.' });
    }

    if (!['hotel', 'ticket', 'package'].includes(product_type)) {
      return res.status(400).json({ error: 'product_type must be hotel, ticket, or package.' });
    }

    // Determine user_id from auth header if present
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/auth');
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        userId = decoded.userId;
      } catch (e) {
        // Guest booking - ignore token errors
      }
    }

    let totalPrice = 0;
    let nights = 1;
    const qty = quantity || 1;
    const guestCount = guests || 1;

    // Validate product and calculate price
    if (product_type === 'hotel') {
      if (!room_type_id || !check_in || !check_out) {
        return res.status(400).json({ error: 'room_type_id, check_in, and check_out are required for hotel bookings.' });
      }

      const roomType = db.prepare('SELECT * FROM room_types WHERE id = ? AND status = ?').get(room_type_id, 'active');
      if (!roomType) {
        return res.status(404).json({ error: 'Room type not found.' });
      }

      // Calculate nights and total price
      const startDate = new Date(check_in);
      const endDate = new Date(check_out);
      nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      if (nights <= 0) {
        return res.status(400).json({ error: 'check_out must be after check_in.' });
      }

      // Check availability and calculate price for each night
      const currentDate = new Date(check_in);
      while (currentDate < endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const inv = db.prepare('SELECT * FROM room_inventory WHERE room_type_id = ? AND date = ?').get(room_type_id, dateStr);

        if (!inv || (inv.total_rooms - inv.booked_rooms) < qty) {
          return res.status(400).json({ error: `No availability for ${dateStr}.` });
        }

        const nightPrice = inv.price || roomType.base_price;
        totalPrice += nightPrice * qty;

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Update inventory - increment booked_rooms for each night
      const updateInv = db.prepare('UPDATE room_inventory SET booked_rooms = booked_rooms + ? WHERE room_type_id = ? AND date = ?');
      const updateDate = new Date(check_in);
      while (updateDate < endDate) {
        const dateStr = updateDate.toISOString().split('T')[0];
        updateInv.run(qty, room_type_id, dateStr);
        updateDate.setDate(updateDate.getDate() + 1);
      }

    } else if (product_type === 'ticket') {
      if (!visit_date) {
        return res.status(400).json({ error: 'visit_date is required for ticket bookings.' });
      }

      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND status = ?').get(product_id, 'active');
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }

      const inv = db.prepare('SELECT * FROM ticket_inventory WHERE ticket_id = ? AND date = ?').get(product_id, visit_date);
      if (!inv || (inv.total_quantity - inv.booked_quantity) < qty) {
        return res.status(400).json({ error: `No availability for ${visit_date}.` });
      }

      const price = inv.price || ticket.base_price;
      totalPrice = price * qty;

      // Update inventory
      db.prepare('UPDATE ticket_inventory SET booked_quantity = booked_quantity + ? WHERE ticket_id = ? AND date = ?').run(qty, product_id, visit_date);

    } else if (product_type === 'package') {
      if (!visit_date) {
        return res.status(400).json({ error: 'visit_date is required for package bookings.' });
      }

      const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND status = ?').get(product_id, 'active');
      if (!pkg) {
        return res.status(404).json({ error: 'Package not found.' });
      }

      const inv = db.prepare('SELECT * FROM package_inventory WHERE package_id = ? AND date = ?').get(product_id, visit_date);
      if (!inv || (inv.total_quantity - inv.booked_quantity) < qty) {
        return res.status(400).json({ error: `No availability for ${visit_date}.` });
      }

      const price = inv.price || pkg.base_price;
      totalPrice = price * qty;

      // Update inventory
      db.prepare('UPDATE package_inventory SET booked_quantity = booked_quantity + ? WHERE package_id = ? AND date = ?').run(qty, product_id, visit_date);
    }

    const bookingNumber = generateBookingNumber();

    const result = db.prepare(`
      INSERT INTO bookings (booking_number, user_id, guest_name, guest_email, guest_phone, product_type, product_id, room_type_id, check_in, check_out, visit_date, guests, quantity, nights, total_price, special_requests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookingNumber, userId, guest_name, guest_email, guest_phone || null,
      product_type, product_id, room_type_id || null,
      check_in || null, check_out || null, visit_date || null,
      guestCount, qty, nights, totalPrice, special_requests || null
    );

    const bookingId = result.lastInsertRowid;

    // Create payment record
    db.prepare(`
      INSERT INTO payments (booking_id, amount, currency, method, status)
      VALUES (?, ?, 'KRW', 'stripe', 'pending')
    `).run(bookingId, totalPrice);

    // Create voucher
    const voucherCode = generateVoucherCode();
    const qrData = JSON.stringify({
      booking_number: bookingNumber,
      voucher_code: voucherCode,
      product_type,
      guest_name,
      total_price: totalPrice
    });

    db.prepare(`
      INSERT INTO vouchers (booking_id, code, qr_data)
      VALUES (?, ?, ?)
    `).run(bookingId, voucherCode, qrData);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(bookingId);

    res.status(201).json({
      message: 'Booking created successfully.',
      booking,
      voucher
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /lookup?email=&phone=&booking_number= - guest order lookup
router.get('/lookup', (req, res) => {
  try {
    const db = getDb();
    const { email, phone, booking_number } = req.query;

    if (!booking_number && !email) {
      return res.status(400).json({ error: 'booking_number or email is required for lookup.' });
    }

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (booking_number) {
      query += ' AND booking_number = ?';
      params.push(booking_number);
    }

    if (email) {
      query += ' AND guest_email = ?';
      params.push(email);
    }

    if (phone) {
      query += ' AND guest_phone = ?';
      params.push(phone);
    }

    query += ' ORDER BY created_at DESC';

    const bookings = db.prepare(query).all(...params);

    // Attach vouchers
    const results = bookings.map(booking => {
      const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(booking.id);
      return { ...booking, voucher };
    });

    res.json({ bookings: results });
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /my - list user's bookings (authenticated)
router.get('/my', authenticate, (req, res) => {
  try {
    const db = getDb();
    const bookings = db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);

    const results = bookings.map(booking => {
      const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(booking.id);
      return { ...booking, voucher };
    });

    res.json({ bookings: results });
  } catch (err) {
    console.error('My bookings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /:id - booking detail with voucher
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(booking.id);
    const payment = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id);

    // Get product details
    let product = null;
    if (booking.product_type === 'hotel') {
      product = db.prepare('SELECT * FROM hotels WHERE id = ?').get(booking.product_id);
      if (product) product.amenities = JSON.parse(product.amenities || '[]');
    } else if (booking.product_type === 'ticket') {
      product = db.prepare('SELECT * FROM tickets WHERE id = ?').get(booking.product_id);
    } else if (booking.product_type === 'package') {
      product = db.prepare('SELECT * FROM packages WHERE id = ?').get(booking.product_id);
      if (product) product.includes = JSON.parse(product.includes || '[]');
    }

    let roomType = null;
    if (booking.room_type_id) {
      roomType = db.prepare('SELECT * FROM room_types WHERE id = ?').get(booking.room_type_id);
      if (roomType) roomType.amenities = JSON.parse(roomType.amenities || '[]');
    }

    res.json({ booking, voucher, payment, product, room_type: roomType });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /:id/cancel - cancel booking
router.put('/:id/cancel', (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled.' });
    }

    // Restore inventory
    if (booking.product_type === 'hotel' && booking.room_type_id && booking.check_in && booking.check_out) {
      const startDate = new Date(booking.check_in);
      const endDate = new Date(booking.check_out);
      const updateInv = db.prepare('UPDATE room_inventory SET booked_rooms = MAX(0, booked_rooms - ?) WHERE room_type_id = ? AND date = ?');
      while (startDate < endDate) {
        const dateStr = startDate.toISOString().split('T')[0];
        updateInv.run(booking.quantity, booking.room_type_id, dateStr);
        startDate.setDate(startDate.getDate() + 1);
      }
    } else if (booking.product_type === 'ticket' && booking.visit_date) {
      db.prepare('UPDATE ticket_inventory SET booked_quantity = MAX(0, booked_quantity - ?) WHERE ticket_id = ? AND date = ?')
        .run(booking.quantity, booking.product_id, booking.visit_date);
    } else if (booking.product_type === 'package' && booking.visit_date) {
      db.prepare('UPDATE package_inventory SET booked_quantity = MAX(0, booked_quantity - ?) WHERE package_id = ? AND date = ?')
        .run(booking.quantity, booking.product_id, booking.visit_date);
    }

    // Update booking status
    db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(booking.id);

    // Deactivate voucher
    db.prepare("UPDATE vouchers SET status = 'cancelled' WHERE booking_id = ?").run(booking.id);

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);

    res.json({ message: 'Booking cancelled successfully.', booking: updated });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
