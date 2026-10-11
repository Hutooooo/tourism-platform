'use strict';

/**
 * Router 5/9 — customer inquiries
 * The contact-form inbox: public submission plus admin triage
 * (new / read / replied / archived).
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

const { db, tx } = require('../db');
const { ok, asyncHandler, notFound, badRequest } = require('../utils/http');
const { validate, emailRule, phoneRule } = require('../utils/validate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getSetting } = require('../db');

const router = express.Router();

const TYPES = ['general', 'custom-tour', 'partnership', 'other'];
const STATUSES = ['new', 'read', 'replied', 'archived'];

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { message: 'You have sent several messages recently. Please wait a while before sending another.' } },
});

const submitRules = {
  name: { type: 'string', label: 'Name', required: true, minLength: 2, maxLength: 140 },
  email: { ...emailRule(), required: true },
  phone: phoneRule(),
  subject: { type: 'string', label: 'Subject', maxLength: 200, optional: true },
  message: { type: 'string', label: 'Message', required: true, minLength: 10, maxLength: 5000 },
  type: { type: 'string', label: 'Type', enum: TYPES, optional: true },
};

// POST /api/inquiries — public.
router.post(
  '/',
  submitLimiter,
  asyncHandler(async (req, res) => {
    if (getSetting('inquiry_enabled', true) === false) {
      throw badRequest('The contact form is temporarily disabled. Please email us directly.');
    }

    const body = validate(req.body, submitRules);

    const info = db
      .prepare(
        `INSERT INTO inquiries (name, email, phone, subject, message, type, status)
         VALUES (@name, @email, @phone, @subject, @message, @type, 'new')`
      )
      .run({
        name: body.name.trim(),
        email: body.email.toLowerCase().trim(),
        phone: body.phone ? body.phone.trim() : null,
        subject: body.subject ? body.subject.trim() : null,
        message: body.message.trim(),
        type: body.type || 'general',
      });

    const created = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(info.lastInsertRowid);
    return res.status(201).json({
      success: true,
      data: { id: created.id, status: created.status, received: true },
    });
  })
);

// GET /api/inquiries — admin inbox.
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
      where.push('(name LIKE @q OR email LIKE @q OR subject LIKE @q OR message LIKE @q)');
      params.q = `%${q}%`;
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) AS n FROM inquiries ${clause}`).get(params).n;
    const rows = db
      .prepare(`SELECT * FROM inquiries ${clause} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset });

    return ok(res, rows, { total, limit, offset, hasMore: offset + rows.length < total });
  })
);

// GET /api/inquiries/counts — unread badge for the dashboard.
router.get(
  '/counts',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = db.prepare('SELECT status, COUNT(*) AS n FROM inquiries GROUP BY status').all();
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of rows) counts[r.status] = r.n;
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
    return ok(res, counts);
  })
);

// GET /api/inquiries/:id — returns in read state.
router.get(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Inquiry not found.');

    // Opening an unread message marks it read so the inbox stays honest.
    if (row.status === 'new') {
      db.prepare("UPDATE inquiries SET status = 'read', updated_at = datetime('now') WHERE id = ?").run(row.id);
      row.status = 'read';
    }
    return ok(res, row);
  })
);

// PATCH /api/inquiries/:id/status
router.patch(
  '/:id/status',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id FROM inquiries WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound('Inquiry not found.');

    const body = validate(req.body, {
      status: { type: 'string', label: 'Status', required: true, enum: STATUSES },
    });

    db.prepare("UPDATE inquiries SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      body.status,
      existing.id
    );
    const updated = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(existing.id);
    return ok(res, updated);
  })
);

// DELETE /api/inquiries/:id
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id FROM inquiries WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound('Inquiry not found.');
    tx(() => db.prepare('DELETE FROM inquiries WHERE id = ?').run(existing.id));
    return ok(res, { deleted: true, id: existing.id });
  })
);

module.exports = router;
