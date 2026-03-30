const db = require('./database');

const RestaurantModel = {
  getAll() {
    return db.prepare('SELECT * FROM restaurants ORDER BY rating DESC').all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
  }
};

module.exports = RestaurantModel;
