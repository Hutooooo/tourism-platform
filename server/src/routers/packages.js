'use strict';

/**
 * Router 3/9 — tour packages
 * Public package catalogue filtered by travel direction, plus dashboard CRUD.
 */

const express = require('express');

const { db, tx } = require('../db');
const { ok, asyncHandler, notFound, conflict, badRequest } = require('../utils/http');
const { validate, slugRule } = require('../utils/validate');
const { slugify, uniqueSlug } = require('../utils/slug');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const DIRECTIONS = ['SL_TO_IT', 'IT_TO_SL', 'BOTH'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'LKR'];

function parseJson(v, fallback) {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function mapPackage(row) {
  if (!row) return null;
  return {
    ...row,
    featured: !!row.featured,
    published: !!row.published,
    itinerary: parseJson(row.itinerary, []),
    includes: parseJson(row.includes, []),
    excludes: parseJson(row.excludes, []),
    gallery: parseJson(row.gallery, []),
  };
}

const rules = {
  title: { type: 'string', label: 'Title', required: true, minLength: 3, maxLength: 180 },
  direction: { type: 'string', label: 'Direction', required: true, enum: DIRECTIONS },
  destination_id: { type: 'integer', label: 'Destination', optional: true },
  summary: { type: 'string', label: 'Summary', maxLength: 500, optional: true },
  description: { type: 'string', label: 'Description', maxLength: 30000, optional: true },
  duration_days: { type: 'integer', label: 'Duration', min: 1, max: 365, optional: true },
  price_from: { type: 'number', label: 'Price', min: 0, max: 10000000, optional: true },
  currency: { type: 'string', label: 'Currency', enum: CURRENCIES, optional: true },
  itinerary: { type: 'array', label: 'Itinerary', optional: true },
  includes: { type: 'array', label: 'Includes', optional: true },
  excludes: { type: 'array', label: 'Excludes', optional: true },
  image_url: { type: 'string', label: 'Image', maxLength: 2000, optional: true },
  gallery: { type: 'array', label: 'Gallery', optional: true },
  featured: { type: 'boolean', label: 'Featured', optional: true },
  published: { type: 'boolean', label: 'Published', optional: true },
  sort_order: { type: 'integer', label: 'Sort order', optional: true },
  slug: { ...slugRule('Slug'), optional: true },
};

const asBool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

/**
 * Every package read joins the destination so the response always carries
 * `destination_name` / `destination_slug`. Create and update use this too:
 * the dashboard renders the card straight from the mutation response, and a
 * bare `SELECT *` would leave the destination label blank until a refetch.
 */
const SELECT_WITH_DESTINATION = `
  SELECT p.*, d.name AS destination_name, d.slug AS destination_slug
  FROM packages p
  LEFT JOIN destinations d ON d.id = p.destination_id
`;

/**
 * Direction filtering: a package marked BOTH satisfies either single
 * direction request; `BOTH` returns only the explicit both-ways packages.
 */
const DIRECTION_CLAUSE = {
  SL_TO_IT: "(direction = 'SL_TO_IT' OR direction = 'BOTH')",
  IT_TO_SL: "(direction = 'IT_TO_SL' OR direction = 'BOTH')",
  BOTH: "direction = 'BOTH'",
};

// GET /api/packages
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const direction = DIRECTIONS.includes(req.query.direction) ? req.query.direction : null;
    const destinationId = parseInt(req.query.destination_id, 10);
    const featured = req.query.featured === '1';
    const includeAll = req.query.all === '1' && req.headers.authorization;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = {};

    if (!includeAll) where.push('p.published = 1');
    if (direction) {
      where.push(DIRECTION_CLAUSE[direction]);
    }
    if (Number.isFinite(destinationId)) {
      where.push('p.destination_id = @destinationId');
      params.destinationId = destinationId;
    }
    if (featured) where.push('p.featured = 1');
    if (q) {
      where.push('(p.title LIKE @q OR p.summary LIKE @q OR p.description LIKE @q)');
      params.q = `%${q}%`;
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) AS n FROM packages p ${clause}`).get(params).n;

    const rows = db
      .prepare(
        `${SELECT_WITH_DESTINATION}
         ${clause}
         ORDER BY p.featured DESC, p.sort_order ASC, p.title ASC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset });

    return ok(
      res,
      rows.map(mapPackage),
      { total, limit, offset, hasMore: offset + rows.length < total }
    );
  })
);

// GET /api/packages/:slug — includes destination detail for the detail page.
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const row = db
      .prepare(
        `SELECT p.*, d.name AS destination_name, d.slug AS destination_slug,
                d.country AS destination_country, d.summary AS destination_summary,
                d.image_url AS destination_image
         FROM packages p
         LEFT JOIN destinations d ON d.id = p.destination_id
         WHERE p.slug = ?`
      )
      .get(req.params.slug);

    if (!row) throw notFound('Package not found.');
    if (!row.published && !req.headers.authorization) throw notFound('Package not found.');

    const pkg = mapPackage(row);
    if (row.destination_name) {
      pkg.destination = {
        id: row.destination_id,
        name: row.destination_name,
        slug: row.destination_slug,
        country: row.destination_country,
        summary: row.destination_summary,
        image_url: row.destination_image,
      };
    } else {
      pkg.destination = null;
    }
    return ok(res, pkg);
  })
);

