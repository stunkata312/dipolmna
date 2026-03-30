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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT,
    rating REAL DEFAULT 0 CHECK(rating >= 0 AND rating <= 5),
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );
`);

// Migrate: add new columns if they don't exist yet
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

// Migrate reservations: add name, email, phone if missing
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

module.exports = db;
