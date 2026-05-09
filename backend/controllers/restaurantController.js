const RestaurantModel = require('../models/restaurantModel');
const ReservationModel = require('../models/reservationModel');

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

  getNearby(req, res) {
    try {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'lat and lng query parameters are required' });
      }
      const restaurants = RestaurantModel.getNearby(lat, lng);
      res.json(restaurants);
    } catch (error) {
      console.error('Error fetching nearby restaurants:', error);
      res.status(500).json({ error: 'Failed to fetch nearby restaurants' });
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
  },

  // GET /api/restaurants/:id/availability?date=YYYY-MM-DD
  getAvailability(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { date } = req.query;
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid restaurant ID' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
        return res.status(400).json({ error: 'date=YYYY-MM-DD is required' });
      }
      const restaurant = RestaurantModel.getById(id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

      const rows = ReservationModel.getAvailabilityForDate(id, date);
      const slots = {};
      for (const r of rows) slots[r.time] = r.count;

      // Per-slot taken-table ids and the restaurant's table config so the customer-side
      // picker knows which tables are free and which fit the party size.
      const takenTables = ReservationModel.getTakenTablesForDate(id, date);
      let tables = [];
      try { tables = JSON.parse(restaurant.tables || '[]'); } catch {}

      res.json({
        date,
        num_tables: restaurant.num_tables,
        slots,
        tables,
        taken_tables: takenTables,
      });
    } catch (error) {
      console.error('Error fetching availability:', error);
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  }
};

module.exports = RestaurantController;
