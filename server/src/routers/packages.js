'use strict';

/**
 * Router 3/9 — tour packages
 * Public package catalogue filtered by travel direction, duration and budget,
 * plus dashboard CRUD with duplicate, status toggles and reordering.
 */

const express = require('express');

const { db, tx } = require('../db');
const { ok, asyncHandler, notFound, conflict, badRequest } = require('../utils/http');
const { validate, slugRule } = require('../utils/validate');
const { slugify, uniqueSlug } = require('../utils/slug');
const { verifyAccessToken } = require('../utils/tokens');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const DIRECTIONS = ['SL_TO_IT', 'IT_TO_SL', 'BOTH'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'LKR'];
const PRICING_STATUSES = ['indicative', 'supplier_verified', 'unavailable'];
const PRICING_BASES = ['per_person', 'per_room', 'per_group'];
const ACCOMMODATION_CATEGORIES = ['budget', 'standard', 'superior', 'luxury', 'boutique'];

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
    archived: !!row.archived,
    itinerary: parseJson(row.itinerary, []),
    includes: parseJson(row.includes, []),
    excludes: parseJson(row.excludes, []),
    gallery: parseJson(row.gallery, []),
    destinations_list: parseJson(row.destinations_list, []),
    add_ons: parseJson(row.add_ons, []),
  };
}

/**
 * Verify the request carries a real, active admin access token. Used for
 * draft/archived visibility so a junk Authorization header can never unlock
 * unpublished content (the previous check only tested header presence).
 */
function adminFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    const user = db
      .prepare("SELECT id FROM users WHERE id = ? AND active = 1 AND role = 'admin'")
      .get(payload.sub);
    return user || null;
  } catch {
    return null;
  }
}

const rules = {
  title: { type: 'string', label: 'Title', required: true, minLength: 3, maxLength: 180 },
  direction: { type: 'string', label: 'Direction', required: true, enum: DIRECTIONS },
  destination_id: { type: 'integer', label: 'Destination', optional: true },
  summary: { type: 'string', label: 'Summary', maxLength: 500, optional: true },
  description: { type: 'string', label: 'Description', maxLength: 30000, optional: true },
  duration_days: { type: 'integer', label: 'Duration', min: 1, max: 365, optional: true },
  duration_nights: { type: 'integer', label: 'Nights', min: 0, max: 365, optional: true },
  destinations_list: {
    type: 'array',
    label: 'Destinations',
    optional: true,
    custom: (v) => {
      if (v.length > 30) return 'Destinations list may contain at most 30 entries.';
      if (v.some((s) => typeof s !== 'string' || !s.trim())) {
        return 'Destinations list entries must be non-empty text.';
      }
      return null;
    },
  },
  price_from: { type: 'number', label: 'Price', min: 0, max: 10000000, optional: true },
  price_max: { type: 'number', label: 'Maximum price', min: 0, max: 10000000, optional: true },
  currency: { type: 'string', label: 'Currency', enum: CURRENCIES, optional: true },
  pricing_status: { type: 'string', label: 'Pricing status', enum: PRICING_STATUSES, optional: true },
  pricing_basis: { type: 'string', label: 'Pricing basis', enum: PRICING_BASES, optional: true },
  occupancy_note: { type: 'string', label: 'Occupancy note', maxLength: 300, optional: true },
  accommodation: { type: 'string', label: 'Accommodation', maxLength: 4000, optional: true },
  accommodation_category: {
    type: 'string',
    label: 'Accommodation category',
    enum: ACCOMMODATION_CATEGORIES,
    optional: true,
  },
  itinerary: { type: 'array', label: 'Itinerary', optional: true },
  includes: { type: 'array', label: 'Includes', optional: true },
  excludes: { type: 'array', label: 'Excludes', optional: true },
  add_ons: {
    type: 'array',
    label: 'Add-ons',
    optional: true,
    custom: (v) => {
      if (v.length > 20) return 'Add-ons list may contain at most 20 entries.';
      for (const item of v) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return 'Each add-on must be an object with a name.';
        }
        if (typeof item.name !== 'string' || !item.name.trim()) {
          return 'Each add-on needs a name.';
        }
        if (item.price !== undefined && item.price !== null && item.price !== '') {
          const n = Number(item.price);
          if (!Number.isFinite(n) || n < 0) return 'Add-on prices must be zero or more.';
        }
        if (item.currency !== undefined && item.currency !== null && item.currency !== '' && !CURRENCIES.includes(item.currency)) {
          return 'Add-on currency must be one of: ' + CURRENCIES.join(', ') + '.';
        }
        if (item.description !== undefined && item.description !== null && typeof item.description !== 'string') {
          return 'Add-on description must be text.';
        }
      }
      return null;
    },
  },
  image_url: { type: 'string', label: 'Image', maxLength: 2000, optional: true },
  gallery: { type: 'array', label: 'Gallery', optional: true },
  group_size_min: { type: 'integer', label: 'Minimum group size', min: 1, max: 100, optional: true },
  group_size_max: { type: 'integer', label: 'Maximum group size', min: 1, max: 100, optional: true },
  seasonal_notes: { type: 'string', label: 'Seasonal notes', maxLength: 4000, optional: true },
  lead_time: { type: 'string', label: 'Booking lead time', maxLength: 4000, optional: true },
  cancellation_policy: { type: 'string', label: 'Cancellation policy', maxLength: 4000, optional: true },
  seo_title: { type: 'string', label: 'SEO title', maxLength: 160, optional: true },
  seo_description: { type: 'string', label: 'SEO description', maxLength: 320, optional: true },
  disclaimer: { type: 'string', label: 'Pricing disclaimer', maxLength: 12000, optional: true },
  featured: { type: 'boolean', label: 'Featured', optional: true },
  published: { type: 'boolean', label: 'Published', optional: true },
  archived: { type: 'boolean', label: 'Archived', optional: true },
  sort_order: { type: 'integer', label: 'Sort order', optional: true },
  slug: { ...slugRule('Slug'), optional: true },
};

