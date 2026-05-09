require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const RestaurantController = require('./controllers/restaurantController');
const ReservationController = require('./controllers/reservationController');
const AuthController = require('./controllers/authController');
const UserController = require('./controllers/userController');
const RestaurantAdminController = require('./controllers/restaurantAdminController');
const ReviewController = require('./controllers/reviewController');
const { requireAuth, requireRestaurantOwner } = require('./middleware/auth');

const app = express();
const PORT = 3001;

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// Public restaurant routes
app.get('/api/restaurants', RestaurantController.getAll);
app.get('/api/restaurants/nearby', RestaurantController.getNearby);
app.get('/api/restaurants/:id', RestaurantController.getById);
app.get('/api/restaurants/:id/availability', RestaurantController.getAvailability);

// Reviews
app.get('/api/restaurants/:id/reviews', ReviewController.list);
app.post('/api/restaurants/:id/reviews', requireAuth, ReviewController.create);
app.delete('/api/restaurants/:id/reviews/me', requireAuth, ReviewController.remove);

// Customer reservation routes
app.post('/api/reservations', ReservationController.create);
app.put('/api/reservations/:id', requireAuth, ReservationController.update);
app.delete('/api/reservations/:id', requireAuth, ReservationController.cancel);

// Auth routes
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/login', AuthController.login);
app.post('/api/auth/google', AuthController.googleLogin);
app.get('/api/auth/me', requireAuth, AuthController.me);

// User routes
app.get('/api/user/reservations', requireAuth, UserController.getReservations);

// Restaurant owner routes
app.post('/api/restaurant/register', RestaurantAdminController.register);
app.get('/api/restaurant/me', requireRestaurantOwner, RestaurantAdminController.getMyRestaurant);
app.put('/api/restaurant/me', requireRestaurantOwner, RestaurantAdminController.updateMyRestaurant);
app.get('/api/restaurant/dashboard', requireRestaurantOwner, RestaurantAdminController.getDashboard);
app.put('/api/restaurant/reservations/:id/approve', requireRestaurantOwner, RestaurantAdminController.approveReservation);
app.put('/api/restaurant/reservations/:id/decline', requireRestaurantOwner, RestaurantAdminController.declineReservation);
app.put('/api/restaurant/reservations/:id/status', requireRestaurantOwner, RestaurantAdminController.updateReservationStatus);
app.post('/api/restaurant/reservations/clear-arrived', requireRestaurantOwner, RestaurantAdminController.clearArrivedToday);
app.put('/api/restaurant/reservations/:id', requireRestaurantOwner, RestaurantAdminController.modifyReservation);

// Reservation maintenance — runs on startup, then every 15 min as a safety net
// (the same sweeps also run on every dashboard / user-reservations fetch)
const ReservationModel = require('./models/reservationModel');

function reservationMaintenance() {
  const { completed, noShows } = ReservationModel.runMaintenance();
  if (completed > 0) console.log(`Auto-completed ${completed} stale arrived reservations`);
  if (noShows > 0) console.log(`Auto-marked ${noShows} reservations as no_show`);
  const deleted = ReservationModel.deleteExpiredCancelled();
  if (deleted > 0) console.log(`Cleaned up ${deleted} expired cancelled/no_show reservations`);
}

reservationMaintenance();
setInterval(reservationMaintenance, 15 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
