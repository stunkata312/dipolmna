const db = require('./database');

const UserModel = {
  getById(id) {
    return db.prepare('SELECT id, name, email, phone, google_id, avatar_url, role, created_at FROM users WHERE id = ?').get(id);
  },

  getByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  getByGoogleId(googleId) {
    return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  },

  create({ name, email, phone, google_id, password_hash, avatar_url }) {
    const stmt = db.prepare(
      'INSERT INTO users (name, email, phone, google_id, password_hash, avatar_url) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, email, phone || null, google_id || null, password_hash || null, avatar_url || null);
    return { id: result.lastInsertRowid, name, email, phone, avatar_url };
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

  findOrCreate({ name, email, phone }) {
    const existing = this.getByEmail(email);
    if (existing) return existing;
    return this.create({ name, email, phone });
  }
};

module.exports = UserModel;
