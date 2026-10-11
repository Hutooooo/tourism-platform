'use strict';

/**
 * Express application assembly.
 *
 * The API is organised as nine routers under /api:
 *   1. auth          /api/auth
 *   2. destinations  /api/destinations
 *   3. packages      /api/packages
 *   4. bookings      /api/bookings
 *   5. inquiries     /api/inquiries
 *   6. settings      /api/settings
 *   7. media         /api/media
 *   8. analytics     /api/analytics
 *   9. public        /api/public
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('./config');
const { helmetMiddleware, corsMiddleware } = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/error');

const authRouter = require('./routers/auth');
const destinationsRouter = require('./routers/destinations');
const packagesRouter = require('./routers/packages');
const bookingsRouter = require('./routers/bookings');
const inquiriesRouter = require('./routers/inquiries');
const settingsRouter = require('./routers/settings');
const mediaRouter = require('./routers/media');
const analyticsRouter = require('./routers/analytics');
const publicRouter = require('./routers/public');

const app = express();

app.set('trust proxy', 1); // accurate client IPs + rate-limit headers behind a proxy

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Access log for non-GET traffic; keeps GET noise out of the console.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const started = Date.now();
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
    }
  });
  next();
});

// --- The nine routers -------------------------------------------------
app.use('/api/auth', authRouter);
app.use('/api/destinations', destinationsRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/inquiries', inquiriesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/public', publicRouter);

// Convenience alias so `GET /api/health` also works for uptime checks.
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'tourism-api' } });
});

// --- Static client (production) ---------------------------------------
// In production the built SPA is served from the same origin, which keeps
// cookies, CORS and SEO simple. In dev, Vite runs separately on :5173.
const clientDist = path.resolve(config.rootDir, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));

  // Unknown non-API paths fall through to index.html for client routing.
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    const indexFile = path.join(clientDist, 'index.html');
    if (!fs.existsSync(indexFile)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(indexFile);
  });
} else if (config.isProd) {
  // Without this the API still boots, /api/health still returns 200, and the
  // host marks the service healthy while every page 404s. Fail loudly instead.
  console.warn(
    `[app] client/dist not found at ${clientDist} — serving /api only.\n` +
      '       Run `npm run build` before starting in production.'
  );
}

app.use('/api', notFoundHandler);
app.use(errorHandler);

module.exports = app;
