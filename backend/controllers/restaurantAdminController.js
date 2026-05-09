const bcrypt = require('bcryptjs');
const RestaurantModel = require('../models/restaurantModel');
const ReservationModel = require('../models/reservationModel');
const UserModel = require('../models/userModel');
const { generateToken } = require('../middleware/auth');
const { geocodeAddress } = require('../middleware/geocode');

// Accept either a JSON-string array or an actual array; return a clean array of non-empty strings
function parseImageList(raw) {
  if (Array.isArray(raw)) return raw.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim());
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()) : [];
    } catch { return []; }
  }
  return [];
}

// Normalize a tables config: array of { id: int>0, seats: int>0 }, unique ids
function parseTablesConfig(raw) {
  let arr;
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  } else { return []; }
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    if (!t || typeof t !== 'object') continue;
    const id = parseInt(t.id, 10);
    const seats = parseInt(t.seats, 10);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!Number.isFinite(seats) || seats <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, seats });
  }
  return out;
}

const RestaurantAdminController = {
  // POST /api/restaurant/register
  async register(req, res) {
    try {
      const { name, email, password, phone: ownerPhone,
              restaurant_name, address, description,
              restaurant_phone, opening_hours,
              num_tables, seats_per_table, max_guests, image_url,
              reservation_start_time, reservation_end_time, closed_days, special_closures,
              cover_images, gallery_images, tables,
              latitude: clientLat, longitude: clientLng } = req.body;

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

      // Prefer coordinates picked by the owner on the map; fall back to geocoding the address.
      let latitude = Number.isFinite(clientLat) ? clientLat : null;
      let longitude = Number.isFinite(clientLng) ? clientLng : null;
      if (latitude == null || longitude == null) {
        const coords = await geocodeAddress(address);
        latitude = coords?.lat ?? null;
        longitude = coords?.lng ?? null;
      }

      // Sync image_url with cover_images[0] for back-compat with cards/lists
      const coverArr = parseImageList(cover_images);
      const galleryArr = parseImageList(gallery_images);
      const primaryImage = coverArr[0] || image_url || null;

      // Tables drive num_tables/seats_per_table/max_guests when provided
      const tablesArr = parseTablesConfig(tables);
      const derivedNumTables = tablesArr.length > 0 ? tablesArr.length : (num_tables ? parseInt(num_tables, 10) : 10);
      const derivedSeats = tablesArr.length > 0
        ? Math.round(tablesArr.reduce((s, t) => s + t.seats, 0) / tablesArr.length)
        : (seats_per_table ? parseInt(seats_per_table, 10) : 4);
      const derivedMaxGuests = tablesArr.length > 0
        ? tablesArr.reduce((s, t) => s + t.seats, 0)
        : (max_guests ? parseInt(max_guests, 10) : 40);

      // Create restaurant record
      const restaurant = RestaurantModel.create({
        owner_id: user.id,
        name: restaurant_name,
        address,
        description: description || null,
        phone: restaurant_phone || null,
        opening_hours: opening_hours || null,
        num_tables: derivedNumTables,
        seats_per_table: derivedSeats,
        max_guests: derivedMaxGuests,
        image_url: primaryImage,
        reservation_start_time: reservation_start_time || '10:00',
        reservation_end_time: reservation_end_time || '23:00',
        closed_days: closed_days || '[]',
        special_closures: special_closures || '[]',
        cover_images: JSON.stringify(coverArr),
        gallery_images: JSON.stringify(galleryArr),
        tables: JSON.stringify(tablesArr),
        latitude,
        longitude
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
  async updateMyRestaurant(req, res) {
    try {
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      const { name, address, description, phone, opening_hours, num_tables, seats_per_table, max_guests, image_url,
              reservation_start_time, reservation_end_time, closed_days, special_closures,
              cover_images, gallery_images, tables,
              latitude: clientLat, longitude: clientLng } = req.body;
      if (!name || !address) {
        return res.status(400).json({ error: 'Name and address are required' });
      }

      // Prefer client-picked coordinates. Otherwise: keep current pin if address didn't change,
      // or re-geocode when the address changed and no manual pin was provided.
      let latitude;
      let longitude;
      if (Number.isFinite(clientLat) && Number.isFinite(clientLng)) {
        latitude = clientLat;
        longitude = clientLng;
      } else if (address !== restaurant.address || restaurant.latitude == null || restaurant.longitude == null) {
        const coords = await geocodeAddress(address);
        latitude = coords?.lat ?? null;
        longitude = coords?.lng ?? null;
      } else {
        latitude = restaurant.latitude;
        longitude = restaurant.longitude;
      }

      // Normalize image lists. Sync image_url with cover_images[0] when provided so cards stay in sync.
      const coverArr = cover_images !== undefined ? parseImageList(cover_images) : null;
      const galleryArr = gallery_images !== undefined ? parseImageList(gallery_images) : null;
      const nextImageUrl = coverArr ? (coverArr[0] || null) : (image_url !== undefined ? image_url : restaurant.image_url);

      // Tables drive num_tables / seats_per_table / max_guests when provided
      const tablesArr = tables !== undefined ? parseTablesConfig(tables) : null;
      const nextNumTables = tablesArr ? tablesArr.length : (parseInt(num_tables, 10) || restaurant.num_tables);
      const nextSeatsPer = tablesArr && tablesArr.length > 0
        ? Math.round(tablesArr.reduce((s, t) => s + t.seats, 0) / tablesArr.length)
        : (parseInt(seats_per_table, 10) || restaurant.seats_per_table);
      const nextMaxGuests = tablesArr
        ? tablesArr.reduce((s, t) => s + t.seats, 0)
        : (parseInt(max_guests, 10) || restaurant.max_guests);

      const updated = RestaurantModel.update(restaurant.id, {
        name, address, description, phone, opening_hours,
        num_tables: nextNumTables,
        seats_per_table: nextSeatsPer,
        max_guests: nextMaxGuests,
        image_url: nextImageUrl,
        reservation_start_time: reservation_start_time || restaurant.reservation_start_time,
        reservation_end_time: reservation_end_time || restaurant.reservation_end_time,
        closed_days: closed_days !== undefined ? closed_days : restaurant.closed_days,
        special_closures: special_closures !== undefined ? special_closures : restaurant.special_closures,
        cover_images: coverArr ? JSON.stringify(coverArr) : restaurant.cover_images,
        gallery_images: galleryArr ? JSON.stringify(galleryArr) : restaurant.gallery_images,
        tables: tablesArr ? JSON.stringify(tablesArr) : restaurant.tables,
        latitude, longitude
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

      // Sweep stale state before reading: arrived→completed, overdue confirmed→no_show
      ReservationModel.runMaintenance();

      const pending = ReservationModel.getPendingByRestaurant(restaurant.id);
      const upcoming = ReservationModel.getUpcomingByRestaurant(restaurant.id);
      const completed = ReservationModel.getCompletedByRestaurant(restaurant.id);
      const cancelled = ReservationModel.getCancelledByRestaurant(restaurant.id);
      const stats = ReservationModel.getStatsByRestaurant(restaurant.id);

      // Attach previous-no-show count per reservation. "Previous" excludes the row itself
      // so a no_show row showing in the Cancelled tab doesn't count itself.
      const noShowMap = ReservationModel.getNoShowCountsByEmail(restaurant.id);
      const withNoShowCount = (rows) => rows.map(r => ({
        ...r,
        previous_no_shows: Math.max(0, (noShowMap.get(r.email) || 0) - (r.status === 'no_show' ? 1 : 0)),
      }));

      res.json({
        restaurant,
        pending: withNoShowCount(pending),
        upcoming: withNoShowCount(upcoming),
        completed: withNoShowCount(completed),
        cancelled: withNoShowCount(cancelled),
        stats,
      });
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

      const allowed = ['pending', 'confirmed', 'arrived', 'completed', 'no_show', 'cancelled'];
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

  // POST /api/restaurant/reservations/clear-arrived — flip today's arrived rows to completed
  clearArrivedToday(req, res) {
    try {
      const restaurant = RestaurantModel.getByOwnerId(req.user.id);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

      const cleared = ReservationModel.clearArrivedToday(restaurant.id);
      res.json({ message: 'Arrivals cleared', cleared });
    } catch (error) {
      console.error('Clear arrived error:', error);
      res.status(500).json({ error: 'Failed to clear arrivals' });
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
