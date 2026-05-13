const ReviewModel = require('../models/reviewModel');
const RestaurantModel = require('../models/restaurantModel');

const ReviewController = {
  // GET /api/restaurants/:id/reviews — public; hides reviews the owner has hidden,
  // but stats stay computed across all reviews so the star average is unaffected.
  list(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid restaurant ID' });
      if (!RestaurantModel.getById(id)) return res.status(404).json({ error: 'Restaurant not found' });

      const reviews = ReviewModel.listVisibleByRestaurant(id);
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

  // GET /api/restaurant/reviews — owner view, includes hidden reviews
  ownerList(req, res) {
    try {
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
      const reviews = ReviewModel.listByRestaurant(restaurant.id);
      const stats = ReviewModel.getStats(restaurant.id);
      res.json({ stats, reviews });
    } catch (error) {
      console.error('Owner list reviews error:', error);
      res.status(500).json({ error: 'Failed to load reviews' });
    }
  },

  // PUT /api/restaurant/reviews/:reviewId/reply
  setReply(req, res) {
    try {
      const reviewId = parseInt(req.params.reviewId, 10);
      if (isNaN(reviewId)) return res.status(400).json({ error: 'Invalid review ID' });
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
      const review = ReviewModel.getById(reviewId);
      if (!review || review.restaurant_id !== restaurant.id) {
        return res.status(404).json({ error: 'Review not found' });
      }
      const reply = (req.body.reply || '').trim();
      if (!reply) return res.status(400).json({ error: 'Reply text is required' });
      if (reply.length > 1000) return res.status(400).json({ error: 'Reply is too long (max 1000 chars)' });
      ReviewModel.setReply(restaurant.id, reviewId, reply);
      res.json({ message: 'Reply saved' });
    } catch (error) {
      console.error('Set reply error:', error);
      res.status(500).json({ error: 'Failed to save reply' });
    }
  },

  // DELETE /api/restaurant/reviews/:reviewId/reply
  clearReply(req, res) {
    try {
      const reviewId = parseInt(req.params.reviewId, 10);
      if (isNaN(reviewId)) return res.status(400).json({ error: 'Invalid review ID' });
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
      const review = ReviewModel.getById(reviewId);
      if (!review || review.restaurant_id !== restaurant.id) {
        return res.status(404).json({ error: 'Review not found' });
      }
      ReviewModel.clearReply(restaurant.id, reviewId);
      res.json({ message: 'Reply removed' });
    } catch (error) {
      console.error('Clear reply error:', error);
      res.status(500).json({ error: 'Failed to remove reply' });
    }
  },

  // PUT /api/restaurant/reviews/:reviewId/hidden  body: { hidden: boolean }
  setHidden(req, res) {
    try {
      const reviewId = parseInt(req.params.reviewId, 10);
      if (isNaN(reviewId)) return res.status(400).json({ error: 'Invalid review ID' });
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
      const review = ReviewModel.getById(reviewId);
      if (!review || review.restaurant_id !== restaurant.id) {
        return res.status(404).json({ error: 'Review not found' });
      }
      const hidden = !!req.body.hidden;
      ReviewModel.setHidden(restaurant.id, reviewId, hidden);
      res.json({ message: hidden ? 'Review hidden' : 'Review unhidden' });
    } catch (error) {
      console.error('Set hidden error:', error);
      res.status(500).json({ error: 'Failed to update review visibility' });
    }
  },
};

module.exports = ReviewController;
