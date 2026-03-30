const RestaurantModel = require('../models/restaurantModel');

const RestaurantController = {
  getAll(req, res) {
    try {
      const restaurants = RestaurantModel.getAll();
      res.json(restaurants);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
  },

  getById(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid restaurant ID' });
      }

      const restaurant = RestaurantModel.getById(id);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }

      res.json(restaurant);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      res.status(500).json({ error: 'Failed to fetch restaurant' });
    }
  }
};

module.exports = RestaurantController;