/** Cross-field checks the declarative rules cannot express. */
function checkCrossFields(body) {
  const errors = {};
  if (body.price_from != null && body.price_max != null && body.price_max < body.price_from) {
    errors.price_max = 'Maximum price must be greater than or equal to the minimum price.';
  }
  if (body.group_size_min != null && body.group_size_max != null && body.group_size_max < body.group_size_min) {
    errors.group_size_max = 'Maximum group size must be at least the minimum.';
  }
  if (body.duration_nights != null && body.duration_days != null && body.duration_nights >= body.duration_days) {
    errors.duration_nights = 'Nights must be fewer than days.';
  }
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
}

/** Normalise add-on rows before persistence (numeric price, trimmed strings). */
function normaliseAddOns(list) {
  return (list || []).map((item) => ({
    name: String(item.name).trim(),
    price:
      item.price === undefined || item.price === null || item.price === ''
        ? undefined
        : Number(item.price),
    currency: item.currency || undefined,
    description: item.description || undefined,
  }));
}

const asBool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

/** Nullable numeric/text column value: missing or empty string → null, 0 preserved. */
const orNull = (v) => (v === undefined || v === null || v === '' ? null : v);

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

/** Duration buckets for the public catalogue filter (days). */
const DURATION_CLAUSE = {
  short: 'p.duration_days <= 7',
  medium: 'p.duration_days BETWEEN 8 AND 10',
  long: 'p.duration_days >= 11',
};

/**
 * Budget buckets compare raw price_from numbers (no FX conversion) —
 * a marketing filter, not a currency-aware query.
 */
const BUDGET_CLAUSE = {
  value: 'p.price_from < 1000',
  standard: 'p.price_from BETWEEN 1000 AND 1800',
  premium: 'p.price_from > 1800',
};

