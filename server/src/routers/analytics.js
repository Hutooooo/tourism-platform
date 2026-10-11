'use strict';

/**
 * Router 8/9 — analytics
 * Dashboard overview: content counts, funnel totals and recent activity.
 * Derived entirely from data already in the database — no third-party
 * tracking, no visitor profiling.
 */

const express = require('express');

const { db } = require('../db');
const { ok, asyncHandler } = require('../utils/http');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const count = (sql, ...params) => db.prepare(sql).get(...params).n;

// GET /api/analytics/overview — the dashboard landing numbers.
router.get(
  '/overview',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const summary = {
      destinations: count('SELECT COUNT(*) AS n FROM destinations'),
      destinationsPublished: count('SELECT COUNT(*) AS n FROM destinations WHERE published = 1'),
      packages: count('SELECT COUNT(*) AS n FROM packages'),
      packagesPublished: count('SELECT COUNT(*) AS n FROM packages WHERE published = 1'),
      inquiries: count('SELECT COUNT(*) AS n FROM inquiries'),
      inquiriesNew: count("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'"),
      bookings: count('SELECT COUNT(*) AS n FROM bookings'),
      bookingsPending: count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending'"),
      media: count('SELECT COUNT(*) AS n FROM media'),
      users: count('SELECT COUNT(*) AS n FROM users WHERE active = 1'),
    };

    return ok(res, summary);
  })
);

// GET /api/analytics/funnel — submissions split by direction and status.
router.get(
  '/funnel',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const bookingsByStatus = db.prepare('SELECT status, COUNT(*) AS n FROM bookings GROUP BY status').all();
    const bookingsByDirection = db.prepare('SELECT direction, COUNT(*) AS n FROM bookings GROUP BY direction').all();
    const inquiriesByType = db.prepare('SELECT type, COUNT(*) AS n FROM inquiries GROUP BY type').all();

    const byStatus = Object.fromEntries(bookingsByStatus.map((r) => [r.status, r.n]));
    const byDirection = Object.fromEntries(bookingsByDirection.map((r) => [r.direction, r.n]));
    const inqByType = Object.fromEntries(inquiriesByType.map((r) => [r.type, r.n]));

    const totalBookings = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const confirmed = byStatus.confirmed || 0;

    return ok(res, {
      bookings: { total: totalBookings, byStatus, byDirection },
      inquiries: { total: Object.values(inqByType).reduce((a, b) => a + b, 0), byType: inqByType },
      conversion: {
        // Bookings marked confirmed against all booking requests received.
        confirmedRate: totalBookings ? Math.round((confirmed / totalBookings) * 1000) / 10 : 0,
      },
    });
  })
);

// GET /api/analytics/timeline?days=30 — submissions per day.
router.get(
  '/timeline',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
    const since = `-${days} days`;

    const bookingRows = db
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS n FROM bookings
         WHERE created_at >= datetime('now', ?) GROUP BY day ORDER BY day`
      )
      .all(since);

    const inquiryRows = db
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS n FROM inquiries
         WHERE created_at >= datetime('now', ?) GROUP BY day ORDER BY day`
      )
      .all(since);

    const bookingMap = new Map(bookingRows.map((r) => [r.day, r.n]));
    const inquiryMap = new Map(inquiryRows.map((r) => [r.day, r.n]));

    // Emit a contiguous series so charts do not have gaps for empty days.
    const series = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ day: key, bookings: bookingMap.get(key) || 0, inquiries: inquiryMap.get(key) || 0 });
    }

    return ok(res, { days, series });
  })
);

// GET /api/analytics/recent — latest activity across tables.
router.get(
  '/recent',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = 6;

    const recentBookings = db
      .prepare('SELECT id, name, package_title, direction, status, created_at FROM bookings ORDER BY created_at DESC, id DESC LIMIT ?')
      .all(limit);

    const recentInquiries = db
      .prepare('SELECT id, name, email, subject, status, created_at FROM inquiries ORDER BY created_at DESC, id DESC LIMIT ?')
      .all(limit);

    return ok(res, { bookings: recentBookings, inquiries: recentInquiries });
  })
);

module.exports = router;
