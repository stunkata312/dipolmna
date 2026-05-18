const db = require('./database');

const UserModel = {
  getById(id) {
    return db.prepare('SELECT id, name, email, phone, google_id, avatar_url, role, restaurant_id, created_at FROM users WHERE id = ?').get(id);
  },

  getByEmail(email) {
    // Email is case-insensitive per RFC, so "Foo@bar.com" must match
    // whatever casing is stored. COLLATE NOCASE keeps the UNIQUE index
    // case-sensitive (existing behaviour) while making reads forgiving.
    return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  },

  // Lookup by phone using a digits-only comparison so old "+359 888..." values
  // still match a fresh "359888..." sign-in. Returns null if the lookup is
  // ambiguous (more than one row maps to the same digits), so a stray duplicate
  // can never grant access to the wrong account.
  getByPhone(digits) {
    if (!digits) return null;
    const all = db.prepare("SELECT * FROM users WHERE phone IS NOT NULL AND phone != ''").all();
    const matches = all.filter(u => u.phone.replace(/\D/g, '') === digits);
    return matches.length === 1 ? matches[0] : null;
  },

  getByGoogleId(googleId) {
    return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  },

  create({ name, email, phone, google_id, password_hash, avatar_url }) {
    const normalized = (email || '').toLowerCase();
    const stmt = db.prepare(
      'INSERT INTO users (name, email, phone, google_id, password_hash, avatar_url) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, normalized, phone || null, google_id || null, password_hash || null, avatar_url || null);
    return { id: result.lastInsertRowid, name, email: normalized, phone, avatar_url };
  },

  updateGoogleId(userId, googleId, avatarUrl) {
    db.prepare('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?').run(googleId, avatarUrl, userId);
  },

  updatePasswordHash(userId, passwordHash) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  },

  updateProfile(userId, { name, phone, avatar_url }) {
    db.prepare('UPDATE users SET name = ?, phone = ?, avatar_url = ? WHERE id = ?').run(name, phone || null, avatar_url || null, userId);
  },

  setRole(userId, role) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  },

  setRestaurantId(userId, restaurantId) {
    db.prepare('UPDATE users SET restaurant_id = ? WHERE id = ?').run(restaurantId, userId);
  },

  listByRestaurant(restaurantId) {
    return db.prepare(
      `SELECT id, name, email, phone, role, restaurant_id
         FROM users
        WHERE restaurant_id = ? AND (role = 'restaurant' OR role = 'hostess')
        ORDER BY role DESC, id ASC`
    ).all(restaurantId);
  },

  updateAccount(userId, { name, email, phone }) {
    db.prepare('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?').run(
      name, (email || '').toLowerCase(), phone || null, userId
    );
  },

  deleteAccount(userId) {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  },

  findOrCreate({ name, email, phone }) {
    const existing = this.getByEmail(email);
    if (existing) return existing;
    return this.create({ name, email, phone });
  }
};

module.exports = UserModel;
