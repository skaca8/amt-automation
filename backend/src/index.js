const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const hotelRoutes = require('./routes/hotels');
const ticketRoutes = require('./routes/tickets');
const packageRoutes = require('./routes/packages');
const bookingRoutes = require('./routes/bookings');
const adminProductRoutes = require('./routes/admin/products');
const adminBookingRoutes = require('./routes/admin/bookings');
const adminUserRoutes = require('./routes/admin/users');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminPaymentRoutes = require('./routes/admin/payments');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database on startup
getDb();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`High1 Resort Booking API server running on port ${PORT}`);
  console.log(`API base URL: http://localhost:${PORT}/api`);
});

module.exports = app;