// GET /api/packages
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const direction = DIRECTIONS.includes(req.query.direction) ? req.query.direction : null;
    const destinationId = parseInt(req.query.destination_id, 10);
    const featured = req.query.featured === '1';
    const includeAll = req.query.all === '1' && !!adminFromRequest(req);
    const duration = DURATION_CLAUSE[req.query.duration] ? req.query.duration : null;
    const budget = BUDGET_CLAUSE[req.query.budget] ? req.query.budget : null;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = {};

    if (!includeAll) where.push('p.published = 1 AND p.archived = 0');
    if (direction) {
      where.push(DIRECTION_CLAUSE[direction].replace(/\bdirection\b/g, 'p.direction'));
    }
    if (Number.isFinite(destinationId)) {
      where.push('p.destination_id = @destinationId');
      params.destinationId = destinationId;
    }
    if (featured) where.push('p.featured = 1');
    if (duration) where.push(DURATION_CLAUSE[duration]);
    if (budget) where.push(BUDGET_CLAUSE[budget]);
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
    if ((!row.published || row.archived) && !adminFromRequest(req)) throw notFound('Package not found.');

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
    checkCrossFields(body);

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
           (slug, title, direction, destination_id, summary, description, duration_days, duration_nights,
            destinations_list, price_from, price_max, currency, pricing_status, pricing_basis, occupancy_note,
            accommodation, accommodation_category, itinerary, includes, excludes, add_ons,
            image_url, gallery, group_size_min, group_size_max, seasonal_notes, lead_time,
            cancellation_policy, seo_title, seo_description, disclaimer, featured, published, archived, sort_order)
         VALUES (@slug, @title, @direction, @destination_id, @summary, @description, @duration_days, @duration_nights,
                 @destinations_list, @price_from, @price_max, @currency, @pricing_status, @pricing_basis, @occupancy_note,
                 @accommodation, @accommodation_category, @itinerary, @includes, @excludes, @add_ons,
                 @image_url, @gallery, @group_size_min, @group_size_max, @seasonal_notes, @lead_time,
                 @cancellation_policy, @seo_title, @seo_description, @disclaimer, @featured, @published, @archived, @sort_order)`
      )
      .run({
        slug,
        title: body.title,
        direction: body.direction,
        destination_id: body.destination_id || null,
        summary: body.summary || null,
        description: body.description || null,
        duration_days: body.duration_days || null,
        duration_nights: orNull(body.duration_nights),
        destinations_list: JSON.stringify(body.destinations_list || []),
        price_from: orNull(body.price_from),
        price_max: orNull(body.price_max),
        currency: body.currency || 'EUR',
        pricing_status: body.pricing_status || 'indicative',
        pricing_basis: body.pricing_basis || 'per_person',
        occupancy_note: body.occupancy_note || null,
        accommodation: body.accommodation || null,
        accommodation_category: body.accommodation_category || null,
        itinerary: JSON.stringify(body.itinerary || []),
        includes: JSON.stringify(body.includes || []),
        excludes: JSON.stringify(body.excludes || []),
        add_ons: JSON.stringify(normaliseAddOns(body.add_ons)),
        image_url: body.image_url || null,
        gallery: JSON.stringify(body.gallery || []),
        group_size_min: orNull(body.group_size_min),
        group_size_max: orNull(body.group_size_max),
        seasonal_notes: body.seasonal_notes || null,
        lead_time: body.lead_time || null,
        cancellation_policy: body.cancellation_policy || null,
        seo_title: body.seo_title || null,
        seo_description: body.seo_description || null,
        disclaimer: body.disclaimer || null,
        featured: asBool(body.featured),
        published: body.published === undefined ? 1 : asBool(body.published),
        archived: asBool(body.archived),
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
    checkCrossFields(body);

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
         duration_nights = @duration_nights, destinations_list = @destinations_list,
         price_from = @price_from, price_max = @price_max, currency = @currency,
         pricing_status = @pricing_status, pricing_basis = @pricing_basis, occupancy_note = @occupancy_note,
         accommodation = @accommodation, accommodation_category = @accommodation_category,
         itinerary = @itinerary, includes = @includes, excludes = @excludes, add_ons = @add_ons,
         image_url = @image_url, gallery = @gallery,
         group_size_min = @group_size_min, group_size_max = @group_size_max,
         seasonal_notes = @seasonal_notes, lead_time = @lead_time, cancellation_policy = @cancellation_policy,
         seo_title = @seo_title, seo_description = @seo_description, disclaimer = @disclaimer,
         featured = @featured, published = @published, archived = @archived,
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
      duration_nights: orNull(body.duration_nights),
      destinations_list: JSON.stringify(body.destinations_list || []),
      price_from: orNull(body.price_from),
      price_max: orNull(body.price_max),
      currency: body.currency || existing.currency,
      pricing_status: body.pricing_status || 'indicative',
      pricing_basis: body.pricing_basis || 'per_person',
      occupancy_note: body.occupancy_note || null,
      accommodation: body.accommodation || null,
      accommodation_category: body.accommodation_category || null,
      itinerary: JSON.stringify(body.itinerary || []),
      includes: JSON.stringify(body.includes || []),
      excludes: JSON.stringify(body.excludes || []),
      add_ons: JSON.stringify(normaliseAddOns(body.add_ons)),
      image_url: body.image_url || null,
      gallery: JSON.stringify(body.gallery || []),
      group_size_min: orNull(body.group_size_min),
      group_size_max: orNull(body.group_size_max),
      seasonal_notes: body.seasonal_notes || null,
      lead_time: body.lead_time || null,
      cancellation_policy: body.cancellation_policy || null,
      seo_title: body.seo_title || null,
      seo_description: body.seo_description || null,
      disclaimer: body.disclaimer || null,
      featured: body.featured === undefined ? asBool(existing.featured) : asBool(body.featured),
      published: body.published === undefined ? asBool(existing.published) : asBool(body.published),
      archived: body.archived === undefined ? asBool(existing.archived) : asBool(body.archived),
      sort_order: body.sort_order === undefined ? existing.sort_order : body.sort_order,
    });

    const updated = db.prepare(`${SELECT_WITH_DESTINATION} WHERE p.id = ?`).get(existing.id);
    return ok(res, mapPackage(updated));
  })
);

// PATCH /api/packages/:id/status — publish/feature/archive quick actions.
router.patch(
  '/:id/status',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!existing) throw notFound('Package not found.');

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined && body[k] !== null;

    if (!has('published') && !has('featured') && !has('archived')) {
      throw badRequest('Expected at least one of published, featured or archived.');
    }

    const published = has('published') ? asBool(body.published) : existing.published;
    const featured = has('featured') ? asBool(body.featured) : existing.featured;
    const archived = has('archived') ? asBool(body.archived) : existing.archived;

    db.prepare(
      `UPDATE packages SET published = ?, featured = ?, archived = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(published, featured, archived, existing.id);

    const updated = db.prepare(`${SELECT_WITH_DESTINATION} WHERE p.id = ?`).get(existing.id);
    return ok(res, mapPackage(updated));
  })
);

