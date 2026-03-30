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
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role || 'customer' }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  // POST /api/auth/login
  login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = UserModel.getByEmail(email);
      if (!user || !user.password_hash) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = generateToken(user);
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role || 'customer' }
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
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role || 'customer' }
      });
    } catch (error) {
      console.error('Google login error:', error);
      res.status(401).json({ error: 'Google authentication failed' });
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
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar_url: user.avatar_url, role: user.role || 'customer' }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  }
};

module.exports = AuthController;
