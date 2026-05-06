require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const RestaurantController = require('./controllers/restaurantController');
const ReservationController = require('./controllers/reservationController');
const AuthController = require('./controllers/authController');
const UserController = require('./controllers/userController');
const RestaurantAdminController = require('./controllers/restaurantAdminController');
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

// Clean up expired cancelled reservations (older than 15 days)
const ReservationModel = require('./models/reservationModel');
const deleted = ReservationModel.deleteExpiredCancelled();
if (deleted > 0) console.log(`Cleaned up ${deleted} expired cancelled reservations`);

// Run cleanup daily
setInterval(() => {
  const d = ReservationModel.deleteExpiredCancelled();
  if (d > 0) console.log(`Cleaned up ${d} expired cancelled reservations`);
}, 24 * 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
