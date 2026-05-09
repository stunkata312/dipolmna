const db = require('./database');

// Cache prepared statements for performance
const stmts = {
  create: db.prepare(
    'INSERT INTO reservations (user_id, restaurant_id, name, email, phone, date, time, num_people, notes, status, preferred_table) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
  updatePreferredTable: db.prepare('UPDATE reservations SET preferred_table = ? WHERE id = ?'),
  updateStatus: db.prepare('UPDATE reservations SET status = ?, assigned_table = ?, cancelled_at = NULL WHERE id = ?'),
  // Used for both 'cancelled' and 'no_show' — both stamp cancelled_at so they share
  // the same sort order and 15-day cleanup behavior.
  updateStatusCancelled: db.prepare("UPDATE reservations SET status = ?, assigned_table = ?, cancelled_at = datetime('now') WHERE id = ?"),
  deleteById: db.prepare('DELETE FROM reservations WHERE id = ?'),
  getCompleted: db.prepare(`
    SELECT r.*, u.name AS user_name
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = ? AND r.status IN ('arrived', 'completed')
    ORDER BY r.date DESC, r.time DESC
  `),
  getCancelled: db.prepare(`
    SELECT r.*, u.name AS user_name
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = ? AND r.status IN ('cancelled', 'no_show')
    ORDER BY COALESCE(r.cancelled_at, r.date || ' ' || r.time) DESC
  `),
  // Only cancelled rows expire after 15 days. No-shows are kept indefinitely
  // so the per-customer no-show count remains meaningful for the owner.
  deleteExpired: db.prepare(`
    DELETE FROM reservations
    WHERE status = 'cancelled' AND cancelled_at IS NOT NULL
      AND cancelled_at <= datetime('now', '-15 days')
  `),
  // Per-customer no-show counts for a restaurant
  noShowCountsByEmail: db.prepare(`
    SELECT email, COUNT(*) AS count
    FROM reservations
    WHERE restaurant_id = ? AND status = 'no_show'
    GROUP BY email
  `),
  // Flip yesterday's (or earlier) 'arrived' rows to 'completed' — owner forgot to click DONE
  completePastArrivals: db.prepare(`
    UPDATE reservations
    SET status = 'completed'
    WHERE status = 'arrived' AND date < ?
  `),
  // Flip rows whose start time + 15 min has passed → 'no_show'.
  // Covers both 'confirmed' (customer was approved but didn't arrive) and
  // 'pending' (owner never approved AND time passed — the request is dead).
  // Stamps cancelled_at so they sort like cancellations.
  markPastNoShows: db.prepare(`
    UPDATE reservations
    SET status = 'no_show', cancelled_at = datetime('now')
    WHERE status IN ('confirmed', 'pending') AND (date || ' ' || time) < ?
  `),
  getStats: db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'confirmed' AND date >= ? THEN 1 ELSE 0 END) AS upcoming,
      SUM(CASE WHEN status = 'arrived' AND date = ? THEN 1 ELSE 0 END) AS arrived,
      SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show,
      SUM(CASE WHEN status = 'cancelled' AND DATE(cancelled_at) = ? THEN 1 ELSE 0 END) AS cancelled_today,
      SUM(CASE WHEN status IN ('arrived', 'completed', 'no_show') THEN 1 ELSE 0 END) AS completed_total
    FROM reservations WHERE restaurant_id = ?
  `),
  clearArrivedToday: db.prepare(`
    UPDATE reservations
    SET status = 'completed'
    WHERE restaurant_id = ? AND status = 'arrived' AND date = ?
  `),
  // Bookings per time slot for a given date — only "active" reservations occupy a table.
  // 'completed' and 'no_show' free the table; 'cancelled' never held it.
  availabilityForDate: db.prepare(`
    SELECT time, COUNT(*) AS count
    FROM reservations
    WHERE restaurant_id = ? AND date = ?
      AND status IN ('pending', 'confirmed', 'arrived')
    GROUP BY time
  `),
  // Per-slot occupied tables — uses assigned_table when set, else preferred_table
  takenTablesForDate: db.prepare(`
    SELECT time, COALESCE(assigned_table, preferred_table) AS table_id
    FROM reservations
    WHERE restaurant_id = ? AND date = ?
      AND status IN ('pending', 'confirmed', 'arrived')
      AND COALESCE(assigned_table, preferred_table) IS NOT NULL
  `)
};

const ReservationModel = {
  create({ user_id, restaurant_id, name, email, phone, date, time, num_people, notes, preferred_table }) {
    const result = stmts.create.run(
      user_id, restaurant_id, name, email, phone || null, date, time, num_people,
      notes || null, 'pending', preferred_table || null
    );
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

  update(id, { date, time, num_people, preferred_table }) {
    stmts.update.run(date, time, num_people, id);
    if (preferred_table !== undefined) {
      stmts.updatePreferredTable.run(preferred_table, id);
    }
    return this.getById(id);
  },

  updateStatus(id, { status, assigned_table }) {
    // 'cancelled' and 'no_show' both stamp cancelled_at; everything else clears it
    if (status === 'cancelled' || status === 'no_show') {
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
    return stmts.getStats.get(today, today, today, restaurantId);
  },

  clearArrivedToday(restaurantId) {
    const today = new Date().toISOString().split('T')[0];
    const result = stmts.clearArrivedToday.run(restaurantId, today);
    return result.changes;
  },

  getAvailabilityForDate(restaurantId, date) {
    return stmts.availabilityForDate.all(restaurantId, date);
  },

  // { "19:00": [1, 3], "19:30": [2] }
  getTakenTablesForDate(restaurantId, date) {
    const rows = stmts.takenTablesForDate.all(restaurantId, date);
    const map = {};
    for (const r of rows) {
      if (!map[r.time]) map[r.time] = [];
      map[r.time].push(r.table_id);
    }
    return map;
  },

  // Map(email -> total no-shows at this restaurant)
  getNoShowCountsByEmail(restaurantId) {
    const rows = stmts.noShowCountsByEmail.all(restaurantId);
    const map = new Map();
    for (const r of rows) map.set(r.email, r.count);
    return map;
  },

  // Auto-flip stale rows. Cheap and idempotent — safe to call on every dashboard fetch.
  // - 'arrived' from past dates → 'completed' (owner forgot to click DONE before midnight)
  // - 'confirmed' past (start time + 15 min) → 'no_show'
  runMaintenance() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;

    const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
    const cyyyy = cutoff.getFullYear();
    const cmm = String(cutoff.getMonth() + 1).padStart(2, '0');
    const cdd = String(cutoff.getDate()).padStart(2, '0');
    const chh = String(cutoff.getHours()).padStart(2, '0');
    const cmi = String(cutoff.getMinutes()).padStart(2, '0');
    const noShowCutoff = `${cyyyy}-${cmm}-${cdd} ${chh}:${cmi}`;

    const completed = stmts.completePastArrivals.run(today).changes;
    const noShows = stmts.markPastNoShows.run(noShowCutoff).changes;
    return { completed, noShows };
  }
};

module.exports = ReservationModel;
