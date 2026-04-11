const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function getDb() {
  if (db) return db;

  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'high1.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initTables(db);

  return db;
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      nationality TEXT,
      role TEXT DEFAULT 'customer',
      language TEXT DEFAULT 'en',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hotels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      address TEXT,
      image_url TEXT,
      rating REAL DEFAULT 0,
      amenities TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS room_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      max_guests INTEGER DEFAULT 2,
      bed_type TEXT,
      amenities TEXT DEFAULT '[]',
      image_url TEXT,
      base_price REAL NOT NULL,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_type_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_rooms INTEGER NOT NULL,
      booked_rooms INTEGER DEFAULT 0,
      price REAL,
      UNIQUE(room_type_id, date),
      FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      category TEXT,
      image_url TEXT,
      base_price REAL NOT NULL,
      duration TEXT,
      location TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      booked_quantity INTEGER DEFAULT 0,
      price REAL,
      UNIQUE(ticket_id, date),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_cn TEXT,
      description_en TEXT,
      description_cn TEXT,
      image_url TEXT,
      base_price REAL NOT NULL,
      includes TEXT DEFAULT '[]',
      duration TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS package_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS package_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      booked_quantity INTEGER DEFAULT 0,
      price REAL,
      UNIQUE(package_id, date),
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_number TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_phone TEXT,
      product_type TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      room_type_id INTEGER,
      check_in TEXT,
      check_out TEXT,
      visit_date TEXT,
      guests INTEGER DEFAULT 1,
      quantity INTEGER DEFAULT 1,
      nights INTEGER DEFAULT 1,
      total_price REAL NOT NULL,
      currency TEXT DEFAULT 'KRW',
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      payment_id TEXT,
      special_requests TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'KRW',
      method TEXT DEFAULT 'stripe',
      stripe_payment_id TEXT,
      status TEXT DEFAULT 'pending',
      refund_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      qr_data TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
  `);
}

module.exports = { getDb };
