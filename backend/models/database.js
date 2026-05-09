const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'restaurant.db');
const db = new Database(dbPath);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    google_id TEXT UNIQUE,
    password_hash TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT,
    rating REAL DEFAULT 0 CHECK(rating >= 0 AND rating <= 5),
    image_url TEXT,
    latitude REAL,
    longitude REAL,
    phone TEXT,
    opening_hours TEXT,
    num_tables INTEGER DEFAULT 10,
    seats_per_table INTEGER DEFAULT 4,
    max_guests INTEGER DEFAULT 40,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    num_people INTEGER NOT NULL CHECK(num_people > 0),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_table INTEGER,
    cancelled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, user_id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    num_people INTEGER NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );
`);

// Migrate users: add new columns if they don't exist yet
const columns = db.pragma('table_info(users)').map(c => c.name);
if (!columns.includes('google_id')) {
  db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
}
if (!columns.includes('password_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
}
if (!columns.includes('avatar_url')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
}
if (!columns.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'");
}

// Migrate restaurants: add new columns if missing
const restCols = db.pragma('table_info(restaurants)').map(c => c.name);
if (!restCols.includes('owner_id')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN owner_id INTEGER');
}
if (!restCols.includes('latitude')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN latitude REAL');
}
if (!restCols.includes('longitude')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN longitude REAL');
}
if (!restCols.includes('phone')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN phone TEXT');
}
if (!restCols.includes('opening_hours')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN opening_hours TEXT');
}
if (!restCols.includes('num_tables')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN num_tables INTEGER DEFAULT 10');
}
if (!restCols.includes('seats_per_table')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN seats_per_table INTEGER DEFAULT 4');
}
if (!restCols.includes('max_guests')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN max_guests INTEGER DEFAULT 40');
}
if (!restCols.includes('reservation_start_time')) {
  db.exec("ALTER TABLE restaurants ADD COLUMN reservation_start_time TEXT DEFAULT '10:00'");
}
if (!restCols.includes('reservation_end_time')) {
  db.exec("ALTER TABLE restaurants ADD COLUMN reservation_end_time TEXT DEFAULT '23:00'");
}
if (!restCols.includes('closed_days')) {
  db.exec("ALTER TABLE restaurants ADD COLUMN closed_days TEXT DEFAULT '[]'");
}
if (!restCols.includes('special_closures')) {
  db.exec("ALTER TABLE restaurants ADD COLUMN special_closures TEXT DEFAULT '[]'");
}
if (!restCols.includes('cover_images')) {
  db.exec("ALTER TABLE restaurants ADD COLUMN cover_images TEXT DEFAULT '[]'");
}
if (!restCols.includes('gallery_images')) {
  db.exec("ALTER TABLE restaurants ADD COLUMN gallery_images TEXT DEFAULT '[]'");
}
// Per-table seat config: JSON array of { id, seats }. Backfilled from num_tables/seats_per_table.
if (!restCols.includes('tables')) {
  db.exec("ALTER TABLE restaurants ADD COLUMN tables TEXT DEFAULT '[]'");
  const existing = db.prepare("SELECT id, num_tables, seats_per_table FROM restaurants").all();
  const update = db.prepare("UPDATE restaurants SET tables = ? WHERE id = ?");
  for (const r of existing) {
    const arr = [];
    const n = r.num_tables || 0;
    const s = r.seats_per_table || 4;
    for (let i = 1; i <= n; i++) arr.push({ id: i, seats: s });
    update.run(JSON.stringify(arr), r.id);
  }
}

// Migrate reservations: add new columns if missing
const resCols = db.pragma('table_info(reservations)').map(c => c.name);
if (!resCols.includes('name')) {
  db.exec("ALTER TABLE reservations ADD COLUMN name TEXT DEFAULT ''");
}
if (!resCols.includes('email')) {
  db.exec("ALTER TABLE reservations ADD COLUMN email TEXT DEFAULT ''");
}
if (!resCols.includes('phone')) {
  db.exec('ALTER TABLE reservations ADD COLUMN phone TEXT');
}
if (!resCols.includes('notes')) {
  db.exec('ALTER TABLE reservations ADD COLUMN notes TEXT');
}
if (!resCols.includes('status')) {
  db.exec("ALTER TABLE reservations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
}
if (!resCols.includes('assigned_table')) {
  db.exec('ALTER TABLE reservations ADD COLUMN assigned_table INTEGER');
}
if (!resCols.includes('cancelled_at')) {
  db.exec('ALTER TABLE reservations ADD COLUMN cancelled_at DATETIME');
}
// Customer's optional table preference shown to the owner on the pending card
if (!resCols.includes('preferred_table')) {
  db.exec('ALTER TABLE reservations ADD COLUMN preferred_table INTEGER');
}

// Performance indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON reservations(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
  CREATE INDEX IF NOT EXISTS idx_reservations_email ON reservations(email);
  CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(restaurant_id, status);
  CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(restaurant_id, date);
  CREATE INDEX IF NOT EXISTS idx_reservations_cancelled_at ON reservations(status, cancelled_at);
  CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
  CREATE INDEX IF NOT EXISTS idx_restaurants_coords ON restaurants(latitude, longitude);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
`);

module.exports = db;
