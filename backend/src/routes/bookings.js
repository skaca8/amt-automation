const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// Helpers
// ============================================================

// Generates a short, human-friendly booking number prefixed with BK-.
function generateBookingNumber() {
  return 'BK-' + uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
}

// Generates the customer-facing voucher code prefixed with VCR-.
function generateVoucherCode() {
  return 'VCR-' + uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase();
}

// Decrements `booked_*` inventory for every date a booking consumed, using
// `MAX(0, booked_* - qty)` so a double-call (e.g. admin cancels a booking
// that was already cancelled) can never push the counter negative.
// Exported so `routes/admin/bookings.js` can reuse the same logic when an
// operator cancels or refunds a booking.
function restoreBookingInventory(db, booking) {
  if (!booking) return;
  const qty = booking.quantity || 1;

  if (booking.product_type === 'hotel' && booking.room_type_id && booking.check_in && booking.check_out) {
    // Walk each night in [check_in, check_out) and release one room per night.
    const updateInv = db.prepare(
      'UPDATE room_inventory SET booked_rooms = MAX(0, booked_rooms - ?) WHERE room_type_id = ? AND date = ?'
    );
    const cursor = new Date(booking.check_in);
    const endDate = new Date(booking.check_out);
    while (cursor < endDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      updateInv.run(qty, booking.room_type_id, dateStr);
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (booking.product_type === 'ticket' && booking.visit_date) {
    db.prepare(
      'UPDATE ticket_inventory SET booked_quantity = MAX(0, booked_quantity - ?) WHERE ticket_id = ? AND date = ?'
    ).run(qty, booking.product_id, booking.visit_date);
  } else if (booking.product_type === 'package' && booking.visit_date) {
    db.prepare(
      'UPDATE package_inventory SET booked_quantity = MAX(0, booked_quantity - ?) WHERE package_id = ? AND date = ?'
    ).run(qty, booking.product_id, booking.visit_date);
  }
}

// Optionally decode a JWT from the Authorization header and return its user
// id. Returns null when the header is missing or the token is invalid —
// callers (e.g. guest bookings) should treat that as "anonymous".
function tryGetUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    return decoded.userId || null;
  } catch (e) {
    return null;
  }
}

// Authorizes access to a booking. Returns true when:
//   - the request is authenticated and owns the booking, OR
//   - the request is authenticated as an admin, OR
//   - the caller supplied the matching `guest_email` (via body or query).
// This keeps guest-booking flows working without exposing bookings to
// arbitrary ID guessing.
function isAuthorizedForBooking(req, booking) {
  const userId = tryGetUserId(req);
  if (userId) {
    const db = getDb();
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (user && user.role === 'admin') return true;
    if (user && booking.user_id && user.id === booking.user_id) return true;
  }

  // Guest verification: the caller must prove they know the booking email.
  const providedEmail = (req.body && req.body.guest_email) || (req.query && req.query.guest_email);
  if (providedEmail && booking.guest_email &&
      providedEmail.toString().trim().toLowerCase() === booking.guest_email.toLowerCase()) {
    return true;
  }
  return false;
}

// ============================================================
// Routes
// ============================================================

