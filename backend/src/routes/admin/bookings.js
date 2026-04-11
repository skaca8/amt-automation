const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

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

// PUT /:id/status - update booking status
router.put('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    db.prepare("UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);

    // If cancelled, deactivate voucher
    if (status === 'cancelled') {
      db.prepare("UPDATE vouchers SET status = 'cancelled' WHERE booking_id = ?").run(req.params.id);
    }

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    res.json({ message: 'Booking status updated.', booking: updated });
  } catch (err) {
    console.error('Admin update booking status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /:id/payment - update payment status
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

    const updates = ["payment_status = ?", "updated_at = datetime('now')"];
    const values = [payment_status];

    if (payment_id) {
      updates.push('payment_id = ?');
      values.push(payment_id);
    }

    values.push(req.params.id);
    db.prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Update corresponding payment record
    const paymentUpdates = ['status = ?'];
    const paymentValues = [payment_status];

    if (payment_id) {
      paymentUpdates.push('stripe_payment_id = ?');
      paymentValues.push(payment_id);
    }

    paymentValues.push(booking.id);
    db.prepare(`UPDATE payments SET ${paymentUpdates.join(', ')} WHERE booking_id = ?`).run(...paymentValues);

    // If paid, update booking status to confirmed
    if (payment_status === 'paid') {
      db.prepare("UPDATE bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'pending'").run(req.params.id);
    }

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    res.json({ message: 'Payment status updated.', booking: updated });
  } catch (err) {
    console.error('Admin update payment status error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /:id/refund - process refund
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

    // Update payment
    db.prepare("UPDATE payments SET refund_amount = ?, status = 'refunded' WHERE booking_id = ?").run(amount, booking.id);

    // Update booking
    db.prepare("UPDATE bookings SET status = 'refunded', payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?").run(booking.id);

    // Deactivate voucher
    db.prepare("UPDATE vouchers SET status = 'cancelled' WHERE booking_id = ?").run(booking.id);

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    const updatedPayment = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id);

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
