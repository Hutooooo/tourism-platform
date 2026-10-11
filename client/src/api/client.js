/**
 * Single HTTP client for the whole app.
 *
 * - Sends the bearer access token when we have one.
 * - On a 401, transparently refreshes using the httpOnly cookie and
 *   replays the original request exactly once (avoids refresh stampedes
 *   when several components 401 together).
 * - Always parses the { success, data, error } envelope.
 */

// Same-origin by default: Express serves the built SPA and the API under
// one origin, so cookies, CORS and SEO need no extra config.
// Set VITE_API_URL only when the API lives on a different origin.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

let accessToken = null;
let refreshPromise = null;
const listeners = new Set();

export function setAccessToken(token) {
  accessToken = token;
  listeners.forEach((fn) => fn(token));
}

export function getAccessToken() {
  return accessToken;
}

/** Subscribe to token changes (used by AuthContext to rehydrate state). */
export function onAccessTokenChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details || null;
  }
}

async function refreshSession() {
  // Collapse concurrent refreshes into one network call.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const body = await res.json().catch(() => null);
        if (res.ok && body && body.success && body.data) {
          setAccessToken(body.data.accessToken);
          return body.data;
        }
        setAccessToken(null);
        return null;
      } catch {
        setAccessToken(null);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request(path, { method = 'GET', body, headers = {}, retry = true } = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;

  const init = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', ...headers },
  };

  if (body !== undefined) {
    if (body instanceof FormData) {
      // Let the browser set the multipart boundary.
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    if (body instanceof FormData) init.body = body;
  }

  if (accessToken) init.headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  // Expired access token → refresh once, then replay the original request.
  if (res.status === 401 && retry && !url.includes('/auth/')) {
    const session = await refreshSession();
    if (session && session.accessToken) {
      return request(path, { method, body, headers, retry: false });
    }
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok || !payload || payload.success === false) {
    const message =
      (payload && payload.error && payload.error.message) ||
      (res.status === 404 ? 'Not found.' : 'Something went wrong. Please try again.');
    throw new ApiError(res.status, message, payload && payload.error ? payload.error.details : null);
  }

  return payload.data !== undefined ? payload.data : payload;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  /** Never sends the bearer token — used for anonymous form submissions. */
  postPublic: (path, body) => request(path, { method: 'POST', body, retry: false }),
};

/** Turn a server-relative or absolute media URL into something <img> can use. */
export function mediaUrl(url) {
  if (!url) return '';
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return url.startsWith('/api') ? url : `/api${url}`;
  return `/api/media/${url}`;
}
