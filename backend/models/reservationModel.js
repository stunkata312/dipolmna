const db = require('./database');

// Cache prepared statements for performance
const stmts = {
  create: db.prepare(
    'INSERT INTO reservations (user_id, restaurant_id, name, email, phone, date, time, num_people, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ),
  getByRestaurant: db.prepare(`
    SELECT r.*, u.name AS user_name, u.email AS user_email
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = ?
    ORDER BY r.date ASC, r.time ASC
  `),
  getPending: db.prepare(`
    SELECT r.*, u.name AS user_name
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = ? AND r.status = 'pending'
    ORDER BY r.created_at ASC
  `),
  getUpcoming: db.prepare(`
    SELECT r.*, u.name AS user_name
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = ? AND r.status = 'confirmed' AND r.date >= ?
    ORDER BY r.date ASC, r.time ASC
  `),
  getByUserEmail: db.prepare(`
    SELECT r.*, rest.name AS restaurant_name, rest.image_url AS restaurant_image
    FROM reservations r
    JOIN restaurants rest ON r.restaurant_id = rest.id
    WHERE r.email = ?
    ORDER BY r.date DESC, r.time DESC
  `),
  getById: db.prepare(`
    SELECT r.*, rest.name AS restaurant_name, rest.image_url AS restaurant_image
    FROM reservations r
    JOIN restaurants rest ON r.restaurant_id = rest.id
    WHERE r.id = ?
  `),
  update: db.prepare('UPDATE reservations SET date = ?, time = ?, num_people = ? WHERE id = ?'),
  updateStatus: db.prepare('UPDATE reservations SET status = ?, assigned_table = ?, cancelled_at = NULL WHERE id = ?'),
  updateStatusCancelled: db.prepare("UPDATE reservations SET status = ?, assigned_table = ?, cancelled_at = datetime('now') WHERE id = ?"),
  deleteById: db.prepare('DELETE FROM reservations WHERE id = ?'),
  getCompleted: db.prepare(`
    SELECT r.*, u.name AS user_name
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = ? AND r.status = 'arrived'
    ORDER BY r.date DESC, r.time DESC
  `),
  getCancelled: db.prepare(`
    SELECT r.*, u.name AS user_name
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = ? AND r.status = 'cancelled'
    ORDER BY r.cancelled_at DESC
  `),
  deleteExpired: db.prepare(`
    DELETE FROM reservations
    WHERE status = 'cancelled' AND cancelled_at IS NOT NULL
      AND cancelled_at <= datetime('now', '-15 days')
  `),
  getStats: db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'confirmed' AND date >= ? THEN 1 ELSE 0 END) AS upcoming,
      SUM(CASE WHEN status = 'arrived' THEN 1 ELSE 0 END) AS arrived,
      SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN status = 'arrived' OR status = 'no_show' THEN 1 ELSE 0 END) AS completed_total
    FROM reservations WHERE restaurant_id = ?
  `)
};

const ReservationModel = {
  create({ user_id, restaurant_id, name, email, phone, date, time, num_people, notes }) {
    const result = stmts.create.run(user_id, restaurant_id, name, email, phone || null, date, time, num_people, notes || null, 'pending');
    return this.getById(result.lastInsertRowid);
  },

  getByRestaurant(restaurantId) {
    return stmts.getByRestaurant.all(restaurantId);
  },

  getPendingByRestaurant(restaurantId) {
    return stmts.getPending.all(restaurantId);
  },

  getUpcomingByRestaurant(restaurantId) {
    const today = new Date().toISOString().split('T')[0];
    return stmts.getUpcoming.all(restaurantId, today);
  },

  getByUserEmail(email) {
    return stmts.getByUserEmail.all(email);
  },

  getById(id) {
    return stmts.getById.get(id);
  },

  update(id, { date, time, num_people }) {
    stmts.update.run(date, time, num_people, id);
    return this.getById(id);
  },

  updateStatus(id, { status, assigned_table }) {
    if (status === 'cancelled') {
      stmts.updateStatusCancelled.run(status, assigned_table || null, id);
    } else {
      stmts.updateStatus.run(status, assigned_table || null, id);
    }
    return this.getById(id);
  },

  deleteById(id) {
    stmts.deleteById.run(id);
  },

  getCompletedByRestaurant(restaurantId) {
    return stmts.getCompleted.all(restaurantId);
  },

  getCancelledByRestaurant(restaurantId) {
    return stmts.getCancelled.all(restaurantId);
  },

  deleteExpiredCancelled() {
    const result = stmts.deleteExpired.run();
    return result.changes;
  },

  getStatsByRestaurant(restaurantId) {
    const today = new Date().toISOString().split('T')[0];
    return stmts.getStats.get(today, restaurantId);
  }
};

module.exports = ReservationModel;
