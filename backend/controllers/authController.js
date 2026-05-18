const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const UserModel = require('../models/userModel');
const { generateToken } = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const AuthController = {
  // POST /api/auth/register
  register(req, res) {
    try {
      const { name, email, password, phone } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const existing = UserModel.getByEmail(email);
      if (existing && existing.password_hash) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      const password_hash = bcrypt.hashSync(password, 10);

      let user;
      if (existing) {
        // User exists from a previous reservation — upgrade to full account
        UserModel.updatePasswordHash(existing.id, password_hash);
        if (name) {
          UserModel.updateProfile(existing.id, { name, phone: phone || existing.phone, avatar_url: existing.avatar_url });
        }
        user = UserModel.getById(existing.id);
      } else {
        user = UserModel.create({ name, email, phone, password_hash });
      }

      const token = generateToken(user);
      res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role || 'customer', restaurant_id: user.restaurant_id ?? null }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  // POST /api/auth/login
  login(req, res) {
    try {
      const { email, identifier, password } = req.body;
      const rawId = (identifier ?? email ?? '').trim();

      if (!rawId || !password) {
        return res.status(400).json({ error: 'Email/phone and password are required' });
      }

      // Treat anything with an @ as an email; otherwise strip non-digits and look up by phone.
      let user;
      if (rawId.includes('@')) {
        user = UserModel.getByEmail(rawId);
      } else {
        const digits = rawId.replace(/\D/g, '');
        user = digits ? UserModel.getByPhone(digits) : null;
      }
      if (!user || !user.password_hash) {
        return res.status(401).json({ error: 'Invalid email/phone or password' });
      }

      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email/phone or password' });
      }

      const token = generateToken(user);
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role || 'customer', restaurant_id: user.restaurant_id ?? null }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  },

  // POST /api/auth/google
  async googleLogin(req, res) {
    try {
      const { credential } = req.body;

      if (!credential) {
        return res.status(400).json({ error: 'Google credential is required' });
      }

      // Verify the Google ID token
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture } = payload;

      // Find user by google_id or email
      let user = UserModel.getByGoogleId(googleId);

      if (!user) {
        user = UserModel.getByEmail(email);
        if (user) {
          // Link Google account to existing user
          UserModel.updateGoogleId(user.id, googleId, picture);
          user = UserModel.getById(user.id);
        } else {
          // Create new user
          user = UserModel.create({
            name,
            email,
            google_id: googleId,
            avatar_url: picture
          });
        }
      }

      const token = generateToken(user);
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role || 'customer', restaurant_id: user.restaurant_id ?? null }
      });
    } catch (error) {
      console.error('Google login error:', error);
      res.status(401).json({ error: 'Google authentication failed' });
    }
  },

  // PUT /api/auth/me  — customer self-service edits.
  // Owners + hostesses are managed through the restaurant settings instead.
  updateMe(req, res) {
    try {
      const me = UserModel.getById(req.user.id);
      if (!me) return res.status(404).json({ error: 'User not found' });
      if (me.role !== 'customer') {
        return res.status(403).json({ error: 'Restaurant staff manage their account from the restaurant settings.' });
      }

      const name = (req.body.name ?? me.name).trim();
      const email = (req.body.email ?? me.email).trim().toLowerCase();
      const phone = (req.body.phone ?? me.phone ?? '').trim() || null;

      if (!name) return res.status(400).json({ error: 'Name is required' });
      if (!/^[A-Za-z\s]+$/.test(name)) return res.status(400).json({ error: 'Name must contain letters only' });
      if (!email) return res.status(400).json({ error: 'Email is required' });
      if (phone && !/^\d+$/.test(phone)) return res.status(400).json({ error: 'Phone must contain digits only' });

      // Email collision check (case-insensitive — getByEmail already collates NOCASE).
      if (email !== me.email.toLowerCase()) {
        const taken = UserModel.getByEmail(email);
        if (taken && taken.id !== me.id) {
          return res.status(409).json({ error: 'Email already in use' });
        }
      }

      // Phone collision check — block if another account already has the same digits.
      // Skip when the new phone is null (clearing your own phone is fine).
      if (phone) {
        const all = require('../models/database').prepare(
          "SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != '' AND id != ?"
        ).all(me.id);
        const conflict = all.find(u => u.phone.replace(/\D/g, '') === phone);
        if (conflict) return res.status(409).json({ error: 'Phone already in use by another account' });
      }

      // Password change: only when a new password is supplied. In that case the
      // user must prove they know the current one to prevent session-hijack
      // password resets.
      let newHash = null;
      const newPassword = req.body.new_password;
      const currentPassword = req.body.current_password;
      if (newPassword) {
        if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
        if (!me.password_hash) {
          // Account had no password (e.g. Google-only). Allow setting one
          // without a current-password check, since there isn't one.
        } else {
          if (!currentPassword) return res.status(400).json({ error: 'Current password is required to change password' });
          const ok = bcrypt.compareSync(currentPassword, me.password_hash);
          if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
        }
        newHash = bcrypt.hashSync(newPassword, 10);
      }

      UserModel.updateAccount(me.id, { name, email, phone });
      if (newHash) UserModel.updatePasswordHash(me.id, newHash);

      const fresh = UserModel.getById(me.id);
      res.json({
        user: {
          id: fresh.id,
          name: fresh.name,
          email: fresh.email,
          phone: fresh.phone,
          avatar_url: fresh.avatar_url,
          role: fresh.role || 'customer',
          restaurant_id: fresh.restaurant_id ?? null,
        },
      });
    } catch (error) {
      console.error('Update me error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  },

  // GET /api/auth/me
  me(req, res) {
    try {
      const user = UserModel.getById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role || 'customer', restaurant_id: user.restaurant_id ?? null }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  }
};

module.exports = AuthController;