// POST /api/packages/reorder — rewrite sort_order from an ordered id list.
router.post(
  '/reorder',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const ids = Array.isArray(body.ids) ? body.ids.map((n) => Number(n)).filter(Number.isInteger) : null;
    if (!ids || ids.length === 0) {
      throw badRequest('Expected a non-empty ids array in the request body.');
    }

    const known = new Set(db.prepare('SELECT id FROM packages').all().map((r) => r.id));
    let updated = 0;
    tx(() => {
      const stmt = db.prepare('UPDATE packages SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ?');
      ids.forEach((id, index) => {
        if (known.has(id)) {
          stmt.run(index, id);
          updated += 1;
        }
      });
    });
    return ok(res, { updated });
  })
);

// POST /api/packages/:id/duplicate — copy as a new unpublished draft.
router.post(
  '/:id/duplicate',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const source = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id);
    if (!source) throw notFound('Package not found.');

    const desired = slugify(`${source.slug}-copy`);
    const taken = db.prepare('SELECT slug FROM packages').all().map((r) => r.slug);
    const slug = uniqueSlug(desired, taken);

    const info = db
      .prepare(
        `INSERT INTO packages
           (slug, title, direction, destination_id, summary, description, duration_days, duration_nights,
            destinations_list, price_from, price_max, currency, pricing_status, pricing_basis, occupancy_note,
            accommodation, accommodation_category, itinerary, includes, excludes, add_ons,
            image_url, gallery, group_size_min, group_size_max, seasonal_notes, lead_time,
            cancellation_policy, seo_title, seo_description, disclaimer,
            featured, published, archived, sort_order, created_at, updated_at)
         VALUES (@slug, @title, @direction, @destination_id, @summary, @description, @duration_days, @duration_nights,
                 @destinations_list, @price_from, @price_max, @currency, @pricing_status, @pricing_basis, @occupancy_note,
                 @accommodation, @accommodation_category, @itinerary, @includes, @excludes, @add_ons,
                 @image_url, @gallery, @group_size_min, @group_size_max, @seasonal_notes, @lead_time,
                 @cancellation_policy, @seo_title, @seo_description, @disclaimer,
                 0, 0, 0, 0, datetime('now'), datetime('now'))`
      )
      .run({
        slug,
        title: `${source.title} (Copy)`,
        direction: source.direction,
        destination_id: source.destination_id,
        summary: source.summary,
        description: source.description,
        duration_days: source.duration_days,
        duration_nights: source.duration_nights,
        destinations_list: source.destinations_list || '[]',
        price_from: source.price_from,
        price_max: source.price_max,
        currency: source.currency,
        pricing_status: source.pricing_status,
        pricing_basis: source.pricing_basis,
        occupancy_note: source.occupancy_note,
        accommodation: source.accommodation,
        accommodation_category: source.accommodation_category,
        itinerary: source.itinerary,
        includes: source.includes,
        excludes: source.excludes,
        add_ons: source.add_ons,
        image_url: source.image_url,
        gallery: source.gallery,
        group_size_min: source.group_size_min,
        group_size_max: source.group_size_max,
        seasonal_notes: source.seasonal_notes,
        lead_time: source.lead_time,
        cancellation_policy: source.cancellation_policy,
        seo_title: source.seo_title,
        seo_description: source.seo_description,
        disclaimer: source.disclaimer,
      });

    const copy = db.prepare(`${SELECT_WITH_DESTINATION} WHERE p.id = ?`).get(info.lastInsertRowid);
    return ok(res, mapPackage(copy));
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
