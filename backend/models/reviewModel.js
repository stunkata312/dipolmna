const db = require('./database');

const stmts = {
  upsert: db.prepare(`
    INSERT INTO reviews (restaurant_id, user_id, rating, comment)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(restaurant_id, user_id) DO UPDATE SET
      rating = excluded.rating,
      comment = excluded.comment,
      created_at = CURRENT_TIMESTAMP
  `),
  listByRestaurant: db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at,
           u.id AS user_id, u.name AS user_name, u.avatar_url
    FROM reviews r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.restaurant_id = ?
    ORDER BY r.created_at DESC
  `),
  getByUserAndRestaurant: db.prepare(`
    SELECT * FROM reviews WHERE restaurant_id = ? AND user_id = ?
  `),
  // Average rating + count by star bucket
  stats: db.prepare(`
    SELECT
      COUNT(*) AS total,
      ROUND(AVG(rating) * 10) / 10.0 AS avg,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS count5,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS count4,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS count3,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS count2,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS count1
    FROM reviews WHERE restaurant_id = ?
  `),
  setRestaurantRating: db.prepare('UPDATE restaurants SET rating = ? WHERE id = ?'),
  deleteByUserAndRestaurant: db.prepare('DELETE FROM reviews WHERE restaurant_id = ? AND user_id = ?'),
};

const ReviewModel = {
  upsert({ restaurant_id, user_id, rating, comment }) {
    stmts.upsert.run(restaurant_id, user_id, rating, comment || null);
    // Recalculate the restaurant's aggregate rating
    const s = stmts.stats.get(restaurant_id);
    const avg = s && s.total > 0 ? s.avg : 0;
    stmts.setRestaurantRating.run(avg, restaurant_id);
    return stmts.getByUserAndRestaurant.get(restaurant_id, user_id);
  },

  listByRestaurant(restaurant_id) {
    return stmts.listByRestaurant.all(restaurant_id);
  },

  getStats(restaurant_id) {
    const s = stmts.stats.get(restaurant_id);
    return {
      total: s.total || 0,
      avg: s.total > 0 ? s.avg : 0,
      counts: {
        5: s.count5 || 0,
        4: s.count4 || 0,
        3: s.count3 || 0,
        2: s.count2 || 0,
        1: s.count1 || 0,
      },
    };
  },

  getByUserAndRestaurant(user_id, restaurant_id) {
    return stmts.getByUserAndRestaurant.get(restaurant_id, user_id);
  },

  deleteByUserAndRestaurant(restaurant_id, user_id) {
    const result = stmts.deleteByUserAndRestaurant.run(restaurant_id, user_id);
    // Recalculate the restaurant's aggregate rating
    const s = stmts.stats.get(restaurant_id);
    const avg = s && s.total > 0 ? s.avg : 0;
    stmts.setRestaurantRating.run(avg, restaurant_id);
    return result.changes > 0;
  },
};

module.exports = ReviewModel;
