const db = require('./database');

const RestaurantModel = {
  getAll() {
    return db.prepare('SELECT * FROM restaurants ORDER BY rating DESC').all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
  },

  getNearby(lat, lng) {
    // Haversine-based distance in km, computed in JS since SQLite lacks trig functions
    const all = db.prepare('SELECT * FROM restaurants WHERE latitude IS NOT NULL AND longitude IS NOT NULL').all();
    const toRad = (deg) => deg * Math.PI / 180;
    return all
      .map(r => {
        const dLat = toRad(r.latitude - lat);
        const dLng = toRad(r.longitude - lng);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(lat)) * Math.cos(toRad(r.latitude)) * Math.sin(dLng / 2) ** 2;
        const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...r, distance: Math.round(distance * 100) / 100 };
      })
      .sort((a, b) => a.distance - b.distance);
  },

  getByOwnerId(ownerId) {
    return db.prepare('SELECT * FROM restaurants WHERE owner_id = ?').get(ownerId);
  },

  create({ owner_id, name, address, description, phone, opening_hours, num_tables, seats_per_table, max_guests, image_url,
           reservation_start_time, reservation_end_time, closed_days, special_closures }) {
    const stmt = db.prepare(`
      INSERT INTO restaurants (owner_id, name, address, description, phone, opening_hours, num_tables, seats_per_table, max_guests, image_url,
        reservation_start_time, reservation_end_time, closed_days, special_closures)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      owner_id, name, address, description || null, phone || null,
      opening_hours || null, num_tables || 10, seats_per_table || 4,
      max_guests || 40, image_url || null,
      reservation_start_time || '10:00', reservation_end_time || '23:00',
      closed_days || '[]', special_closures || '[]'
    );
    return this.getById(result.lastInsertRowid);
  },

  update(id, { name, address, description, phone, opening_hours, num_tables, seats_per_table, max_guests, image_url,
               reservation_start_time, reservation_end_time, closed_days, special_closures }) {
    db.prepare(`
      UPDATE restaurants SET name=?, address=?, description=?, phone=?, opening_hours=?,
        num_tables=?, seats_per_table=?, max_guests=?, image_url=?,
        reservation_start_time=?, reservation_end_time=?, closed_days=?, special_closures=?
      WHERE id=?
    `).run(name, address, description || null, phone || null, opening_hours || null,
      num_tables, seats_per_table, max_guests, image_url || null,
      reservation_start_time || '10:00', reservation_end_time || '23:00',
      closed_days || '[]', special_closures || '[]', id);
    return this.getById(id);
  }
};

module.exports = RestaurantModel;
