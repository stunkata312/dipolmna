const ReviewModel = require('../models/reviewModel');
const RestaurantModel = require('../models/restaurantModel');

const ReviewController = {
  // GET /api/restaurants/:id/reviews
  list(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid restaurant ID' });
      if (!RestaurantModel.getById(id)) return res.status(404).json({ error: 'Restaurant not found' });

      const reviews = ReviewModel.listByRestaurant(id);
      const stats = ReviewModel.getStats(id);
      res.json({ stats, reviews });
    } catch (error) {
      console.error('List reviews error:', error);
      res.status(500).json({ error: 'Failed to load reviews' });
    }
  },

  // POST /api/restaurants/:id/reviews  — auth required
  create(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid restaurant ID' });
      if (!RestaurantModel.getById(id)) return res.status(404).json({ error: 'Restaurant not found' });

      const rating = parseInt(req.body.rating, 10);
      const comment = (req.body.comment || '').trim() || null;

      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      // Restaurant owners cannot review their own restaurant
      const restaurant = RestaurantModel.getById(id);
      if (restaurant.owner_id === req.user.id) {
        return res.status(403).json({ error: 'You cannot review your own restaurant' });
      }

      const review = ReviewModel.upsert({
        restaurant_id: id,
        user_id: req.user.id,
        rating,
        comment,
      });

      res.status(201).json({ message: 'Review saved', review });
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({ error: 'Failed to save review' });
    }
  },

  // DELETE /api/restaurants/:id/reviews/me  — auth required
  remove(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid restaurant ID' });
      if (!RestaurantModel.getById(id)) return res.status(404).json({ error: 'Restaurant not found' });

      const removed = ReviewModel.deleteByUserAndRestaurant(id, req.user.id);
      if (!removed) return res.status(404).json({ error: 'No review to delete' });

      res.json({ message: 'Review deleted' });
    } catch (error) {
      console.error('Delete review error:', error);
      res.status(500).json({ error: 'Failed to delete review' });
    }
  },
};

module.exports = ReviewController;