// POST /api/packages
router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = validate(req.body, rules);

    if (body.destination_id) {
      const dest = db.prepare('SELECT id FROM destinations WHERE id = ?').get(body.destination_id);
      if (!dest) throw badRequest('Selected destination does not exist.', { destination_id: 'Unknown destination.' });
    }

    const desired = body.slug ? slugify(body.slug) : slugify(body.title);
    const taken = db.prepare('SELECT slug FROM packages').all().map((r) => r.slug);
    const slug = uniqueSlug(desired, taken);
    if (body.slug && slug !== desired) {
      throw conflict('That slug is already in use.', { slug: 'That slug is already in use.' });
    }

    const info = db
      .prepare(
        `INSERT INTO packages
           (slug, title, direction, destination_id, summary, description, duration_days, price_from, currency,
            itinerary, includes, excludes, image_url, gallery, featured, published, sort_order)
         VALUES (@slug, @title, @direction, @destination_id, @summary, @description, @duration_days, @price_from, @currency,
                 @itinerary, @includes, @excludes, @image_url, @gallery, @featured, @published, @sort_order)`
      )
      .run({
        slug,
        title: body.title,
        direction: body.direction,
        destination_id: body.destination_id || null,
        summary: body.summary || null,
        description: body.description || null,
        duration_days: body.duration_days || null,
        price_from: body.price_from || null,
        currency: body.currency || 'EUR',
        itinerary: JSON.stringify(body.itinerary || []),
        includes: JSON.stringify(body.includes || []),
        excludes: JSON.stringify(body.excludes || []),
        image_url: body.image_url || null,
        gallery: JSON.stringify(body.gallery || []),
        featured: asBool(body.featured),
        published: body.published === undefined ? 1 : asBool(body.published),
        sort_order: body.sort_order || 0,
      });

    const created = db.prepare(`${SELECT_WITH_DESTINATION} WHERE p.id = ?`).get(info.lastInsertRowid);
    return ok(res, mapPackage(created));
  })
);

// PUT /api/packages/:id
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound('Package not found.');

    const body = validate(req.body, rules);

    if (body.destination_id) {
      const dest = db.prepare('SELECT id FROM destinations WHERE id = ?').get(body.destination_id);
      if (!dest) throw badRequest('Selected destination does not exist.', { destination_id: 'Unknown destination.' });
    }

    let slug = existing.slug;
    if (body.slug !== undefined) {
      const desired = slugify(body.slug);
      const taken = db.prepare('SELECT slug FROM packages WHERE id != ?').all(existing.id).map((r) => r.slug);
      if (desired !== existing.slug && taken.includes(desired)) {
        throw conflict('That slug is already in use.', { slug: 'That slug is already in use.' });
      }
      slug = desired;
    }

    db.prepare(
      `UPDATE packages SET
         slug = @slug, title = @title, direction = @direction, destination_id = @destination_id,
         summary = @summary, description = @description, duration_days = @duration_days,
         price_from = @price_from, currency = @currency, itinerary = @itinerary,
         includes = @includes, excludes = @excludes, image_url = @image_url,
         gallery = @gallery, featured = @featured, published = @published,
         sort_order = @sort_order, updated_at = datetime('now')
       WHERE id = @id`
    ).run({
      id: existing.id,
      slug,
      title: body.title,
      direction: body.direction,
      destination_id: body.destination_id || null,
      summary: body.summary || null,
      description: body.description || null,
      duration_days: body.duration_days || null,
      price_from: body.price_from || null,
      currency: body.currency || existing.currency,
      itinerary: JSON.stringify(body.itinerary || []),
      includes: JSON.stringify(body.includes || []),
      excludes: JSON.stringify(body.excludes || []),
      image_url: body.image_url || null,
      gallery: JSON.stringify(body.gallery || []),
      featured: asBool(body.featured),
      published: body.published === undefined ? asBool(existing.published) : asBool(body.published),
      sort_order: body.sort_order === undefined ? existing.sort_order : body.sort_order,
    });

    const updated = db.prepare(`${SELECT_WITH_DESTINATION} WHERE p.id = ?`).get(existing.id);
    return ok(res, mapPackage(updated));
  })
);

// DELETE /api/packages/:id
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id FROM packages WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound('Package not found.');
    tx(() => db.prepare('DELETE FROM packages WHERE id = ?').run(existing.id));
    return ok(res, { deleted: true, id: existing.id });
  })
);

module.exports = router;
