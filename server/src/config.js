'use strict';

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load the repo-root .env first, then a server-local .env as an override.
const rootDir = path.resolve(__dirname, '..', '..');
const serverDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(serverDir, '.env') });

function str(key, fallback) {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

function int(key, fallback) {
  const v = parseInt(process.env[key], 10);
  return Number.isFinite(v) ? v : fallback;
}

function bool(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(v);
}

function list(key, fallback) {
  const v = process.env[key];
  if (!v) return fallback;
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveFromServer(p) {
  return path.isAbsolute(p) ? p : path.resolve(serverDir, p);
}

const isProd = str('NODE_ENV', 'development') === 'production';

const config = {
  env: isProd ? 'production' : 'development',
  isProd,
  port: int('PORT', 4000),
  // Interface to bind. 0.0.0.0 makes the API reachable from containers,
  // reverse proxies and cloud runtimes; override with HOST if needed.
  host: str('HOST', '0.0.0.0'),
  serverDir,
  rootDir,

  // Absolute origin advertised for canonical/OG URLs and in the bootstrap
  // payload. Set PUBLIC_API_URL on the host to pin it. When it is NOT set,
  // routers/public.js derives the origin from the request Host header
  // instead of falling back to localhost, so a visitor or crawler is never
  // handed an address that only works on the developer's machine.
  publicApiUrl: str('PUBLIC_API_URL', '').replace(/\/+$/, ''),
  clientOrigins: list('CLIENT_ORIGINS', ['http://localhost:5173', 'http://127.0.0.1:5173']),

  db: {
    file: resolveFromServer(str('DATABASE_FILE', './data/app.db')),
  },

  upload: {
    dir: resolveFromServer(str('UPLOAD_DIR', './uploads')),
    maxBytes: int('MAX_UPLOAD_BYTES', 5 * 1024 * 1024),
  },

  auth: {
    jwtSecret: str('JWT_SECRET', ''),
    jwtTtl: str('JWT_TTL', '15m'),
    refreshSecret: str('REFRESH_JWT_SECRET', ''),
    refreshTtl: str('REFRESH_JWT_TTL', '30d'),
    cookieSecure: bool('COOKIE_SECURE', isProd),
    admin: {
      email: str('ADMIN_EMAIL', 'admin@localhost.local'),
      password: str('ADMIN_PASSWORD', 'ChangeMe123!'),
      name: str('ADMIN_NAME', 'Administrator'),
    },
  },
};

// Fail fast on missing secrets in production; dev gets a loud warning.
if (config.isProd) {
  if (!config.auth.jwtSecret || config.auth.jwtSecret.includes('change-me')) {
    throw new Error('JWT_SECRET must be set to a strong value in production.');
  }
  if (!config.auth.refreshSecret || config.auth.refreshSecret.includes('change-me')) {
    throw new Error('REFRESH_JWT_SECRET must be set to a strong value in production.');
  }
} else if (!config.auth.jwtSecret || !config.auth.refreshSecret) {
  console.warn('[config] JWT secrets are missing; using an ephemeral dev secret.');
  const crypto = require('crypto');
  config.auth.jwtSecret = config.auth.jwtSecret || crypto.randomBytes(32).toString('hex');
  config.auth.refreshSecret = config.auth.refreshSecret || crypto.randomBytes(32).toString('hex');
}

fs.mkdirSync(path.dirname(config.db.file), { recursive: true });
fs.mkdirSync(config.upload.dir, { recursive: true });

module.exports = config;
