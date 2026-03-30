const db = require('./database');

const ReservationModel = {
  create({ user_id, restaurant_id, name, email, phone, date, time, num_people }) {
    const stmt = db.prepare(
      'INSERT INTO reservations (user_id, restaurant_id, name, email, phone, date, time, num_people) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(user_id, restaurant_id, name, email, phone || null, date, time, num_people);
    return { id: result.lastInsertRowid, user_id, restaurant_id, name, email, phone, date, time, num_people };
  },

  getByRestaurant(restaurantId) {
    return db.prepare('SELECT * FROM reservations WHERE restaurant_id = ?').all(restaurantId);
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

  deleteById(id) {
    db.prepare('DELETE FROM reservations WHERE id = ?').run(id);
  }
};

module.exports = ReservationModel;
