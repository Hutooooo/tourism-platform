'use strict';

const helmet = require('helmet');
const cors = require('cors');
const config = require('../config');

/**
 * Helmet with a CSP sized for the SPA and API JSON responses.
 *
 * The production policy must allow the two Google Fonts hosts used in
 * index.html — without them the stylesheet and the font files are blocked
 * and the site silently falls back to system fonts. `connect-src` needs
 * `data:` because uploaded images may be inlined by the bundler.
 *
 * `crossOriginResourcePolicy: cross-origin` lets the React dev server and
 * any CDN load media served by this API.
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: config.isProd
    ? {
        useDefaults: true,
        directives: {
          'upgrade-insecure-requests': null,
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'", 'data:'],
        },
      }
    : false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

/**
 * CORS restricted to configured origins. Credentials (refresh cookie) are
 * allowed only for explicitly listed origins — never `*`.
 */
const corsMiddleware = cors({
  origin(origin, cb) {
    // Non-browser clients (curl, server-to-server) send no Origin header.
    if (!origin) return cb(null, true);
    if (config.clientOrigins.includes(origin)) return cb(null, true);
    if (config.isProd) return cb(null, false);
    // In development, allow localhost on any port to keep Vite's randomised
    // ports and preview servers working.
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
});

module.exports = { helmetMiddleware, corsMiddleware };
