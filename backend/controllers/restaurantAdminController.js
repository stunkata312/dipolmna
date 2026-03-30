const bcrypt = require('bcryptjs');
const RestaurantModel = require('../models/restaurantModel');
const ReservationModel = require('../models/reservationModel');
const UserModel = require('../models/userModel');
const { generateToken } = require('../middleware/auth');

const RestaurantAdminController = {
  // POST /api/restaurant/register
  register(req, res) {
    try {
      const { name, email, password, phone: ownerPhone,
              restaurant_name, address, description,
              restaurant_phone, opening_hours,
              num_tables, seats_per_table, max_guests, image_url } = req.body;

      if (!name || !email || !password || !restaurant_name || !address) {
        return res.status(400).json({ error: 'Name, email, password, restaurant name and address are required' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const existing = UserModel.getByEmail(email);
      if (existing && existing.password_hash) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      // Check if email is already a restaurant owner
      if (existing && existing.role === 'restaurant') {
        return res.status(409).json({ error: 'This email already manages a restaurant' });
      }

      const password_hash = bcrypt.hashSync(password, 10);
      let user;
      if (existing) {
        UserModel.updatePasswordHash(existing.id, password_hash);
        user = UserModel.getById(existing.id);
      } else {
        user = UserModel.create({ name, email, phone: ownerPhone || null, password_hash });
      }

      // Set role to restaurant
      UserModel.setRole(user.id, 'restaurant');
      user = UserModel.getById(user.id);

      // Create restaurant record
      const restaurant = RestaurantModel.create({
        owner_id: user.id,
        name: restaurant_name,
        address,
        description: description || null,
        phone: restaurant_phone || null,
        opening_hours: opening_hours || null,
        num_tables: num_tables ? parseInt(num_tables, 10) : 10,
        seats_per_table: seats_per_table ? parseInt(seats_per_table, 10) : 4,
        max_guests: max_guests ? parseInt(max_guests, 10) : 40,
        image_url: image_url || null
      });

      const token = generateToken(user);
      res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role },
        restaurant
      });
    } catch (error) {
      console.error('Restaurant registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  // GET /api/restaurant/me  — get own restaurant info
  getMyRestaurant(req, res) {
    try {
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      res.json(restaurant);
    } catch (error) {
      console.error('Get restaurant error:', error);
      res.status(500).json({ error: 'Failed to get restaurant' });
    }
  },

  // PUT /api/restaurant/me  — update own restaurant
  updateMyRestaurant(req, res) {
    try {
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      const { name, address, description, phone, opening_hours, num_tables, seats_per_table, max_guests, image_url } = req.body;
      if (!name || !address) {
        return res.status(400).json({ error: 'Name and address are required' });
      }
      const updated = RestaurantModel.update(restaurant.id, {
        name, address, description, phone, opening_hours,
        num_tables: parseInt(num_tables, 10) || restaurant.num_tables,
        seats_per_table: parseInt(seats_per_table, 10) || restaurant.seats_per_table,
        max_guests: parseInt(max_guests, 10) || restaurant.max_guests,
        image_url
      });
      res.json(updated);
    } catch (error) {
      console.error('Update restaurant error:', error);
      res.status(500).json({ error: 'Failed to update restaurant' });
    }
  },

  // GET /api/restaurant/dashboard  — pending + upcoming + stats
  getDashboard(req, res) {
    try {
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }

      const pending = ReservationModel.getPendingByRestaurant(restaurant.id);
      const upcoming = ReservationModel.getUpcomingByRestaurant(restaurant.id);
      const completed = ReservationModel.getCompletedByRestaurant(restaurant.id);
      const cancelled = ReservationModel.getCancelledByRestaurant(restaurant.id);
      const stats = ReservationModel.getStatsByRestaurant(restaurant.id);

      res.json({ restaurant, pending, upcoming, completed, cancelled, stats });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  },

  // PUT /api/restaurant/reservations/:id/approve
  approveReservation(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

      const reservation = ReservationModel.getById(id);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
      if (reservation.restaurant_id !== restaurant.id) {
        return res.status(403).json({ error: 'Not your reservation' });
      }

      const { assigned_table } = req.body;
      const updated = ReservationModel.updateStatus(id, { status: 'confirmed', assigned_table: assigned_table || null });
      res.json({ message: 'Reservation approved', reservation: updated });
    } catch (error) {
      console.error('Approve error:', error);
      res.status(500).json({ error: 'Failed to approve reservation' });
    }
  },

  // PUT /api/restaurant/reservations/:id/decline
  declineReservation(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

      const reservation = ReservationModel.getById(id);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
      if (reservation.restaurant_id !== restaurant.id) {
        return res.status(403).json({ error: 'Not your reservation' });
      }

      const updated = ReservationModel.updateStatus(id, { status: 'cancelled', assigned_table: null });
      res.json({ message: 'Reservation declined', reservation: updated });
    } catch (error) {
      console.error('Decline error:', error);
      res.status(500).json({ error: 'Failed to decline reservation' });
    }
  },

  // PUT /api/restaurant/reservations/:id/status
  updateReservationStatus(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { status, assigned_table } = req.body;

      const allowed = ['pending', 'confirmed', 'arrived', 'no_show', 'cancelled'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

      const reservation = ReservationModel.getById(id);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
      if (reservation.restaurant_id !== restaurant.id) {
        return res.status(403).json({ error: 'Not your reservation' });
      }

      const updated = ReservationModel.updateStatus(id, { status, assigned_table: assigned_table || reservation.assigned_table });
      res.json({ message: 'Status updated', reservation: updated });
    } catch (error) {
      console.error('Status update error:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  },

  // PUT /api/restaurant/reservations/:id — modify time/date/table
  modifyReservation(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

      const reservation = ReservationModel.getById(id);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
      if (reservation.restaurant_id !== restaurant.id) {
        return res.status(403).json({ error: 'Not your reservation' });
      }

      const { date, time, num_people, assigned_table } = req.body;
      if (date && time && num_people) {
        ReservationModel.update(id, { date, time, num_people: parseInt(num_people, 10) });
      }
      if (assigned_table !== undefined) {
        const current = ReservationModel.getById(id);
        ReservationModel.updateStatus(id, { status: current.status, assigned_table });
      }

      const updated = ReservationModel.getById(id);
      res.json({ message: 'Reservation modified', reservation: updated });
    } catch (error) {
      console.error('Modify error:', error);
      res.status(500).json({ error: 'Failed to modify reservation' });
    }
  }
};

module.exports = RestaurantAdminController;
