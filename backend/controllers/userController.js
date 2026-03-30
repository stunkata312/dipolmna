const ReservationModel = require('../models/reservationModel');

const UserController = {
  // GET /api/user/reservations
  getReservations(req, res) {
    try {
      const reservations = ReservationModel.getByUserEmail(req.user.email);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const active = [];
      const past = [];

      for (const r of reservations) {
        const rDate = new Date(r.date + 'T00:00:00');
        if (rDate >= today) {
          active.push(r);
        } else {
          past.push(r);
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
