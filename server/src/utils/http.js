'use strict';

/** Uniform success envelope. Every 2xx response goes through ok(). */
function ok(res, data, meta) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.json(body);
}

/** Uniform error envelope. */
function fail(res, status, message, details) {
  const body = { success: false, error: { message } };
  if (details !== undefined) body.error.details = details;
  return res.status(status).json(body);
}

/**
 * Wrap an async route handler so rejected promises reach the error
 * middleware instead of hanging the request.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'Authentication required.') => new HttpError(401, msg);
const forbidden = (msg = 'You do not have permission to do that.') => new HttpError(403, msg);
const notFound = (msg = 'Resource not found.') => new HttpError(404, msg);
const conflict = (msg, details) => new HttpError(409, msg, details);
const tooMany = (msg = 'Too many requests. Please try again shortly.') => new HttpError(429, msg);

module.exports = {
  ok,
  fail,
  asyncHandler,
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooMany,
};
