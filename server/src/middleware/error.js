'use strict';

const config = require('../config');
const { HttpError, fail } = require('../utils/http');

/** 404 for unmatched API paths — kept ahead of the error handler. */
function notFoundHandler(req, res) {
  fail(res, 404, `No API route matches ${req.method} ${req.originalUrl}.`);
}

/**
 * Central error funnel. Known HttpErrors are echoed verbatim; everything
 * else is logged and returned as a generic 500 so internals never leak.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError || (err && err.expose && err.status)) {
    return fail(res, err.status || 500, err.message, err.details);
  }

  if (err && err.type === 'entity.too.large') {
    return fail(res, 413, 'The uploaded payload is too large.');
  }

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return fail(res, 413, `File exceeds the ${Math.floor(config.upload.maxBytes / (1024 * 1024))}MB limit.`);
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  return fail(res, 500, 'Something went wrong on our end. Please try again.');
}

module.exports = { notFoundHandler, errorHandler };
