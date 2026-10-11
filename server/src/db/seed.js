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
const { seedDestinations, seedPackages } = require('./sampleData');

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
  const destCount = db.prepare('SELECT COUNT(*) AS n FROM destinations').get().n;
  const pkgCount = db.prepare('SELECT COUNT(*) AS n FROM packages').get().n;

  if (destCount > 0 || pkgCount > 0) {
    console.log(`• Sample content skipped (${destCount} destinations, ${pkgCount} packages already present).`);
    return;
  }

  const { destinations, packages } = seedDestinations();
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

    const slugToId = new Map(db.prepare('SELECT id, slug FROM destinations').all().map((r) => [r.slug, r.id]));
    const insertPkg = db.prepare(
      `INSERT INTO packages
         (slug, title, direction, destination_id, summary, description, duration_days, price_from, currency,
          itinerary, includes, excludes, image_url, gallery, featured, published, sort_order)
       VALUES (@slug, @title, @direction, @destination_id, @summary, @description, @duration_days, @price_from, @currency,
               @itinerary, @includes, @excludes, @image_url, @gallery, @featured, 1, @sort_order)`
    );
    packages.forEach((p, i) => {
      insertPkg.run({
        ...p,
        destination_id: p.destination_slug ? (slugToId.get(p.destination_slug) || null) : null,
        itinerary: JSON.stringify(p.itinerary || []),
        includes: JSON.stringify(p.includes || []),
        excludes: JSON.stringify(p.excludes || []),
        gallery: JSON.stringify(p.gallery || []),
        featured: p.featured ? 1 : 0,
        sort_order: i,
        destination_slug: undefined,
      });
    });
  });

  console.log(`• Sample content: ${destinations.length} destinations, ${packages.length} packages.`);
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
