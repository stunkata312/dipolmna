require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const RestaurantController = require('./controllers/restaurantController');
const ReservationController = require('./controllers/reservationController');
const AuthController = require('./controllers/authController');
const UserController = require('./controllers/userController');
const RestaurantAdminController = require('./controllers/restaurantAdminController');
const ReviewController = require('./controllers/reviewController');
const UploadController = require('./controllers/uploadController');
const { requireAuth, optionalAuth, requireRestaurantOwner, requireRestaurantStaff } = require('./middleware/auth');

const app = express();
const PORT = 3001;

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// Serve uploaded images publicly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public restaurant routes
app.get('/api/restaurants', RestaurantController.getAll);
app.get('/api/restaurants/nearby', RestaurantController.getNearby);
app.get('/api/restaurants/:id', RestaurantController.getById);
app.get('/api/restaurants/:id/availability', RestaurantController.getAvailability);

// Reviews
app.get('/api/restaurants/:id/reviews', optionalAuth, ReviewController.list);
app.post('/api/restaurants/:id/reviews', requireAuth, ReviewController.create);
app.delete('/api/restaurants/:id/reviews/me', requireAuth, ReviewController.remove);

// Customer reservation routes
app.post('/api/reservations', ReservationController.create);
app.put('/api/reservations/:id', requireAuth, ReservationController.update);
app.delete('/api/reservations/:id', requireAuth, ReservationController.cancel);

// Image uploads — any authenticated user can upload (used by restaurant settings + profile)
app.post('/api/uploads/image', requireAuth, UploadController.middleware, UploadController.errorHandler, UploadController.handle);

// Auth routes
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/login', AuthController.login);
app.post('/api/auth/google', AuthController.googleLogin);
app.get('/api/auth/me', requireAuth, AuthController.me);
app.put('/api/auth/me', requireAuth, AuthController.updateMe);

// User routes
app.get('/api/user/reservations', requireAuth, UserController.getReservations);

// Restaurant owner routes
app.post('/api/restaurant/register', RestaurantAdminController.register);
// Settings page (PUT) stays owner-only; hostesses must not be able to mutate restaurant config.
app.get('/api/restaurant/me', requireRestaurantStaff, RestaurantAdminController.getMyRestaurant);
app.put('/api/restaurant/me', requireRestaurantOwner, RestaurantAdminController.updateMyRestaurant);
app.get('/api/restaurant/dashboard', requireRestaurantStaff, RestaurantAdminController.getDashboard);
app.put('/api/restaurant/reservations/:id/approve', requireRestaurantStaff, RestaurantAdminController.approveReservation);
app.put('/api/restaurant/reservations/:id/decline', requireRestaurantStaff, RestaurantAdminController.declineReservation);
app.put('/api/restaurant/reservations/:id/status', requireRestaurantStaff, RestaurantAdminController.updateReservationStatus);
app.post('/api/restaurant/reservations/clear-arrived', requireRestaurantStaff, RestaurantAdminController.clearArrivedToday);
app.post('/api/restaurant/walk-in', requireRestaurantStaff, RestaurantAdminController.walkIn);
app.put('/api/restaurant/reservations/:id', requireRestaurantStaff, RestaurantAdminController.modifyReservation);

// Staff management (Accounts Info tab in settings) — owner-only.
app.get('/api/restaurant/staff', requireRestaurantOwner, RestaurantAdminController.listStaff);
app.post('/api/restaurant/staff', requireRestaurantOwner, RestaurantAdminController.createStaff);
app.put('/api/restaurant/staff/:id', requireRestaurantOwner, RestaurantAdminController.updateStaff);
app.delete('/api/restaurant/staff/:id', requireRestaurantOwner, RestaurantAdminController.deleteStaff);

// Hostesses can read reviews on the dashboard but cannot moderate (reply, edit
// reply, delete reply, hide) — those are all owner-only actions.
app.get('/api/restaurant/reviews', requireRestaurantStaff, ReviewController.ownerList);
app.put('/api/restaurant/reviews/:reviewId/reply', requireRestaurantOwner, ReviewController.setReply);
app.delete('/api/restaurant/reviews/:reviewId/reply', requireRestaurantOwner, ReviewController.clearReply);
app.put('/api/restaurant/reviews/:reviewId/hidden', requireRestaurantOwner, ReviewController.setHidden);

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
