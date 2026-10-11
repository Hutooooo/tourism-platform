'use strict';

/**
 * Router 4/9 — booking requests
 * Public submission (rate-limited), admin listing with filters, and status
 * transitions. Bookings are requests, not instant confirmations: nothing is
 * charged here and every request lands in the dashboard for follow-up.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

const { db, tx } = require('../db');
const { ok, asyncHandler, notFound, badRequest } = require('../utils/http');
const { validate, emailRule, phoneRule } = require('../utils/validate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getSetting } = require('../db');

const router = express.Router();

const DIRECTIONS = ['SL_TO_IT', 'IT_TO_SL', 'BOTH'];
const STATUSES = ['pending', 'confirmed', 'declined', 'completed'];

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { message: 'You have submitted several requests recently. Please wait a while before sending another.' } },
});

function mapBooking(row) {
  if (!row) return null;
  return {
    ...row,
    // SQLite boolean columns come back as 0/1 elsewhere; kept numeric here
    // because bookings have no boolean columns today.
  };
}

const submitRules = {
  name: { type: 'string', label: 'Full name', required: true, minLength: 2, maxLength: 140 },
  email: { ...emailRule(), required: true },
  phone: phoneRule(),
  travel_date: {
    type: 'string',
    label: 'Travel date',
    maxLength: 40,
    optional: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternMessage: 'Travel date must be formatted as YYYY-MM-DD.',
  },
  travellers: { type: 'integer', label: 'Travellers', min: 1, max: 50, optional: true },
  adults: { type: 'integer', label: 'Adults', min: 1, max: 50, optional: true },
  children: { type: 'integer', label: 'Children', min: 0, max: 30, optional: true },
  notes: { type: 'string', label: 'Notes', maxLength: 3000, optional: true },
  direction: { type: 'string', label: 'Direction', enum: DIRECTIONS, optional: true },
  package_slug: { type: 'string', label: 'Package', maxLength: 160, optional: true },
};

// POST /api/bookings — public.
router.post(
  '/',
  submitLimiter,
  asyncHandler(async (req, res) => {
    if (getSetting('booking_enabled', true) === false) {
      throw badRequest('Bookings are temporarily closed. Please contact us directly.');
    }

    const body = validate(req.body, submitRules);

    let pkg = null;
    if (body.package_slug) {
      pkg = db
        .prepare("SELECT id, title, direction FROM packages WHERE slug = ? AND published = 1")
        .get(body.package_slug);
      if (!pkg) throw badRequest('That package is no longer available.', { package_slug: 'Unknown package.' });
    }

    const direction = body.direction || (pkg ? pkg.direction : 'BOTH');
    const adults = body.adults ?? body.travellers ?? 1;
    const children = body.children ?? 0;
    const travellers = body.travellers ?? adults + children;

    const info = db
      .prepare(
        `INSERT INTO bookings
           (package_id, package_title, direction, name, email, phone, travel_date,
            travellers, adults, children, notes, status)
         VALUES (@package_id, @package_title, @direction, @name, @email, @phone, @travel_date,
                 @travellers, @adults, @children, @notes, 'pending')`
      )
      .run({
        package_id: pkg ? pkg.id : null,
        package_title: pkg ? pkg.title : 'Custom enquiry',
        direction,
        name: body.name.trim(),
        email: body.email.toLowerCase().trim(),
        phone: body.phone ? body.phone.trim() : null,
        travel_date: body.travel_date || null,
        travellers,
        adults,
        children,
        notes: body.notes ? body.notes.trim() : null,
      });

    const created = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
    // 201 signals a created resource; the client shows a reference number.
    return res.status(201).json({
      success: true,
      data: { id: created.id, reference: `BK-${String(created.id).padStart(5, '0')}`, status: created.status },
    });
  })
);

// GET /api/bookings — admin list with optional status filter.
router.get(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = {};
    if (status) {
      where.push('status = @status');
      params.status = status;
    }
    if (q) {
      where.push('(name LIKE @q OR email LIKE @q OR package_title LIKE @q OR phone LIKE @q)');
      params.q = `%${q}%`;
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) AS n FROM bookings ${clause}`).get(params).n;
    const rows = db
      .prepare(`SELECT * FROM bookings ${clause} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset });

    return ok(res, rows.map(mapBooking), { total, limit, offset, hasMore: offset + rows.length < total });
  })
);

// GET /api/bookings/counts — dashboard badge numbers.
router.get(
  '/counts',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = db.prepare('SELECT status, COUNT(*) AS n FROM bookings GROUP BY status').all();
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of rows) counts[r.status] = r.n;
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
    return ok(res, counts);
  })
);

// GET /api/bookings/:id
router.get(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Booking not found.');
    return ok(res, mapBooking(row));
  })
);

// PATCH /api/bookings/:id/status
router.patch(
  '/:id/status',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id FROM bookings WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound('Booking not found.');

    const body = validate(req.body, {
      status: { type: 'string', label: 'Status', required: true, enum: STATUSES },
    });

    db.prepare("UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      body.status,
      existing.id
    );
    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(existing.id);
    return ok(res, mapBooking(updated));
  })
);

// DELETE /api/bookings/:id
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id FROM bookings WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound('Booking not found.');
    tx(() => db.prepare('DELETE FROM bookings WHERE id = ?').run(existing.id));
    return ok(res, { deleted: true, id: existing.id });
  })
);

module.exports = router;
