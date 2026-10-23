'use strict';

/**
 * Seed script: idempotent. Run with `npm run seed`.
 * Creates the administrator account and default business settings without
 * overwriting anything an administrator has already changed.
 */

const bcrypt = require('bcryptjs');
const config = require('../config');
const { db, tx, setSetting, getSetting } = require('./index');
const { DEFAULT_SETTINGS } = require('../settings/defaults');
const { seedDestinations } = require('./sampleData');

function seedAdmin() {
  const email = config.auth.admin.email.toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (existing) {
    console.log(`• Admin account already exists: ${email}`);
    return existing.id;
  }

  const hash = bcrypt.hashSync(config.auth.admin.password, 12);
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, active)
       VALUES (?, ?, ?, 'admin', 1)`
    )
    .run(email, hash, config.auth.admin.name);

  console.log(`• Created admin account: ${email}`);
  if (config.auth.admin.password === 'ChangeMe123!') {
    console.warn('  ⚠ ADMIN_PASSWORD is still the default. Change it after the first sign-in.');
  }
  return info.lastInsertRowid;
}

function seedSettings() {
  let created = 0;
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    // getSetting returns null only when the row is absent; never clobber.
    if (getSetting(key) === null) {
      setSetting(key, value);
      created += 1;
    }
  }
  console.log(`• Settings: ${created} default${created === 1 ? '' : 's'} written, ${Object.keys(DEFAULT_SETTINGS).length - created} preserved.`);
}

function seedSampleContent() {
  const { destinations, packages } = seedDestinations();

  // Destinations: insert only when the table is empty (never clobber admin edits).
  const destCount = db.prepare('SELECT COUNT(*) AS n FROM destinations').get().n;
  if (destCount === 0) {
    tx(() => {
      const insertDest = db.prepare(
        `INSERT INTO destinations
           (slug, name, country, region, summary, description, image_url, gallery, highlights, featured, published, sort_order)
         VALUES (@slug, @name, @country, @region, @summary, @description, @image_url, @gallery, @highlights, @featured, 1, @sort_order)`
      );
      destinations.forEach((d, i) => {
        insertDest.run({
          ...d,
          gallery: JSON.stringify(d.gallery || []),
          highlights: JSON.stringify(d.highlights || []),
          featured: d.featured ? 1 : 0,
          sort_order: i,
        });
      });
    });
    console.log(`• Sample destinations: ${destinations.length} inserted.`);
  } else {
    console.log(`• Sample destinations skipped (${destCount} already present).`);
  }

  // Packages: slug-if-missing, so existing databases gain any sample package
  // they do not have yet (e.g. the USD catalog) without touching admin edits.
  const slugToId = new Map(db.prepare('SELECT id, slug FROM destinations').all().map((r) => [r.slug, r.id]));
  const nextSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM packages').get().n;

  let inserted = 0;
  let skipped = 0;
  tx(() => {
    const exists = db.prepare('SELECT id FROM packages WHERE slug = ?');
    const insertPkg = db.prepare(
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
               @cancellation_policy, @seo_title, @seo_description, @disclaimer, @featured, 1, 0, @sort_order)`
    );
    packages.forEach((p, i) => {
      if (exists.get(p.slug)) {
        skipped += 1;
        return;
      }
      insertPkg.run({
        slug: p.slug,
        title: p.title,
        direction: p.direction,
        destination_id: p.destination_slug ? (slugToId.get(p.destination_slug) || null) : null,
        summary: p.summary || null,
        description: p.description || null,
        duration_days: p.duration_days || null,
        duration_nights: p.duration_nights === undefined ? null : p.duration_nights,
        destinations_list: JSON.stringify(p.destinations_list || []),
        price_from: p.price_from === undefined ? null : p.price_from,
        price_max: p.price_max === undefined ? null : p.price_max,
        currency: p.currency || 'EUR',
        pricing_status: p.pricing_status || 'indicative',
        pricing_basis: p.pricing_basis || 'per_person',
        occupancy_note: p.occupancy_note || null,
        accommodation: p.accommodation || null,
        accommodation_category: p.accommodation_category || null,
        itinerary: JSON.stringify(p.itinerary || []),
        includes: JSON.stringify(p.includes || []),
        excludes: JSON.stringify(p.excludes || []),
        add_ons: JSON.stringify(p.add_ons || []),
        image_url: p.image_url || null,
        gallery: JSON.stringify(p.gallery || []),
        group_size_min: p.group_size_min === undefined ? null : p.group_size_min,
        group_size_max: p.group_size_max === undefined ? null : p.group_size_max,
        seasonal_notes: p.seasonal_notes || null,
        lead_time: p.lead_time || null,
        cancellation_policy: p.cancellation_policy || null,
        seo_title: p.seo_title || null,
        seo_description: p.seo_description || null,
        disclaimer: p.disclaimer || null,
        featured: p.featured ? 1 : 0,
        sort_order: nextSort + i,
      });
      inserted += 1;
    });
  });

  console.log(`• Sample packages: ${inserted} inserted, ${skipped} already present.`);
}

function main() {
  console.log('Seeding database at', config.db.file);
  seedAdmin();
  seedSettings();
  seedSampleContent();
  console.log('Done.');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

module.exports = { seedAdmin, seedSettings, seedSampleContent };
