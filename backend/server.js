require('dotenv').config();
const express = require('express');
const cors = require('cors');
const RestaurantController = require('./controllers/restaurantController');
const ReservationController = require('./controllers/reservationController');
const AuthController = require('./controllers/authController');
const UserController = require('./controllers/userController');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Restaurant routes
app.get('/api/restaurants', RestaurantController.getAll);
app.get('/api/restaurants/:id', RestaurantController.getById);

// Reservation routes
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
