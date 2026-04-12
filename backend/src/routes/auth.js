const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { getDb } = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Google Sign-In client. Configured lazily on first use so the server
// still boots (and the password-based routes still work) when the
// GOOGLE_CLIENT_ID environment variable is not set — we just refuse the
// Google endpoint with a clear 503 in that case. See /api/auth/google.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
let googleClient = null;
function getGoogleClient() {
  if (!GOOGLE_CLIENT_ID) return null;
  if (!googleClient) googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  return googleClient;
}

// Generates a throwaway password hash for social-login accounts. The
// users.password column is NOT NULL, but a Google user should never be
// able to sign in with a password. Hashing cryptographically random bytes
// produces a value that no legitimate login attempt can ever match.
function randomPasswordHash() {
  const randomSecret = crypto.randomBytes(32).toString('hex');
  return bcrypt.hashSync(randomSecret, 10);
}

// Strips `password` from a user row before returning it over the wire.
function sanitizeUser(user) {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
}

// POST /register
router.post('/register', (req, res) => {
  try {
    const { name, email, password, phone, nationality, language } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const db = getDb();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, phone, nationality, language)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email, hashedPassword, phone || null, nationality || null, language || 'en');

    const user = db.prepare('SELECT id, email, name, phone, nationality, role, language, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful.',
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /google - Google Sign-In (ID-token exchange).
//
// The frontend uses Google Identity Services to render the Google button,
// which returns a short-lived JWT ID token on successful sign-in. The
// frontend POSTs that token here as `{ credential }`; the backend verifies
// the token against Google's public keys, resolves or creates the matching
// local user, and returns our own JWT so the rest of the app keeps using
// the same auth flow (Authorization: Bearer …) as the password-login path.
//
// Account linking rule: if a user already exists with the Google-provided
// email (e.g. they registered via password first), we attach the Google
// subject id to that existing row instead of creating a duplicate — the
// email is the stable identity.
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ error: 'credential (Google ID token) is required.' });
    }

    const client = getGoogleClient();
    if (!client) {
      // Surfacing this as 503 (rather than 500) makes it obvious to
      // operators that the feature is turned off at the config layer,
      // not a runtime bug.
      return res.status(503).json({
        error: 'Google Sign-In is not configured on this server. Set GOOGLE_CLIENT_ID.'
      });
    }

    // Verify the ID token against Google's JWKs. `verifyIdToken` throws
    // on expired / wrong-audience / bad-signature tokens — those become
    // 401 responses.
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error('Google ID token verification failed:', verifyErr.message);
      return res.status(401).json({ error: 'Invalid Google credential.' });
    }

    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({ error: 'Google credential did not include an email.' });
    }

    // Google marks unverified emails (e.g. some Workspace edge cases).
    // We refuse those — an unverified email could be spoofed and would
    // defeat the point of "same email = same account" linking.
    if (payload.email_verified === false) {
      return res.status(401).json({ error: 'Google account email is not verified.' });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const displayName = payload.name || payload.given_name || email.split('@')[0];
    const avatarUrl = payload.picture || null;

    const db = getDb();

    // Try the cheap path first: an existing social login for this Google
    // subject id. Then fall back to matching by email (linking path).
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
    if (!user) {
      const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (byEmail) {
        // Link the existing password account to this Google identity.
        // We also refresh name/avatar so the profile reflects the most
        // recent Google-provided values.
        db.prepare(`
          UPDATE users
             SET google_id = ?,
                 avatar_url = COALESCE(?, avatar_url),
                 updated_at = datetime('now')
           WHERE id = ?
        `).run(googleId, avatarUrl, byEmail.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id);
      }
    }

    if (!user) {
      // New user: create a customer row with a random bcrypt hash so the
      // NOT NULL password column is satisfied without exposing a usable
      // credential. Language defaults to 'en'; the client can PUT it on
      // /auth/me after login if the user prefers Chinese.
      const insert = db.prepare(`
        INSERT INTO users (email, password, name, nationality, role, language, google_id, avatar_url)
        VALUES (?, ?, ?, ?, 'customer', 'en', ?, ?)
      `).run(
        email,
        randomPasswordHash(),
        displayName,
        null,
        googleId,
        avatarUrl
      );
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(insert.lastInsertRowid);
    }

    // Issue our own session token. Mirrors the shape used by /login so
    // the frontend AuthContext does not need to special-case Google.
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('Google sign-in error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PUT /me
router.put('/me', authenticate, (req, res) => {
  try {
    const { name, phone, nationality, language } = req.body;
    const db = getDb();

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (nationality !== undefined) { updates.push('nationality = ?'); values.push(nationality); }
    if (language !== undefined) { updates.push('language = ?'); values.push(language); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare('SELECT id, email, name, phone, nationality, role, language, created_at, updated_at FROM users WHERE id = ?').get(req.user.id);

    res.json({ message: 'Profile updated.', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
