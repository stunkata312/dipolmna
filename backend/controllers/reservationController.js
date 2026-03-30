const ReservationModel = require('../models/reservationModel');
const RestaurantModel = require('../models/restaurantModel');
const UserModel = require('../models/userModel');

const ReservationController = {
  create(req, res) {
    try {
      const { name, email, phone, restaurant_id, date, time, num_people, notes } = req.body;

      // Validate required fields
      if (!name || !email || !restaurant_id || !date || !time || !num_people) {
        return res.status(400).json({ error: 'All fields are required (name, email, restaurant_id, date, time, num_people)' });
      }

      // Validate restaurant exists
      const restaurant = RestaurantModel.getById(restaurant_id);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }

      // Validate num_people is a positive integer
      const people = parseInt(num_people, 10);
      if (isNaN(people) || people <= 0) {
        return res.status(400).json({ error: 'Number of people must be a positive integer' });
      }

      // Validate date is not in the past
      const reservationDate = new Date(date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (reservationDate < today) {
        return res.status(400).json({ error: 'Reservation date cannot be in the past' });
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({ error: 'Time must be in HH:MM format (e.g., 19:30)' });
      }

      // Find or create user
      const user = UserModel.findOrCreate({ name, email, phone: phone || null });

      // Create reservation
      const reservation = ReservationModel.create({
        user_id: user.id,
        restaurant_id,
        name,
        email,
        phone: phone || null,
        date,
        time,
        num_people: people,
        notes: notes || null
      });

      res.status(201).json({
        message: 'Reservation created successfully',
        reservation
      });
    } catch (error) {
      console.error('Error creating reservation:', error);
      res.status(500).json({ error: 'Failed to create reservation' });
    }
  },

  // PUT /api/reservations/:id
  update(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid reservation ID' });
      }

      const reservation = ReservationModel.getById(id);
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      // Verify ownership
      if (reservation.email !== req.user.email) {
        return res.status(403).json({ error: 'You can only edit your own reservations' });
      }

      const { date, time, num_people } = req.body;

      if (!date || !time || !num_people) {
        return res.status(400).json({ error: 'Date, time, and number of people are required' });
      }

      const people = parseInt(num_people, 10);
      if (isNaN(people) || people <= 0) {
        return res.status(400).json({ error: 'Number of people must be a positive integer' });
      }

      const reservationDate = new Date(date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (reservationDate < today) {
        return res.status(400).json({ error: 'Reservation date cannot be in the past' });
      }

      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({ error: 'Time must be in HH:MM format (e.g., 19:30)' });
      }

      const updated = ReservationModel.update(id, { date, time, num_people: people });

      res.json({ message: 'Reservation updated successfully', reservation: updated });
    } catch (error) {
      console.error('Error updating reservation:', error);
      res.status(500).json({ error: 'Failed to update reservation' });
    }
  },

  // DELETE /api/reservations/:id
  cancel(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid reservation ID' });
      }

      const reservation = ReservationModel.getById(id);
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      // Verify ownership
      if (reservation.email !== req.user.email) {
        return res.status(403).json({ error: 'You can only cancel your own reservations' });
      }

      ReservationModel.updateStatus(id, { status: 'cancelled', assigned_table: null });

      res.json({ message: 'Reservation cancelled successfully' });
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      res.status(500).json({ error: 'Failed to cancel reservation' });
    }
  }
};

module.exports = ReservationController;
