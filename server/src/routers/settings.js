'use strict';

/**
 * Router 6/9 — business settings
 * The brand name, contact details and site copy are all editable at runtime
 * from the dashboard. `GET /api/settings` exposes only the public subset;
 * the full record requires admin auth.
 */

const express = require('express');

const { db, getAllSettings, getSetting, setSetting } = require('../db');
const { ok, asyncHandler, badRequest } = require('../utils/http');
const { emailRule, phoneRule } = require('../utils/validate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { DEFAULT_SETTINGS } = require('../settings/defaults');

const router = express.Router();

/**
 * Keys any visitor may read — enough to render the header, footer and
 * contact page without leaking internal configuration.
 */
const PUBLIC_KEYS = [
  'brand_name',
  'tagline',
  'contact_email',
  'contact_phone',
  'contact_whatsapp',
  'directions',
  'hero_title',
  'hero_subtitle',
  'about_title',
  'about_body',
  'seo',
  'currency',
  'booking_enabled',
  'inquiry_enabled',
  'footer_note',
];

/**
 * Writable keys and their expected types. Anything not listed here is
 * rejected, so a crafted payload cannot pollute the settings table.
 */
const WRITABLE = {
  brand_name: 'string',
  tagline: 'string',
  contact_email: 'string',
  contact_phone: 'string',
  contact_whatsapp: 'string',
  directions: 'array',
  hero_title: 'string',
  hero_subtitle: 'string',
  about_title: 'string',
  about_body: 'string',
  seo: 'object',
  currency: 'string',
  booking_enabled: 'boolean',
  inquiry_enabled: 'boolean',
  footer_note: 'string',
};

/**
 * Validate one key/value pair against WRITABLE plus field-specific rules.
 * Returns an error string, or null when the value is acceptable.
 */
function checkValue(key, value) {
  const expected = WRITABLE[key];
  if (!expected) return 'This setting cannot be modified.';

  if (expected === 'string') {
    if (typeof value !== 'string') return 'Must be text.';
    if (value.trim().length > 5000) return 'Too long.';
    const trimmed = value.trim();
    if (key === 'brand_name' && trimmed.length < 2) return 'Brand name is too short.';
    if (key === 'contact_email' && trimmed !== '' && !emailRule().pattern.test(trimmed)) {
      return 'Enter a valid email address.';
    }
    if (key === 'contact_phone' && trimmed !== '' && !phoneRule().pattern.test(trimmed)) {
      return 'Enter a valid phone number.';
    }
    if (key === 'contact_whatsapp' && trimmed !== '' && !phoneRule().pattern.test(trimmed)) {
      return 'Enter a valid WhatsApp number.';
    }
    if (key === 'currency' && !['EUR', 'USD', 'GBP', 'LKR'].includes(trimmed)) {
      return 'Unsupported currency.';
    }
    return null;
  }

  if (expected === 'boolean') {
    return typeof value === 'boolean' ? null : 'Must be true or false.';
  }

  if (expected === 'array') {
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) return 'Must be a list of text values.';
    if (value.length > 30) return 'Too many entries.';
    if (key === 'directions') {
      const valid = ['SL_TO_IT', 'IT_TO_SL'];
      if (value.length === 0 || !value.every((d) => valid.includes(d))) {
        return 'Choose at least one travel direction.';
      }
    }
    return null;
  }

  if (expected === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'Must be an object.';
    if (Object.keys(value).length > 50) return 'Too many entries.';
    return null;
  }

  return 'Unsupported setting type.';
}

/** Normalise a value the way it will be persisted (trims strings). */
function normalise(key, value) {
  return WRITABLE[key] === 'string' ? String(value).trim() : value;
}

function publicSettings() {
  const all = getAllSettings();
  const out = {};
  for (const key of PUBLIC_KEYS) {
    if (all[key] !== undefined) out[key] = all[key];
    else if (DEFAULT_SETTINGS[key] !== undefined) out[key] = DEFAULT_SETTINGS[key];
  }
  return out;
}

// GET /api/settings — public subset.
router.get('/', (req, res) => ok(res, publicSettings()));

// GET /api/settings/all — full record for the dashboard.
router.get(
  '/all',
  requireAuth,
  requireAdmin,
  (req, res) => ok(res, { ...DEFAULT_SETTINGS, ...getAllSettings() })
);

// GET /api/settings/keys — schema hint used to render the settings form.
router.get('/keys', requireAuth, requireAdmin, (req, res) =>
  ok(res, { writable: WRITABLE, defaults: DEFAULT_SETTINGS })
);

// PUT /api/settings — bulk update.
router.put(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      throw badRequest('Expected an object of settings.');
    }

    const errors = {};
    const toWrite = {};

    for (const [key, value] of Object.entries(incoming)) {
      const problem = checkValue(key, value);
      if (problem) {
        errors[key] = problem;
        continue;
      }
      toWrite[key] = normalise(key, value);
    }

    if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);

    db.transaction(() => {
      for (const [key, value] of Object.entries(toWrite)) setSetting(key, value);
    })();

    return ok(res, { ...DEFAULT_SETTINGS, ...getAllSettings() }, { updated: Object.keys(toWrite) });
  })
);

// PATCH /api/settings/:key — single-key update (handy for toggles).
router.patch(
  '/:key',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    if (!WRITABLE[key]) throw badRequest('This setting cannot be modified.');

    const body = req.body;
    if (!body || typeof body !== 'object' || !Object.prototype.hasOwnProperty.call(body, 'value')) {
      throw badRequest('Expected { value } in the request body.');
    }

    const problem = checkValue(key, body.value);
    if (problem) throw badRequest(problem, { [key]: problem });

    setSetting(key, normalise(key, body.value));
    return ok(res, { [key]: getSetting(key) });
  })
);

module.exports = router;
