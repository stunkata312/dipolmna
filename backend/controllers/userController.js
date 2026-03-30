const ReservationModel = require('../models/reservationModel');

const UserController = {
  // GET /api/user/reservations
  getReservations(req, res) {
    try {
      const reservations = ReservationModel.getByUserEmail(req.user.email);

      const now = new Date();
      const BUFFER_MINUTES = 5;

      const active = [];
      const past = [];

      for (const r of reservations) {
        const reservationDateTime = new Date(r.date + 'T' + r.time + ':00');
        const completedAt = new Date(reservationDateTime.getTime() + BUFFER_MINUTES * 60 * 1000);
        if (now >= completedAt) {
          past.push(r);
        } else {
          active.push(r);
        }
      }

      // Sort active ascending (nearest first), past descending (most recent first)
      active.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      res.json({ active, past });
    } catch (error) {
      console.error('Error fetching user reservations:', error);
      res.status(500).json({ error: 'Failed to fetch reservations' });
    }
  }
};

module.exports = UserController;
