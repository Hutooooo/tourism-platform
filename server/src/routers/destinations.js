'use strict';

/**
 * Router 2/9 — destinations
 * Public catalogue reads plus authenticated CRUD for the dashboard.
 */

const express = require('express');

const { db, tx } = require('../db');
const { ok, asyncHandler, notFound, conflict } = require('../utils/http');
const { validate, slugRule } = require('../utils/validate');
const { slugify, uniqueSlug } = require('../utils/slug');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const COUNTRIES = ['Sri Lanka', 'Italy'];

/** Rehydrate JSON columns and normalise numeric flags. */
function mapDestination(row) {
  if (!row) return null;
  const parse = (v, fallback) => {
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  };
  return {
    ...row,
    featured: !!row.featured,
    published: !!row.published,
    gallery: parse(row.gallery, []),
    highlights: parse(row.highlights, []),
  };
}

const validationRules = {
  name: { type: 'string', label: 'Name', required: true, minLength: 2, maxLength: 140 },
  country: { type: 'string', label: 'Country', required: true, enum: COUNTRIES },
  region: { type: 'string', label: 'Region', maxLength: 140, optional: true },
  summary: { type: 'string', label: 'Summary', maxLength: 400, optional: true },
  description: { type: 'string', label: 'Description', maxLength: 20000, optional: true },
  image_url: { type: 'string', label: 'Image', maxLength: 2000, optional: true },
  gallery: { type: 'array', label: 'Gallery', optional: true },
  highlights: { type: 'array', label: 'Highlights', optional: true },
  featured: { type: 'boolean', label: 'Featured', optional: true },
  published: { type: 'boolean', label: 'Published', optional: true },
  sort_order: { type: 'integer', label: 'Sort order', optional: true },
  slug: { ...slugRule('Slug'), optional: true },
};

function asBool(v) {
  return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
}

// GET /api/destinations — public list. `published=1` (default) hides drafts.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const country = req.query.country ? String(req.query.country) : null;
    const includeAll = req.query.all === '1' && req.headers.authorization;
    const published = req.query.published === '0' ? 0 : 1;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = {};

    if (!includeAll) {
      if (published) where.push('published = 1');
    } else if (req.query.published !== undefined) {
      where.push('published = @published');
      params.published = published;
    }

    if (country && COUNTRIES.includes(country)) {
      where.push('country = @country');
      params.country = country;
    }
    if (q) {
      where.push('(name LIKE @q OR region LIKE @q OR summary LIKE @q)');
      params.q = `%${q}%`;
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) AS n FROM destinations ${clause}`).get(params).n;
    const rows = db
      .prepare(
        `SELECT * FROM destinations ${clause}
         ORDER BY featured DESC, sort_order ASC, name ASC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset });

    return ok(
      res,
      rows.map(mapDestination),
      { total, limit, offset, hasMore: offset + rows.length < total }
    );
  })
);

// GET /api/destinations/:slug
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM destinations WHERE slug = ?').get(req.params.slug);
    if (!row) throw notFound('Destination not found.');
    return ok(res, mapDestination(row));
  })
);

// POST /api/destinations
router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = validate(req.body, validationRules);

    const desired = body.slug ? slugify(body.slug) : slugify(body.name);
    const taken = db.prepare('SELECT slug FROM destinations').all().map((r) => r.slug);
    const slug = uniqueSlug(desired, taken);

    if (body.slug && slug !== desired) {
      throw conflict('That slug is already in use.', { slug: 'That slug is already in use.' });
    }

    const info = db
      .prepare(
        `INSERT INTO destinations
           (slug, name, country, region, summary, description, image_url, gallery, highlights, featured, published, sort_order)
         VALUES (@slug, @name, @country, @region, @summary, @description, @image_url, @gallery, @highlights, @featured, @published, @sort_order)`
      )
      .run({
        slug,
        name: body.name,
        country: body.country,
        region: body.region || null,
        summary: body.summary || null,
        description: body.description || null,
        image_url: body.image_url || null,
        gallery: JSON.stringify(body.gallery || []),
        highlights: JSON.stringify(body.highlights || []),
        featured: asBool(body.featured),
        published: body.published === undefined ? 1 : asBool(body.published),
        sort_order: body.sort_order || 0,
      });

    const created = db.prepare('SELECT * FROM destinations WHERE id = ?').get(info.lastInsertRowid);
    return ok(res, mapDestination(created));
  })
);

// PUT /api/destinations/:id
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM destinations WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound('Destination not found.');

    const body = validate(req.body, validationRules);

    let slug = existing.slug;
    if (body.slug !== undefined) {
      const desired = slugify(body.slug);
      const taken = db
        .prepare('SELECT slug FROM destinations WHERE id != ?')
        .all(existing.id)
        .map((r) => r.slug);
      if (desired !== existing.slug && taken.includes(desired)) {
        throw conflict('That slug is already in use.', { slug: 'That slug is already in use.' });
      }
      slug = desired;
    }

    db.prepare(
      `UPDATE destinations SET
         slug = @slug, name = @name, country = @country, region = @region,
         summary = @summary, description = @description, image_url = @image_url,
         gallery = @gallery, highlights = @highlights, featured = @featured,
         published = @published, sort_order = @sort_order,
         updated_at = datetime('now')
       WHERE id = @id`
    ).run({
      id: existing.id,
      slug,
      name: body.name,
      country: body.country,
      region: body.region || null,
      summary: body.summary || null,
      description: body.description || null,
      image_url: body.image_url || null,
      gallery: JSON.stringify(body.gallery || []),
      highlights: JSON.stringify(body.highlights || []),
      featured: asBool(body.featured),
      published: body.published === undefined ? asBool(existing.published) : asBool(body.published),
      sort_order: body.sort_order === undefined ? existing.sort_order : body.sort_order,
    });

    const updated = db.prepare('SELECT * FROM destinations WHERE id = ?').get(existing.id);
    return ok(res, mapDestination(updated));
  })
);

// DELETE /api/destinations/:id — packages keep their title, lose the link.
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT id FROM destinations WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound('Destination not found.');
    tx(() => {
      db.prepare('DELETE FROM destinations WHERE id = ?').run(existing.id);
    });
    return ok(res, { deleted: true, id: existing.id });
  })
);

module.exports = router;
