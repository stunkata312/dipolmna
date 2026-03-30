const db = require('./database');

const ReservationModel = {
  create({ user_id, restaurant_id, name, email, phone, date, time, num_people, notes }) {
    const stmt = db.prepare(
      'INSERT INTO reservations (user_id, restaurant_id, name, email, phone, date, time, num_people, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(user_id, restaurant_id, name, email, phone || null, date, time, num_people, notes || null, 'pending');
    return this.getById(result.lastInsertRowid);
  },

  getByRestaurant(restaurantId) {
    return db.prepare(`
      SELECT r.*, u.name AS user_name, u.email AS user_email
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.restaurant_id = ?
      ORDER BY r.date ASC, r.time ASC
    `).all(restaurantId);
  },

  getPendingByRestaurant(restaurantId) {
    return db.prepare(`
      SELECT r.*, u.name AS user_name
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.restaurant_id = ? AND r.status = 'pending'
      ORDER BY r.created_at ASC
    `).all(restaurantId);
  },

  getUpcomingByRestaurant(restaurantId) {
    const today = new Date().toISOString().split('T')[0];
    return db.prepare(`
      SELECT r.*, u.name AS user_name
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.restaurant_id = ? AND r.status IN ('confirmed', 'arrived') AND r.date >= ?
      ORDER BY r.date ASC, r.time ASC
    `).all(restaurantId, today);
  },

  getByUserEmail(email) {
    return db.prepare(`
      SELECT r.*, rest.name AS restaurant_name, rest.image_url AS restaurant_image
      FROM reservations r
      JOIN restaurants rest ON r.restaurant_id = rest.id
      WHERE r.email = ?
      ORDER BY r.date DESC, r.time DESC
    `).all(email);
  },

  getById(id) {
    return db.prepare(`
      SELECT r.*, rest.name AS restaurant_name, rest.image_url AS restaurant_image
      FROM reservations r
      JOIN restaurants rest ON r.restaurant_id = rest.id
      WHERE r.id = ?
    `).get(id);
  },

  update(id, { date, time, num_people }) {
    db.prepare('UPDATE reservations SET date = ?, time = ?, num_people = ? WHERE id = ?').run(date, time, num_people, id);
    return this.getById(id);
  },

  updateStatus(id, { status, assigned_table }) {
    db.prepare('UPDATE reservations SET status = ?, assigned_table = ? WHERE id = ?')
      .run(status, assigned_table || null, id);
    return this.getById(id);
  },

  deleteById(id) {
    db.prepare('DELETE FROM reservations WHERE id = ?').run(id);
  },

  getStatsByRestaurant(restaurantId) {
    const today = new Date().toISOString().split('T')[0];
    const stats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'confirmed' AND date >= ? THEN 1 ELSE 0 END) AS upcoming,
        SUM(CASE WHEN status = 'arrived' THEN 1 ELSE 0 END) AS arrived,
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN status = 'arrived' OR status = 'no_show' THEN 1 ELSE 0 END) AS completed_total
      FROM reservations WHERE restaurant_id = ?
    `).get(today, restaurantId);
    return stats;
  }
};

module.exports = ReservationModel;
