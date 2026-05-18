const bcrypt = require('bcryptjs');
const RestaurantModel = require('../models/restaurantModel');
const ReservationModel = require('../models/reservationModel');
const UserModel = require('../models/userModel');
const { generateToken } = require('../middleware/auth');
const { geocodeAddress } = require('../middleware/geocode');
const { getStaffRestaurant } = require('./staffHelper');

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
              additional_owners, hostesses,
              restaurant_name, address, description,
              restaurant_phone, opening_hours, open_hours_json,
              menu_json, currency, no_show_buffer_minutes,
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

      // Validate any extra staff accounts up-front so we don't half-create the world.
      const extraOwners = Array.isArray(additional_owners) ? additional_owners : [];
      const extraHostesses = Array.isArray(hostesses) ? hostesses : [];
      const seenEmails = new Set([email.toLowerCase()]);
      const staffAccounts = [];
      for (const [role, list] of [['restaurant', extraOwners], ['hostess', extraHostesses]]) {
        for (const acc of list) {
          if (!acc || typeof acc !== 'object') continue;
          const aName = (acc.name || '').trim();
          const aEmail = (acc.email || '').trim().toLowerCase();
          const aPassword = acc.password || '';
          const aPhone = (acc.phone || '').trim() || null;
          if (!aName || !aEmail || !aPassword) {
            return res.status(400).json({ error: `${role === 'restaurant' ? 'Owner' : 'Hostess'} accounts need name, email, and password` });
          }
          if (aPassword.length < 6) {
            return res.status(400).json({ error: 'Each password must be at least 6 characters' });
          }
          if (seenEmails.has(aEmail)) {
            return res.status(409).json({ error: `Duplicate email in form: ${aEmail}` });
          }
          seenEmails.add(aEmail);
          const taken = UserModel.getByEmail(aEmail);
          if (taken && taken.password_hash) {
            return res.status(409).json({ error: `Email already in use: ${aEmail}` });
          }
          staffAccounts.push({ role, name: aName, email: aEmail, password: aPassword, phone: aPhone, existing: taken });
        }
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
        open_hours_json: typeof open_hours_json === 'string' ? open_hours_json : JSON.stringify(open_hours_json || {}),
        menu_json: typeof menu_json === 'string' ? menu_json : JSON.stringify(menu_json || []),
        currency: currency || 'EUR',
        no_show_buffer_minutes: Number.isFinite(parseInt(no_show_buffer_minutes, 10))
          ? Math.max(0, parseInt(no_show_buffer_minutes, 10))
          : 15,
        latitude,
        longitude
      });

      // Link primary owner to the restaurant so the JWT can carry restaurant_id
      // identically for every staff account.
      UserModel.setRestaurantId(user.id, restaurant.id);

      // Create the additional owner + hostess accounts and link them to the restaurant.
      for (const acc of staffAccounts) {
        const hash = bcrypt.hashSync(acc.password, 10);
        let staffUser;
        if (acc.existing) {
          UserModel.updatePasswordHash(acc.existing.id, hash);
          UserModel.updateProfile(acc.existing.id, {
            name: acc.name,
            phone: acc.phone || acc.existing.phone,
            avatar_url: acc.existing.avatar_url,
          });
          staffUser = acc.existing;
        } else {
          staffUser = UserModel.create({ name: acc.name, email: acc.email, phone: acc.phone, password_hash: hash });
        }
        UserModel.setRole(staffUser.id, acc.role);
        UserModel.setRestaurantId(staffUser.id, restaurant.id);
      }

      user = UserModel.getById(user.id);
      const token = generateToken(user);
      res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role, restaurant_id: user.restaurant_id ?? null },
        restaurant
      });
    } catch (error) {
      console.error('Restaurant registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  // GET /api/restaurant/staff  — list staff accounts for the restaurant
  listStaff(req, res) {
    try {
      const restaurant = getStaffRestaurant(req.user);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
      const staff = UserModel.listByRestaurant(restaurant.id).map(u => ({
        ...u,
        is_primary_owner: u.id === restaurant.owner_id,
      }));
      res.json({ staff });
    } catch (error) {
      console.error('List staff error:', error);
      res.status(500).json({ error: 'Failed to load staff' });
    }
  },

  // POST /api/restaurant/staff  — create a new owner or hostess account
  createStaff(req, res) {
    try {
      const restaurant = getStaffRestaurant(req.user);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

      const name = (req.body.name || '').trim();
      const email = (req.body.email || '').trim().toLowerCase();
      const password = req.body.password || '';
      const phone = (req.body.phone || '').trim() || null;
      const role = req.body.role;

      if (role !== 'restaurant' && role !== 'hostess') {
        return res.status(400).json({ error: 'Role must be restaurant or hostess' });
      }
      if (!name) return res.status(400).json({ error: 'Name is required' });
      if (!/^[A-Za-z\s]+$/.test(name)) return res.status(400).json({ error: 'Name must contain letters only' });
      if (!email) return res.status(400).json({ error: 'Email is required' });
      if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      if (phone && !/^\d+$/.test(phone)) return res.status(400).json({ error: 'Phone must contain digits only' });

      const existing = UserModel.getByEmail(email);
      if (existing && existing.password_hash) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      const password_hash = bcrypt.hashSync(password, 10);
      let staffUser;
      if (existing) {
        UserModel.updatePasswordHash(existing.id, password_hash);
        UserModel.updateProfile(existing.id, { name, phone, avatar_url: existing.avatar_url });
        staffUser = existing;
      } else {
        staffUser = UserModel.create({ name, email, phone, password_hash });
      }
      UserModel.setRole(staffUser.id, role);
      UserModel.setRestaurantId(staffUser.id, restaurant.id);

      const created = UserModel.getById(staffUser.id);
      res.status(201).json({
        account: {
          id: created.id,
          name: created.name,
          email: created.email,
          phone: created.phone,
          role: created.role,
          restaurant_id: created.restaurant_id,
          is_primary_owner: false,
        },
      });
    } catch (error) {
      console.error('Create staff error:', error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  },

  // DELETE /api/restaurant/staff/:id  — primary owner only; cannot remove primary owner
  deleteStaff(req, res) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (!Number.isFinite(userId)) return res.status(400).json({ error: 'Invalid account id' });

      const restaurant = getStaffRestaurant(req.user);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
      if (req.user.id !== restaurant.owner_id) {
        return res.status(403).json({ error: 'Only the primary owner can remove accounts' });
      }

      const target = UserModel.getById(userId);
      if (!target || target.restaurant_id !== restaurant.id) {
        return res.status(404).json({ error: 'Account not found' });
      }
      if (target.id === restaurant.owner_id) {
        return res.status(400).json({ error: 'The primary owner cannot be removed' });
      }

      UserModel.deleteAccount(target.id);
      res.json({ message: 'Account removed', id: target.id });
    } catch (error) {
      console.error('Delete staff error:', error);
      res.status(500).json({ error: 'Failed to remove account' });
    }
  },

  // PUT /api/restaurant/staff/:id  — update name/email/phone for a staff account
  updateStaff(req, res) {
    try {
      const userId = parseInt(req.params.id, 10);
      if (!Number.isFinite(userId)) return res.status(400).json({ error: 'Invalid account id' });

      const restaurant = getStaffRestaurant(req.user);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

      const target = UserModel.getById(userId);
      if (!target || target.restaurant_id !== restaurant.id) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const name = (req.body.name || '').trim();
      const email = (req.body.email || '').trim().toLowerCase();
      const phone = (req.body.phone || '').trim() || null;

      if (!name) return res.status(400).json({ error: 'Name is required' });
      if (!/^[A-Za-z\s]+$/.test(name)) return res.status(400).json({ error: 'Name must contain letters only' });
      if (!email) return res.status(400).json({ error: 'Email is required' });
      if (phone && !/^\d+$/.test(phone)) return res.status(400).json({ error: 'Phone must contain digits only' });

      if (email !== target.email.toLowerCase()) {
        const taken = UserModel.getByEmail(email);
        if (taken && taken.id !== target.id) {
          return res.status(409).json({ error: 'Email already in use' });
        }
      }

      UserModel.updateAccount(target.id, { name, email, phone });
      const updated = UserModel.getById(target.id);
      res.json({
        account: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          role: updated.role,
          restaurant_id: updated.restaurant_id,
          is_primary_owner: updated.id === restaurant.owner_id,
        },
      });
    } catch (error) {
      console.error('Update staff error:', error);
      res.status(500).json({ error: 'Failed to update account' });
    }
  },

  // GET /api/restaurant/me  — get own restaurant info
  getMyRestaurant(req, res) {
    try {
      const restaurant = getStaffRestaurant(req.user);
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
      const restaurant = getStaffRestaurant(req.user);
      if (!restaurant) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      const { name, address, description, phone, opening_hours, open_hours_json, menu_json, currency, no_show_buffer_minutes, num_tables, seats_per_table, max_guests, image_url,
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
        open_hours_json: open_hours_json !== undefined
          ? (typeof open_hours_json === 'string' ? open_hours_json : JSON.stringify(open_hours_json))
          : restaurant.open_hours_json,
        menu_json: menu_json !== undefined
          ? (typeof menu_json === 'string' ? menu_json : JSON.stringify(menu_json))
          : restaurant.menu_json,
        currency: currency !== undefined ? currency : restaurant.currency,
        no_show_buffer_minutes: no_show_buffer_minutes !== undefined && no_show_buffer_minutes !== null && no_show_buffer_minutes !== ''
          ? Math.max(0, parseInt(no_show_buffer_minutes, 10) || 0)
          : restaurant.no_show_buffer_minutes,
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
      const restaurant = getStaffRestaurant(req.user);
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
      const restaurant = getStaffRestaurant(req.user);
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
      const restaurant = getStaffRestaurant(req.user);
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

      const restaurant = getStaffRestaurant(req.user);
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

  // POST /api/restaurant/walk-in — log a guest who arrived without a website
  // booking. Inserts a reservation pre-marked 'arrived' for today / current
  // time, attached to the staff member's user_id so it shows up in stats.
  walkIn(req, res) {
    try {
      const restaurant = getStaffRestaurant(req.user);
      if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

      const num_people = parseInt(req.body.num_people, 10);
      const assigned_table = parseInt(req.body.assigned_table, 10);
      const name = ((req.body.name || '').trim()) || 'Walk-in';

      if (!Number.isFinite(num_people) || num_people <= 0) {
        return res.status(400).json({ error: 'Party size is required' });
      }
      if (!Number.isFinite(assigned_table) || assigned_table <= 0) {
        return res.status(400).json({ error: 'Table is required' });
      }

      let tables = [];
      try { tables = JSON.parse(restaurant.tables || '[]'); } catch {}
      const tableConfig = tables.find(t => t.id === assigned_table);
      if (!tableConfig) return res.status(400).json({ error: 'Unknown table' });
      if (tableConfig.seats < num_people) {
        return res.status(400).json({ error: `Table ${assigned_table} only seats ${tableConfig.seats}` });
      }

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

      // Reject if the table already has a guest seated right now.
      const db = require('../models/database');
      const conflict = db.prepare(`
        SELECT id FROM reservations
        WHERE restaurant_id = ? AND assigned_table = ? AND date = ? AND status = 'arrived'
      `).get(restaurant.id, assigned_table, today);
      if (conflict) {
        return res.status(409).json({ error: 'That table is currently occupied' });
      }

      const result = db.prepare(`
        INSERT INTO reservations
          (user_id, restaurant_id, name, email, phone, date, time, num_people, status, assigned_table)
        VALUES (?, ?, ?, '', NULL, ?, ?, ?, 'arrived', ?)
      `).run(req.user.id, restaurant.id, name, today, time, num_people, assigned_table);

      res.status(201).json({ message: 'Walk-in seated', id: result.lastInsertRowid });
    } catch (error) {
      console.error('Walk-in error:', error);
      res.status(500).json({ error: 'Failed to seat walk-in' });
    }
  },

  // POST /api/restaurant/reservations/clear-arrived — flip today's arrived rows to completed
  clearArrivedToday(req, res) {
    try {
      const restaurant = getStaffRestaurant(req.user);
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
      const restaurant = getStaffRestaurant(req.user);
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
