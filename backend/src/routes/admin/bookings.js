const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');
// Reuse the inventory-restore loop from the customer booking route so admin
// cancellations / refunds release the same per-date counters that the
// original reservation consumed.
const { restoreBookingInventory } = require('../bookings');

const router = express.Router();

// Allow-list of booking status values admins can set. Anything outside this
// set would corrupt downstream queries (dashboards, filters, etc.).
const ALLOWED_BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'refunded', 'completed'];

// All routes require admin authentication
router.use(authenticate, requireAdmin);

// GET /stats - dashboard statistics
router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings').get().count;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE status != 'cancelled'").get().total;

    const today = new Date().toISOString().split('T')[0];
    const todayBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE DATE(created_at) = ?").get(today).count;

    const statusBreakdown = db.prepare(`
      SELECT status, COUNT(*) as count FROM bookings GROUP BY status
    `).all();

    const paymentBreakdown = db.prepare(`
      SELECT payment_status, COUNT(*) as count FROM bookings GROUP BY payment_status
    `).all();

    const productBreakdown = db.prepare(`
      SELECT product_type, COUNT(*) as count FROM bookings GROUP BY product_type
    `).all();

    res.json({
      total_bookings: totalBookings,
      total_revenue: totalRevenue,
      today_bookings: todayBookings,
      status_breakdown: statusBreakdown,
      payment_breakdown: paymentBreakdown,
      product_breakdown: productBreakdown
    });
  } catch (err) {
    console.error('Admin booking stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /export - export bookings as CSV
router.get('/export', (req, res) => {
  try {
    const db = getDb();
    const { status, payment_status, product_type, from_date, to_date } = req.query;

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (payment_status) {
      query += ' AND payment_status = ?';
      params.push(payment_status);
    }
    if (product_type) {
      query += ' AND product_type = ?';
      params.push(product_type);
    }
    if (from_date) {
      query += ' AND DATE(created_at) >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND DATE(created_at) <= ?';
      params.push(to_date);
    }

    query += ' ORDER BY created_at DESC';

    const bookings = db.prepare(query).all(...params);

    // Build CSV
    const headers = [
      'Booking Number', 'Guest Name', 'Guest Email', 'Guest Phone',
      'Product Type', 'Product ID', 'Check In', 'Check Out', 'Visit Date',
      'Guests', 'Quantity', 'Nights', 'Total Price', 'Currency',
      'Status', 'Payment Status', 'Created At'
    ];

    let csv = headers.join(',') + '\n';

    for (const b of bookings) {
      const row = [
        b.booking_number,
        `"${(b.guest_name || '').replace(/"/g, '""')}"`,
        b.guest_email,
        b.guest_phone || '',
        b.product_type,
        b.product_id,
        b.check_in || '',
        b.check_out || '',
        b.visit_date || '',
        b.guests,
        b.quantity,
        b.nights,
        b.total_price,
        b.currency,
        b.status,
        b.payment_status,
        b.created_at
      ];
      csv += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bookings_export.csv');
    res.send(csv);
  } catch (err) {
    console.error('Admin export bookings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET / - list all bookings with filters and pagination
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, payment_status, product_type, from_date, to_date, search, page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND b.status = ?';
      params.push(status);
    }
    if (payment_status) {
      whereClause += ' AND b.payment_status = ?';
      params.push(payment_status);
    }
    if (product_type) {
      whereClause += ' AND b.product_type = ?';
      params.push(product_type);
    }
    if (from_date) {
      whereClause += ' AND DATE(b.created_at) >= ?';
      params.push(from_date);
    }
    if (to_date) {
      whereClause += ' AND DATE(b.created_at) <= ?';
      params.push(to_date);
    }
    if (search) {
      whereClause += ' AND (b.guest_name LIKE ? OR b.guest_email LIKE ? OR b.booking_number LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const countQuery = `SELECT COUNT(*) as total FROM bookings b ${whereClause}`;
    const total = db.prepare(countQuery).get(...params).total;

    const dataQuery = `SELECT b.* FROM bookings b ${whereClause} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
    const bookings = db.prepare(dataQuery).all(...params, limitNum, offset);

    res.json({
      bookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Admin list bookings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /:id - booking detail
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const voucher = db.prepare('SELECT * FROM vouchers WHERE booking_id = ?').get(booking.id);
    const payment = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id);

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

    let user = null;
    if (booking.user_id) {
      user = db.prepare('SELECT id, email, name, phone, nationality, language FROM users WHERE id = ?').get(booking.user_id);
    }

    res.json({ booking, voucher, payment, product, room_type: roomType, user });
  } catch (err) {
    console.error('Admin get booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /:id/status - update booking status.
// When an admin transitions a booking to `cancelled`, we must also release
// the inventory the booking was holding and deactivate its voucher — the
// previous implementation silently leaked inventory forever.
router.put('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }
    if (!ALLOWED_BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${ALLOWED_BOOKING_STATUSES.join(', ')}.`
      });
    }

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Wrap all writes in a single transaction so a mid-flight failure
    // doesn't leave inventory half-released or status inconsistent with
    // the voucher.
    const updated = db.transaction(() => {
      // Only restore inventory on the cancelled/refunded transition, and
      // only if the booking wasn't already in a released state — that
      // guards against double-decrement when an admin clicks cancel twice.
      const wasReleased = booking.status === 'cancelled' || booking.status === 'refunded';
      if (!wasReleased && (status === 'cancelled' || status === 'refunded')) {
        restoreBookingInventory(db, booking);
        db.prepare("UPDATE vouchers SET status = 'cancelled' WHERE booking_id = ?").run(booking.id);
      }

      db.prepare("UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .run(status, booking.id);

      return db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    })();

    res.json({ message: 'Booking status updated.', booking: updated });
  } catch (err) {
    console.error('Admin update booking status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /:id/payment - update payment status.
// All three writes (bookings.payment_status, payments.status, optional
// bookings.status flip to 'confirmed') are wrapped in one transaction so
// the booking and payment tables can never disagree about paid/unpaid.
router.put('/:id/payment', (req, res) => {
  try {
    const db = getDb();
    const { payment_status, payment_id } = req.body;

    if (!payment_status) {
      return res.status(400).json({ error: 'payment_status is required.' });
    }

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const updated = db.transaction(() => {
      // Update the booking's denormalized payment_status (and optional
      // payment_id pointer to the gateway reference).
      const updates = ["payment_status = ?", "updated_at = datetime('now')"];
      const values = [payment_status];

      if (payment_id) {
        updates.push('payment_id = ?');
        values.push(payment_id);
      }

      values.push(booking.id);
      db.prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      // Mirror the change on the matching payments row.
      const paymentUpdates = ['status = ?'];
      const paymentValues = [payment_status];

      if (payment_id) {
        paymentUpdates.push('stripe_payment_id = ?');
        paymentValues.push(payment_id);
      }

      paymentValues.push(booking.id);
      db.prepare(`UPDATE payments SET ${paymentUpdates.join(', ')} WHERE booking_id = ?`).run(...paymentValues);

      // If the payment just flipped to 'paid' and the booking was still
      // pending, auto-confirm it. Other states (cancelled, refunded) are
      // intentionally left alone.
      if (payment_status === 'paid') {
        db.prepare("UPDATE bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'")
          .run(booking.id);
      }

      return db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    })();

    res.json({ message: 'Payment status updated.', booking: updated });
  } catch (err) {
    console.error('Admin update payment status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /:id/refund - process a refund.
// Must also release the inventory the booking was holding, otherwise the
// resort loses sellable rooms/tickets/packages forever.
router.post('/:id/refund', (req, res) => {
  try {
    const db = getDb();
    const { refund_amount } = req.body;

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const payment = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    const amount = refund_amount !== undefined ? refund_amount : booking.total_price;

    if (amount <= 0 || amount > booking.total_price) {
      return res.status(400).json({ error: 'Invalid refund amount.' });
    }

    const { updated, updatedPayment } = db.transaction(() => {
      // Only restore inventory if the booking wasn't already released by a
      // previous cancel/refund — prevents double-decrement.
      const wasReleased = booking.status === 'cancelled' || booking.status === 'refunded';
      if (!wasReleased) {
        restoreBookingInventory(db, booking);
      }

      db.prepare("UPDATE payments SET refund_amount = ?, status = 'refunded' WHERE booking_id = ?")
        .run(amount, booking.id);

      db.prepare("UPDATE bookings SET status = 'refunded', payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?")
        .run(booking.id);

      db.prepare("UPDATE vouchers SET status = 'cancelled' WHERE booking_id = ?").run(booking.id);

      return {
        updated: db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id),
        updatedPayment: db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id)
      };
    })();

    res.json({
      message: 'Refund processed successfully.',
      booking: updated,
      payment: updatedPayment
    });
  } catch (err) {
    console.error('Admin refund error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
