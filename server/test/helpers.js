'use strict';

/**
 * Test harness.
 *
 * Each suite gets its own temp database and upload directory so tests never
 * touch the developer's real data. Environment must be set BEFORE requiring
 * the app, because config.js reads process.env at load time.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

function makeTempDirs() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tourism-test-'));
  return {
    base,
    databaseFile: path.join(base, 'test.db'),
    uploadDir: path.join(base, 'uploads'),
    cleanup() {
      try {
        fs.rmSync(base, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    },
  };
}

/**
 * Boot the Express app on an ephemeral port against a fresh temp database.
 * Returns { url, close, dirs } — call close() when the suite finishes.
 *
 * Only ONE boot per process: config.js and db/index.js read process.env and
 * open the database at require time, and Node's test runner caches modules.
 * A second call would silently keep talking to the first app's database
 * (while the first suite's close() had already closed it). Put additional
 * suites that need the API in their own test file — the runner isolates
 * each file in its own process.
 */
let bootedInThisProcess = false;

function startApp() {
  if (bootedInThisProcess) {
    throw new Error(
      'startApp() may only boot the app once per process — config and the SQLite handle are ' +
        'cached at require time. Add another *.test.js file instead of calling startApp() again.'
    );
  }
  bootedInThisProcess = true;

  const dirs = makeTempDirs();

  process.env.NODE_ENV = 'development';
  process.env.DATABASE_FILE = dirs.databaseFile;
  process.env.UPLOAD_DIR = dirs.uploadDir;
  process.env.JWT_SECRET = `test-access-${crypto.randomBytes(16).toString('hex')}`;
  process.env.REFRESH_JWT_SECRET = `test-refresh-${crypto.randomBytes(16).toString('hex')}`;
  process.env.CLIENT_ORIGINS = 'http://localhost:5173';
  process.env.ADMIN_EMAIL = 'admin@test.local';
  process.env.ADMIN_PASSWORD = 'TestPass123!';

  // Require AFTER the env vars are in place.
  const app = require('../src/app');
  const { db } = require('../src/db');
  const { seedAdmin, seedSettings } = require('../src/db/seed');

  seedAdmin();
  seedSettings();

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        db,
        dirs,
        close() {
          return new Promise((done) => {
            server.close(() => {
              try {
                db.close();
              } catch {
                /* already closed */
              }
              dirs.cleanup();
              done();
            });
          });
        },
      });
    });
  });
}

/**
 * Tiny cookie jar + fetch wrapper. Node 18 ships fetch globally.
 *
 * Mirrors client/src/api/client.js: the API authenticates with a Bearer
 * access token (the refresh token is an httpOnly cookie scoped to
 * /api/auth and is only accepted by /auth/session and /auth/refresh).
 * So the client remembers any accessToken the server issues — from login,
 * session restore or refresh — and attaches it to subsequent requests.
 *
 * Usage:  const admin = createClient(url);
 *         await admin.post('/auth/login', { email, password });
 *         await admin.get('/bookings');   // now authenticated
 */
function createClient(base) {
  const jar = new Map();
  let accessToken = null;

  function storeCookies(res) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const fallback = res.headers.get('set-cookie');
    const all = raw.length ? raw : fallback ? [fallback] : [];
    for (const line of all) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === '' || /Max-Age=0/i.test(line)) jar.delete(name);
      else jar.set(name, value);
    }
  }

  function cookieHeader() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async function request(method, pathOrUrl, { body, headers = {}, raw = false } = {}) {
    // Routers are mounted under /api. Media URLs come back as absolute
    // `/api/media/...` paths, so avoid double-prefixing those.
    let url;
    if (pathOrUrl.startsWith('http')) url = pathOrUrl;
    else if (pathOrUrl.startsWith('/api/')) url = `${base}${pathOrUrl}`;
    else url = `${base}/api${pathOrUrl}`;
    const init = { method, headers: { ...headers } };

    if (body !== undefined) {
      if (body instanceof FormData || typeof body === 'string' || Buffer.isBuffer(body)) {
        init.body = body;
      } else {
        init.body = JSON.stringify(body);
        init.headers['Content-Type'] = 'application/json';
      }
    }

    const cookies = cookieHeader();
    if (cookies) init.headers.Cookie = cookies;

    // Attach the bearer token unless the caller set one explicitly
    // (some tests deliberately override or omit it).
    const hasAuth = Object.keys(init.headers).some((k) => k.toLowerCase() === 'authorization');
    if (!hasAuth && accessToken) init.headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(url, init);
    storeCookies(res);

    if (raw) return res;
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { success: false, error: { message: text } };
    }

    // Remember any newly issued access token (login / session / refresh).
    const issued = json && json.data && json.data.accessToken;
    if (typeof issued === 'string' && issued) accessToken = issued;
    // Logging out drops the in-memory token; the cookie jar is already cleared.
    else if (/\/auth\/logout\b/.test(url)) accessToken = null;

    return { status: res.status, ok: res.ok, body: json, headers: res.headers };
  }

  return {
    jar,
    get token() {
      return accessToken;
    },
    set token(value) {
      accessToken = value;
    },
    request,
    get: (p, o) => request('GET', p, o),
    post: (p, b, o) => request('POST', p, { ...o, body: b }),
    put: (p, b, o) => request('PUT', p, { ...o, body: b }),
    patch: (p, b, o) => request('PATCH', p, { ...o, body: b }),
    del: (p, o) => request('DELETE', p, o),
  };
}

module.exports = { startApp, createClient };
