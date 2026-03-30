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
  }
};

module.exports = RestaurantModel;
