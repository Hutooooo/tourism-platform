'use strict';

const { db } = require('../db');
const { verifyAccessToken } = require('../utils/tokens');
const { unauthorized, forbidden, asyncHandler } = require('../utils/http');

/**
 * Requires a valid access token. Attaches `req.user` with the *current*
 * DB row so deactivating an account revokes access immediately, rather
 * than trusting stale claims embedded in the token.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw unauthorized('Authentication required.');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw unauthorized('Your session has expired. Please sign in again.');
    throw unauthorized('Invalid or malformed token.');
  }

  const user = db.prepare('SELECT id, email, name, role, active FROM users WHERE id = ?').get(payload.sub);
  if (!user || !user.active) throw unauthorized('Your account is no longer active.');

  req.user = user;
  next();
});

/** Narrows an authenticated request to specific roles. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('Administrator access is required.'));
    next();
  };
}

const requireAdmin = requireRole('admin');

module.exports = { requireAuth, requireRole, requireAdmin };
