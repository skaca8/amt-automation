const express = require('express');
const { getDb } = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticate, requireAdmin);

// GET /overview - overall stats
router.get('/overview', (req, res) => {
  try {
    const db = getDb();

    const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings').get().count;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE status != 'cancelled' AND payment_status = 'paid'").get().total;
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get().count;

    const totalHotels = db.prepare("SELECT COUNT(*) as count FROM hotels WHERE status = 'active'").get().count;
    const totalTickets = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'active'").get().count;
    const totalPackages = db.prepare("SELECT COUNT(*) as count FROM packages WHERE status = 'active'").get().count;

    const pendingBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'").get().count;
    const confirmedBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'").get().count;
    const cancelledBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'cancelled'").get().count;

    const today = new Date().toISOString().split('T')[0];
    const todayBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE DATE(created_at) = ?").get(today).count;
    const todayRevenue = db.prepare("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE DATE(created_at) = ? AND status != 'cancelled'").get(today).total;

    res.json({
      total_bookings: totalBookings,
      total_revenue: totalRevenue,
      total_users: totalUsers,
      products: {
        hotels: totalHotels,
        tickets: totalTickets,
        packages: totalPackages
      },
      booking_status: {
        pending: pendingBookings,
        confirmed: confirmedBookings,
        cancelled: cancelledBookings
      },
      today: {
        bookings: todayBookings,
        revenue: todayRevenue
      }
    });
  } catch (err) {
    console.error('Admin dashboard overview error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /recent-bookings - last 10 bookings
router.get('/recent-bookings', (req, res) => {
  try {
    const db = getDb();

    const bookings = db.prepare(`
      SELECT b.*, u.name as user_name, u.email as user_email
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `).all();

    res.json({ bookings });
  } catch (err) {
    console.error('Admin recent bookings error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /revenue-chart - daily revenue for last 30 days
router.get('/revenue-chart', (req, res) => {
  try {
    const db = getDb();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const revenueData = db.prepare(`
      SELECT DATE(created_at) as date, COALESCE(SUM(total_price), 0) as revenue, COUNT(*) as booking_count
      FROM bookings
      WHERE DATE(created_at) >= ? AND status != 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(startDate);

    // Fill in missing dates with zero revenue
    const result = [];
    const current = new Date(startDate);
    const today = new Date();

    while (current <= today) {
      const dateStr = current.toISOString().split('T')[0];
      const existing = revenueData.find(d => d.date === dateStr);

      result.push({
        date: dateStr,
        revenue: existing ? existing.revenue : 0,
        booking_count: existing ? existing.booking_count : 0
      });

      current.setDate(current.getDate() + 1);
    }

    res.json({ data: result });
  } catch (err) {
    console.error('Admin revenue chart error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /booking-chart - daily booking count for last 30 days
router.get('/booking-chart', (req, res) => {
  try {
    const db = getDb();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];

    const bookingData = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count,
        COUNT(CASE WHEN product_type = 'hotel' THEN 1 END) as hotel_count,
        COUNT(CASE WHEN product_type = 'ticket' THEN 1 END) as ticket_count,
        COUNT(CASE WHEN product_type = 'package' THEN 1 END) as package_count
      FROM bookings
      WHERE DATE(created_at) >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(startDate);

    // Fill in missing dates
    const result = [];
    const current = new Date(startDate);
    const today = new Date();

    while (current <= today) {
      const dateStr = current.toISOString().split('T')[0];
      const existing = bookingData.find(d => d.date === dateStr);

      result.push({
        date: dateStr,
        count: existing ? existing.count : 0,
        hotel_count: existing ? existing.hotel_count : 0,
        ticket_count: existing ? existing.ticket_count : 0,
        package_count: existing ? existing.package_count : 0
      });

      current.setDate(current.getDate() + 1);
    }

    res.json({ data: result });
  } catch (err) {
    console.error('Admin booking chart error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
