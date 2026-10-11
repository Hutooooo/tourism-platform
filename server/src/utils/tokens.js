'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Token strategy:
 *  - Access tokens are short-lived JWTs sent as `Authorization: Bearer …`.
 *  - Refresh tokens are longer-lived JWTs stored only in an httpOnly cookie
 *    scoped to `/api/auth`, so client JavaScript can never read them.
 *
 * Both are signed with separate secrets and an explicit issuer, so a token
 * minted for one purpose cannot be replayed as the other.
 */

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email, name: user.name },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtTtl, issuer: 'tourism-platform' }
  );
}

function signRefreshJwt(userId) {
  return jwt.sign({ sub: String(userId), typ: 'refresh' }, config.auth.refreshSecret, {
    expiresIn: config.auth.refreshTtl,
    issuer: 'tourism-platform',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.auth.jwtSecret, { issuer: 'tourism-platform' });
}

function verifyRefreshJwt(token) {
  return jwt.verify(token, config.auth.refreshSecret, { issuer: 'tourism-platform' });
}

module.exports = {
  signAccessToken,
  signRefreshJwt,
  verifyAccessToken,
  verifyRefreshJwt,
};
