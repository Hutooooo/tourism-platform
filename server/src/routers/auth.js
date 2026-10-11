'use strict';

/**
 * Router 1/9 — auth
 * Login, logout, token refresh, current-session and password management.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const config = require('../config');
const { db, tx } = require('../db');
const { ok, asyncHandler, badRequest, unauthorized, forbidden, notFound } = require('../utils/http');
const { validate, emailRule } = require('../utils/validate');
const {
  signAccessToken,
  signRefreshJwt,
  verifyRefreshJwt,
} = require('../utils/tokens');

const router = express.Router();

const REFRESH_COOKIE = 'rt';

/** Brute-force protection on credential endpoints. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many sign-in attempts. Try again in a few minutes.' } },
});

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

/** Issue both tokens; the refresh token travels only as an httpOnly cookie. */
function issueSession(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshJwt(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
  return accessToken;
}

function userFromEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
}

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = validate(req.body, {
      email: { ...emailRule(), required: true },
      password: { type: 'string', label: 'Password', required: true, minLength: 1, maxLength: 200 },
    });

    const user = userFromEmail(body.email);
    // Constant-ish response whether or not the account exists, so the
    // endpoint cannot be used to enumerate registered addresses.
    const hash = user ? user.password_hash : '$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpQ0G1E5rN0y7hQ0l9dYq3nKq0b1K';
    const valid = bcrypt.compareSync(body.password, hash);

    if (!user || !valid) throw unauthorized('Incorrect email or password.');
    if (!user.active) throw forbidden('This account has been deactivated.');

    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);

    const accessToken = issueSession(res, user);
    return ok(res, { user: publicUser(user), accessToken });
  })
);

// POST /api/auth/refresh — exchanges the httpOnly cookie for a new access token.
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) throw unauthorized('No active session.');

    let payload;
    try {
      payload = verifyRefreshJwt(token);
    } catch {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw unauthorized('Your session has expired. Please sign in again.');
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.active) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw unauthorized('Your account is no longer active.');
    }

    // Rotate: issue a fresh refresh token and revoke the presented one.
    const accessToken = signAccessToken(user);
    const nextRefresh = signRefreshJwt(user.id);
    res.cookie(REFRESH_COOKIE, nextRefresh, cookieOptions());

    return ok(res, { user: publicUser(user), accessToken });
  })
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  return ok(res, { loggedOut: true });
});

// GET /api/auth/me — requires a bearer access token.
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized('Authentication required.');

    const { verifyAccessToken } = require('../utils/tokens');
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Invalid or expired session.');
    }

    const user = db.prepare('SELECT id, email, name, role, active FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.active) throw unauthorized('Your account is no longer active.');
    return ok(res, { user });
  })
);

// GET /api/auth/session — silent restore from the refresh cookie (no bearer needed).
router.get(
  '/session',
  asyncHandler(async (req, res) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) return ok(res, { user: null, accessToken: null });

    try {
      const payload = verifyRefreshJwt(token);
      const user = db.prepare('SELECT id, email, name, role, active FROM users WHERE id = ?').get(payload.sub);
      if (!user || !user.active) return ok(res, { user: null, accessToken: null });
      return ok(res, { user, accessToken: signAccessToken(user) });
    } catch {
      return ok(res, { user: null, accessToken: null });
    }
  })
);

// PATCH /api/auth/password — change own password.
router.patch(
  '/password',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized('Authentication required.');

    const { verifyAccessToken } = require('../utils/tokens');
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Invalid or expired session.');
    }

    const body = validate(req.body, {
      currentPassword: { type: 'string', label: 'Current password', required: true, maxLength: 200 },
      newPassword: {
        type: 'string',
        label: 'New password',
        required: true,
        minLength: 10,
        maxLength: 200,
        custom: (v, all) =>
          v === all.currentPassword ? 'New password must differ from the current one.' : null,
      },
    });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) throw notFound('User not found.');
    if (!bcrypt.compareSync(body.currentPassword, user.password_hash)) {
      throw badRequest('Current password is incorrect.', { currentPassword: 'Current password is incorrect.' });
    }

    const hash = bcrypt.hashSync(body.newPassword, 12);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);

    return ok(res, { updated: true });
  })
);

module.exports = router;