// POST / - create a booking. Accepts both authenticated and guest callers.
// The entire availability-check → inventory-decrement → booking/payment/
// voucher insert sequence runs inside a single sql.js transaction so that
// a failure part-way through rolls back the inventory change instead of
// leaving an orphaned reservation.
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

    // Required-field validation before we touch the DB.
    if (!guest_name || !guest_email || !product_type || !product_id) {
      return res.status(400).json({ error: 'guest_name, guest_email, product_type, and product_id are required.' });
    }

    if (!['hotel', 'ticket', 'package'].includes(product_type)) {
      return res.status(400).json({ error: 'product_type must be hotel, ticket, or package.' });
    }

    // Link the booking to the logged-in user when a valid token is present;
    // otherwise fall back to guest-booking semantics (user_id = NULL).
    const userId = tryGetUserId(req);

    const qty = quantity || 1;
    const guestCount = guests || 1;

    // The transaction() wrapper in config/database.js suppresses intermediate
    // saveDb() calls and commits (or rolls back) atomically. Any `throw`
    // inside the callback triggers ROLLBACK.
    let created;
    try {
      created = db.transaction(() => {
        let totalPrice = 0;
        let nights = 1;

        if (product_type === 'hotel') {
          if (!room_type_id || !check_in || !check_out) {
            // Throwing an Error with a `.status` hint lets us translate it
            // back into a clean HTTP response after the transaction rolls
            // back.
            const err = new Error('room_type_id, check_in, and check_out are required for hotel bookings.');
            err.status = 400;
            throw err;
          }

          const roomType = db.prepare('SELECT * FROM room_types WHERE id = ? AND status = ?').get(room_type_id, 'active');
          if (!roomType) {
            const err = new Error('Room type not found.');
            err.status = 404;
            throw err;
          }

          const startDate = new Date(check_in);
          const endDate = new Date(check_out);
          nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
          if (nights <= 0) {
            const err = new Error('check_out must be after check_in.');
            err.status = 400;
            throw err;
          }

          // Validate availability AND update inventory in the same pass.
          // Since we're inside a transaction, a later failure will undo
          // these updates.
          const updateInv = db.prepare('UPDATE room_inventory SET booked_rooms = booked_rooms + ? WHERE room_type_id = ? AND date = ?');
          const cursor = new Date(check_in);
          while (cursor < endDate) {
            const dateStr = cursor.toISOString().split('T')[0];
            const inv = db.prepare('SELECT * FROM room_inventory WHERE room_type_id = ? AND date = ?').get(room_type_id, dateStr);

            if (!inv || (inv.total_rooms - inv.booked_rooms) < qty) {
              const err = new Error(`No availability for ${dateStr}.`);
              err.status = 400;
              throw err;
            }

            const nightPrice = inv.price || roomType.base_price;
            totalPrice += nightPrice * qty;

            updateInv.run(qty, room_type_id, dateStr);
            cursor.setDate(cursor.getDate() + 1);
          }
        } else if (product_type === 'ticket') {
          if (!visit_date) {
            const err = new Error('visit_date is required for ticket bookings.');
            err.status = 400;
            throw err;
          }

          const ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND status = ?').get(product_id, 'active');
          if (!ticket) {
            const err = new Error('Ticket not found.');
            err.status = 404;
            throw err;
          }

          const inv = db.prepare('SELECT * FROM ticket_inventory WHERE ticket_id = ? AND date = ?').get(product_id, visit_date);
          if (!inv || (inv.total_quantity - inv.booked_quantity) < qty) {
            const err = new Error(`No availability for ${visit_date}.`);
            err.status = 400;
            throw err;
          }

          const price = inv.price || ticket.base_price;
          totalPrice = price * qty;

          db.prepare('UPDATE ticket_inventory SET booked_quantity = booked_quantity + ? WHERE ticket_id = ? AND date = ?')
            .run(qty, product_id, visit_date);
        } else if (product_type === 'package') {
          if (!visit_date) {
            const err = new Error('visit_date is required for package bookings.');
            err.status = 400;
            throw err;
          }

          const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND status = ?').get(product_id, 'active');
          if (!pkg) {
            const err = new Error('Package not found.');
            err.status = 404;
            throw err;
          }

          const inv = db.prepare('SELECT * FROM package_inventory WHERE package_id = ? AND date = ?').get(product_id, visit_date);
          if (!inv || (inv.total_quantity - inv.booked_quantity) < qty) {
            const err = new Error(`No availability for ${visit_date}.`);
            err.status = 400;
            throw err;
          }

          const price = inv.price || pkg.base_price;
          totalPrice = price * qty;

          db.prepare('UPDATE package_inventory SET booked_quantity = booked_quantity + ? WHERE package_id = ? AND date = ?')
            .run(qty, product_id, visit_date);
        }

        const bookingNumber = generateBookingNumber();

        // Persist the booking, its payment record, and its voucher inside
        // the same transaction.
        const insertResult = db.prepare(`
          INSERT INTO bookings (booking_number, user_id, guest_name, guest_email, guest_phone, product_type, product_id, room_type_id, check_in, check_out, visit_date, guests, quantity, nights, total_price, special_requests)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          bookingNumber, userId, guest_name, guest_email, guest_phone || null,
          product_type, product_id, room_type_id || null,
          check_in || null, check_out || null, visit_date || null,
          guestCount, qty, nights, totalPrice, special_requests || null
        );

        const bookingId = insertResult.lastInsertRowid;
        if (!bookingId) {
          // Defense-in-depth: bail out so we don't orphan payment/voucher rows.
          const err = new Error('Failed to persist booking.');
          err.status = 500;
          throw err;
        }

        db.prepare(`
          INSERT INTO payments (booking_id, amount, currency, method, status)
          VALUES (?, ?, 'KRW', 'stripe', 'pending')
        `).run(bookingId, totalPrice);

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
        return { booking, voucher };
      })();
    } catch (txErr) {
      // Translate `.status` hints thrown from inside the transaction into
      // real HTTP responses. Any other error falls through to the outer
      // catch as a 500.
      if (txErr && txErr.status) {
        return res.status(txErr.status).json({ error: txErr.message });
      }
      throw txErr;
    }

    res.status(201).json({
      message: 'Booking created successfully.',
      booking: created.booking,
      voucher: created.voucher
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /lookup?email=&phone=&booking_number= - guest order lookup.
// Intentionally public so guests who no longer have their confirmation
// email can still retrieve their bookings by email + booking number.
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

// GET /my - list the current user's bookings (requires auth).
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

// GET /:id - booking detail with voucher/payment/product.
// Requires either an authenticated owner, an admin, or the matching
// `guest_email` query parameter, to prevent sequential-ID enumeration.
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (!isAuthorizedForBooking(req, booking)) {
      return res.status(403).json({ error: 'Not authorized to view this booking.' });
    }

    const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(booking.id);
    const payment = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id);

    // Get product details so the confirmation/detail pages don't need a
    // second round-trip.
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

// PUT /:id/cancel - cancel a booking and restore inventory.
// Same authorization rules as GET /:id — the customer needs to prove they
// own the booking (token or matching guest_email) before we release the
// reservation.
router.put('/:id/cancel', (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (!isAuthorizedForBooking(req, booking)) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking.' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled.' });
    }

    // Restore inventory, flip booking status, and deactivate the voucher
    // atomically so a crash between steps can't leave the system in a
    // half-cancelled state.
    const updated = db.transaction(() => {
      restoreBookingInventory(db, booking);
      db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(booking.id);
      db.prepare("UPDATE vouchers SET status = 'cancelled' WHERE booking_id = ?").run(booking.id);
      return db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    })();

    res.json({ message: 'Booking cancelled successfully.', booking: updated });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
// Exposed so admin routes can reuse the same inventory-restore loop when an
// operator cancels or refunds a booking from the admin panel.
module.exports.restoreBookingInventory = restoreBookingInventory;
