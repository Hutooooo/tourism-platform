'use strict';

/**
 * Editable package catalog: CRUD round-trips, cross-field validation,
 * archive/publish visibility, duplicate/reorder, duration+budget filters,
 * booking linkage and the site-wide pricing disclaimer.
 *
 * Separate process from api.test.js (startApp may only boot once per
 * process). The harness seeds only admin + settings, so every package used
 * here is created through the API.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { startApp, createClient } = require('./helpers');

const ADMIN_EMAIL = 'admin@test.local';
const ADMIN_PASSWORD = 'TestPass123!';

const PRICING_DISCLAIMER =
  'Prices are indicative estimates and may change according to travel dates, seasonality, accommodation availability, airline fares, exchange rates, group size, transport costs, taxes, supplier rates, and itinerary changes. Unless expressly listed as included, international flights, visa or travel authorization fees, travel insurance, personal expenses, optional excursions, and unspecified services are excluded. A final quotation and availability must be confirmed before booking. A booking is not confirmed until the itinerary, price, payment terms, and cancellation conditions have been agreed.';

let ctx;
let anon;
let admin;

test.before(async () => {
  ctx = await startApp();
  anon = createClient(ctx.url);
  admin = createClient(ctx.url);

  const login = await admin.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert.equal(login.status, 200, `login failed: ${JSON.stringify(login.body)}`);
});

test.after(async () => {
  if (ctx) await ctx.close();
});

/** Minimal valid payload; every other field is optional. */
function basePkg(overrides = {}) {
  return {
    title: 'Catalog Fixture Tour',
    direction: 'SL_TO_IT',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Full-field create / update round-trip
// ---------------------------------------------------------------------------

let fullPkgId;
let fullPkgSlug;

test('packages-catalog: create with every extended field and read it back', async () => {
  const res = await admin.post(
    '/packages',
    basePkg({
      slug: 'full-field-tour',
      title: 'Full Field Tour',
      summary: 'A tour that exercises every column.',
      description: 'Long description.\n\nSecond paragraph.',
      duration_days: 8,
      duration_nights: 7,
      destinations_list: ['Rome', 'Florence', 'Venice'],
      price_from: 1500,
      price_max: 2400,
      currency: 'USD',
      pricing_status: 'indicative',
      pricing_basis: 'per_person',
      occupancy_note: 'Per person, double occupancy.',
      accommodation: '4-star boutique hotels',
      accommodation_category: 'boutique',
      itinerary: [
        { day: 1, title: 'Arrive Rome', detail: 'Airport transfer.', image: '/api/media/day1.jpg' },
        { day: 2, title: 'Florence', detail: 'Uffizi skip-the-line.' },
      ],
      includes: ['Hotels', 'Transfers', 'Breakfast'],
      excludes: ['International flights'],
      add_ons: [
        { name: 'Private guide', price: 120, currency: 'USD', description: 'Half-day' },
        { name: 'Wine tasting', price: 45 },
      ],
      image_url: '/api/media/cover.jpg',
      gallery: ['/api/media/g1.jpg', '/api/media/g2.jpg'],
      group_size_min: 2,
      group_size_max: 12,
      seasonal_notes: 'Best March–May and September–November.',
      lead_time: '3 weeks recommended.',
      cancellation_policy: 'Free cancellation up to 30 days before departure.',
      seo_title: 'Full Field Tour — Rome & Florence',
      seo_description: 'SEO description for the full field tour.',
      disclaimer: 'Custom package disclaimer.',
      featured: true,
      published: true,
    })
  );

  assert.equal(res.status, 200, JSON.stringify(res.body));
  const p = res.body.data;
  fullPkgId = p.id;
  fullPkgSlug = p.slug;

  assert.equal(p.slug, 'full-field-tour');
  assert.equal(p.duration_nights, 7);
  assert.deepEqual(p.destinations_list, ['Rome', 'Florence', 'Venice']);
  assert.equal(p.price_from, 1500);
  assert.equal(p.price_max, 2400);
  assert.equal(p.currency, 'USD');
  assert.equal(p.pricing_status, 'indicative');
  assert.equal(p.pricing_basis, 'per_person');
  assert.equal(p.occupancy_note, 'Per person, double occupancy.');
  assert.equal(p.accommodation, '4-star boutique hotels');
  assert.equal(p.accommodation_category, 'boutique');
  assert.equal(p.itinerary.length, 2);
  assert.equal(p.itinerary[0].image, '/api/media/day1.jpg');
  assert.equal(p.add_ons.length, 2);
  assert.equal(p.add_ons[0].name, 'Private guide');
  assert.equal(p.add_ons[0].price, 120);
  assert.equal(p.group_size_min, 2);
  assert.equal(p.group_size_max, 12);
  assert.equal(p.seasonal_notes, 'Best March–May and September–November.');
  assert.equal(p.lead_time, '3 weeks recommended.');
  assert.equal(p.cancellation_policy, 'Free cancellation up to 30 days before departure.');
  assert.equal(p.seo_title, 'Full Field Tour — Rome & Florence');
  assert.equal(p.seo_description, 'SEO description for the full field tour.');
  assert.equal(p.disclaimer, 'Custom package disclaimer.');
  assert.equal(p.featured, true);
  assert.equal(p.published, true);
  assert.equal(p.archived, false);

  // Public detail carries the same values.
  const pub = await anon.get(`/packages/${fullPkgSlug}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.data.price_max, 2400);
  assert.deepEqual(pub.body.data.destinations_list, ['Rome', 'Florence', 'Venice']);
  assert.equal(pub.body.data.disclaimer, 'Custom package disclaimer.');
});

test('packages-catalog: update changes price range and status without losing the slug', async () => {
  const res = await admin.put(`/packages/${fullPkgId}`, basePkg({
    slug: 'full-field-tour',
    title: 'Full Field Tour',
    duration_days: 8,
    duration_nights: 7,
    destinations_list: ['Rome', 'Florence'],
    price_from: 1600,
    price_max: 2600,
    currency: 'USD',
    pricing_status: 'supplier_verified',
  }));

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.slug, 'full-field-tour');
  assert.equal(res.body.data.price_from, 1600);
  assert.equal(res.body.data.price_max, 2600);
  assert.equal(res.body.data.pricing_status, 'supplier_verified');

  const pub = await anon.get(`/packages/full-field-tour`);
  assert.equal(pub.body.data.price_max, 2600);
});

// ---------------------------------------------------------------------------
// Cross-field validation
// ---------------------------------------------------------------------------

test('packages-catalog: price_max below price_from is rejected', async () => {
  const res = await admin.post('/packages', basePkg({
    title: 'Bad Price Range',
    price_from: 2000,
    price_max: 1000,
    currency: 'USD',
  }));
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.price_max);
});

test('packages-catalog: group_size_max below group_size_min is rejected', async () => {
  const res = await admin.post('/packages', basePkg({
    title: 'Bad Group Size',
    group_size_min: 10,
    group_size_max: 2,
  }));
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.group_size_max);
});

test('packages-catalog: duration_nights must be fewer than duration_days', async () => {
  const res = await admin.post('/packages', basePkg({
    title: 'Bad Nights',
    duration_days: 5,
    duration_nights: 5,
  }));
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.duration_nights);
});

// ---------------------------------------------------------------------------
// Enum validation
// ---------------------------------------------------------------------------

test('packages-catalog: unknown pricing_status / basis / category are rejected', async () => {
  const bad = await admin.post('/packages', basePkg({
    title: 'Bad Enums',
    pricing_status: 'made_up',
  }));
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error.details.pricing_status);

  const badBasis = await admin.put(`/packages/${fullPkgId}`, basePkg({
    slug: 'full-field-tour',
    title: 'Full Field Tour',
    duration_days: 8,
    duration_nights: 7,
    price_from: 1600,
    price_max: 2600,
    currency: 'USD',
    pricing_basis: 'per_night',
  }));
  assert.equal(badBasis.status, 400);
  assert.ok(badBasis.body.error.details.pricing_basis);

  const badCat = await admin.put(`/packages/${fullPkgId}`, basePkg({
    slug: 'full-field-tour',
    title: 'Full Field Tour',
    duration_days: 8,
    duration_nights: 7,
    price_from: 1600,
    price_max: 2600,
    currency: 'USD',
    accommodation_category: 'palace',
  }));
  assert.equal(badCat.status, 400);
  assert.ok(badCat.body.error.details.accommodation_category);
});

// ---------------------------------------------------------------------------
// Auth: anonymous mutations rejected, junk bearer rejected
// ---------------------------------------------------------------------------

test('packages-catalog: anonymous mutations are refused (401), including new endpoints', async () => {
  const cases = [
    ['post', '/packages', basePkg({ title: 'Anon Create' })],
    ['put', `/packages/${fullPkgId}`, basePkg({ title: 'Anon Update' })],
    ['patch', `/packages/${fullPkgId}/status`, { published: false }],
    ['post', '/packages/reorder', { ids: [1] }],
    ['post', `/packages/${fullPkgId}/duplicate`, {}],
    ['delete', `/packages/${fullPkgId}`, undefined],
  ];

  for (const [method, path, body] of cases) {
    const res = await anon.request(method.toUpperCase(), path, { body });
    assert.equal(res.status, 401, `${method.toUpperCase()} ${path} should be 401, got ${res.status}`);
  }
});

test('packages-catalog: junk Authorization header cannot unlock drafts', async () => {
  const draft = await admin.post('/packages', basePkg({
    title: 'Hidden Draft Catalog',
    direction: 'IT_TO_SL',
    published: false,
    duration_days: 4,
    duration_nights: 3,
  }));
  assert.equal(draft.status, 200, JSON.stringify(draft.body));
  const draftSlug = draft.body.data.slug;

  // Detail: anonymous and junk-bearer both get 404.
  assert.equal((await anon.get(`/packages/${draftSlug}`)).status, 404);
  const junk = await anon.get(`/packages/${draftSlug}`, {
    headers: { Authorization: 'Bearer garbage-token' },
  });
  assert.equal(junk.status, 404);

  // List with ?all=1: junk bearer must not reveal drafts.
  const junkList = await anon.get('/packages?all=1', {
    headers: { Authorization: 'Bearer garbage-token' },
  });
  assert.equal(junkList.status, 200);
  assert.ok(
    junkList.body.data.every((p) => p.published === true),
    'junk bearer must not see drafts via ?all=1'
  );

  // Real admin sees the draft.
  const adminView = await admin.get(`/packages/${draftSlug}`);
  assert.equal(adminView.status, 200);
  assert.equal(adminView.body.data.published, false);
});

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

test('packages-catalog: duplicate copies as an unpublished draft with -copy slug', async () => {
  const res = await admin.post(`/packages/${fullPkgId}/duplicate`, {});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const copy = res.body.data;

  assert.equal(copy.slug, 'full-field-tour-copy');
  assert.equal(copy.title, 'Full Field Tour (Copy)');
  assert.equal(copy.published, false);
  assert.equal(copy.archived, false);
  assert.equal(copy.featured, false);
  assert.equal(copy.price_from, 1600);
  assert.equal(copy.price_max, 2600);
  assert.equal(copy.duration_nights, 7);
  assert.deepEqual(copy.destinations_list, ['Rome', 'Florence']);

  // Invisible to the public until published.
  assert.equal((await anon.get('/packages/full-field-tour-copy')).status, 404);

  // A second duplicate gets a unique slug, not a 409.
  const again = await admin.post(`/packages/${fullPkgId}/duplicate`, {});
  assert.equal(again.status, 200);
  assert.equal(again.body.data.slug, 'full-field-tour-copy-2');

  // Anonymous duplicate is refused.
  assert.equal((await anon.post(`/packages/${fullPkgId}/duplicate`, {})).status, 401);
});

// ---------------------------------------------------------------------------
// Archived packages leave the public surface
// ---------------------------------------------------------------------------

let archiveSlug;

test('packages-catalog: archive removes a package from public list, detail and bookings', async () => {
  const created = await admin.post('/packages', basePkg({
    slug: 'archived-tour',
    title: 'Archived Tour',
    duration_days: 6,
    duration_nights: 5,
    price_from: 900,
    currency: 'USD',
    published: true,
  }));
  archiveSlug = created.body.data.slug;

  // Visible while published and unarchived.
  assert.equal((await anon.get(`/packages/${archiveSlug}`)).status, 200);

  const patched = await admin.patch(`/packages/${created.body.data.id}/status`, { archived: true });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.archived, true);

  // Public list and detail no longer include it.
  const list = await anon.get('/packages');
  assert.ok(!list.body.data.some((p) => p.slug === archiveSlug), 'archived package leaked into public list');
  assert.equal((await anon.get(`/packages/${archiveSlug}`)).status, 404);

  // Admin ?all=1 still sees it.
  const all = await admin.get('/packages?all=1');
  assert.ok(all.body.data.some((p) => p.slug === archiveSlug && p.archived === true));

  // Bookings reject the archived slug.
  const booking = await anon.post('/bookings', {
    name: 'Archive Test',
    email: 'archive@example.com',
    package_slug: archiveSlug,
  });
  assert.equal(booking.status, 400);
  assert.ok(booking.body.error.details.package_slug);
});

test('packages-catalog: unarchive restores public visibility', async () => {
  const list = await admin.get('/packages?all=1');
  const target = list.body.data.find((p) => p.slug === archiveSlug);
  const res = await admin.patch(`/packages/${target.id}/status`, { archived: false });
  assert.equal(res.status, 200);
  assert.equal((await anon.get(`/packages/${archiveSlug}`)).status, 200);
});

// ---------------------------------------------------------------------------
// Status endpoint edge cases
// ---------------------------------------------------------------------------

test('packages-catalog: PATCH status requires at least one flag', async () => {
  const res = await admin.patch(`/packages/${fullPkgId}/status`, {});
  assert.equal(res.status, 400);
});

test('packages-catalog: PATCH status can toggle published and featured independently', async () => {
  const unpublish = await admin.patch(`/packages/${fullPkgId}/status`, { published: false });
  assert.equal(unpublish.status, 200);
  assert.equal(unpublish.body.data.published, false);
  assert.equal(unpublish.body.data.featured, true, 'featured must survive an unpublish');

  const republish = await admin.patch(`/packages/${fullPkgId}/status`, { published: true });
  assert.equal(republish.body.data.published, true);
  assert.equal(republish.body.data.featured, true);
});

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------

test('packages-catalog: reorder rewrites sort_order from an id list', async () => {
  const before = await admin.get('/packages?all=1');
  const ids = before.body.data.slice(0, 3).map((p) => p.id);
  assert.equal(ids.length, 3, 'need at least three packages to reorder');

  const reversed = [...ids].reverse();
  const res = await admin.post('/packages/reorder', { ids: reversed });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.updated, 3);

  const after = await admin.get('/packages?all=1');
  const order = after.body.data
    .filter((p) => reversed.includes(p.id))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => p.id);
  assert.deepEqual(order, reversed);
});

test('packages-catalog: reorder rejects a missing or empty ids array', async () => {
  assert.equal((await admin.post('/packages/reorder', {})).status, 400);
  assert.equal((await admin.post('/packages/reorder', { ids: [] })).status, 400);
  assert.equal((await admin.post('/packages/reorder', { ids: 'nope' })).status, 400);
});

// ---------------------------------------------------------------------------
// Duration + budget filters
// ---------------------------------------------------------------------------

test('packages-catalog: duration and budget filters apply to the public list', async () => {
  // Fresh fixtures with known durations/prices so the seed set cannot skew results.
  const fixtures = [
    { title: 'Filter Short Value', duration_days: 5, duration_nights: 4, price_from: 500, currency: 'USD', published: true },
    { title: 'Filter Medium Standard', duration_days: 9, duration_nights: 8, price_from: 1400, currency: 'USD', published: true },
    { title: 'Filter Long Premium', duration_days: 14, duration_nights: 13, price_from: 2500, currency: 'USD', published: true },
  ];
  for (const f of fixtures) {
    const res = await admin.post('/packages', basePkg(f));
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }

  const short = await anon.get('/packages?duration=short');
  assert.ok(short.body.data.every((p) => p.duration_days <= 7));
  assert.ok(short.body.data.some((p) => p.title === 'Filter Short Value'));
  assert.ok(!short.body.data.some((p) => p.title === 'Filter Long Premium'));

  const medium = await anon.get('/packages?duration=medium');
  assert.ok(medium.body.data.every((p) => p.duration_days >= 8 && p.duration_days <= 10));
  assert.ok(medium.body.data.some((p) => p.title === 'Filter Medium Standard'));

  const long = await anon.get('/packages?duration=long');
  assert.ok(long.body.data.every((p) => p.duration_days >= 11));
  assert.ok(long.body.data.some((p) => p.title === 'Filter Long Premium'));

  const value = await anon.get('/packages?budget=value');
  assert.ok(value.body.data.every((p) => p.price_from < 1000));
  assert.ok(value.body.data.some((p) => p.title === 'Filter Short Value'));

  const standard = await anon.get('/packages?budget=standard');
  assert.ok(standard.body.data.every((p) => p.price_from >= 1000 && p.price_from <= 1800));
  assert.ok(standard.body.data.some((p) => p.title === 'Filter Medium Standard'));

  const premium = await anon.get('/packages?budget=premium');
  assert.ok(premium.body.data.every((p) => p.price_from > 1800));
  assert.ok(premium.body.data.some((p) => p.title === 'Filter Long Premium'));

  // Combined filters narrow further.
  const both = await anon.get('/packages?direction=SL_TO_IT&duration=short&budget=value');
  assert.ok(both.body.data.every((p) => p.direction !== 'IT_TO_SL'));
  assert.ok(both.body.data.every((p) => p.duration_days <= 7 && p.price_from < 1000));
  assert.ok(both.body.data.some((p) => p.title === 'Filter Short Value'));
});

// ---------------------------------------------------------------------------
// Booking linkage
// ---------------------------------------------------------------------------

test('packages-catalog: enquiry via a package slug stores the package title and BK reference', async () => {
  const res = await anon.post('/bookings', {
    name: 'Catalog Buyer',
    email: 'catalog.buyer@example.com',
    phone: '+39 321 111 2222',
    travel_date: '2027-06-01',
    adults: 2,
    package_slug: fullPkgSlug,
    notes: 'Please quote the Full Field Tour.',
  });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.data.reference, /^BK-\d{5}$/);
  assert.equal(res.body.data.status, 'pending');

  const list = await admin.get('/bookings');
  const row = list.body.data.find((b) => b.email === 'catalog.buyer@example.com');
  assert.ok(row, 'booking should appear in the admin list');
  assert.equal(row.package_title, 'Full Field Tour');
});

// ---------------------------------------------------------------------------
// Pricing disclaimer setting
// ---------------------------------------------------------------------------

test('packages-catalog: seeded pricing disclaimer is the exact required text', async () => {
  const res = await anon.get('/settings');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.pricing_disclaimer, PRICING_DISCLAIMER);
});

test('packages-catalog: admin can update the pricing disclaimer; public sees it', async () => {
  const updated = `${PRICING_DISCLAIMER} Updated for the 2027 season.`;
  const put = await admin.put('/settings', { pricing_disclaimer: updated });
  assert.equal(put.status, 200, JSON.stringify(put.body));

  const pub = await anon.get('/settings');
  assert.equal(pub.body.data.pricing_disclaimer, updated);

  // Restore the canonical text so later assertions (and other suites' data
  // expectations) are not polluted by this test's edit.
  const restore = await admin.put('/settings', { pricing_disclaimer: PRICING_DISCLAIMER });
  assert.equal(restore.status, 200);
});

test('packages-catalog: anonymous settings update is refused', async () => {
  const res = await anon.put('/settings', { pricing_disclaimer: 'Anon edit attempt.' });
  assert.equal(res.status, 401);
});

test('packages-catalog: pricing disclaimer over 12000 characters is rejected', async () => {
  const res = await admin.put('/settings', { pricing_disclaimer: 'x'.repeat(12001) });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.pricing_disclaimer);
});

test('packages-catalog: package-level disclaimer overrides the site-wide one in the detail payload', async () => {
  // PUT replaces the full record, so set the override on a dedicated fixture
  // rather than relying on an earlier payload that later tests rewrote.
  const withOverride = await admin.post('/packages', basePkg({
    slug: 'disclaimer-override-tour',
    title: 'Disclaimer Override Tour',
    duration_days: 3,
    duration_nights: 2,
    published: true,
    disclaimer: 'Custom package disclaimer.',
  }));
  assert.equal(withOverride.body.data.disclaimer, 'Custom package disclaimer.');

  const res = await anon.get('/packages/disclaimer-override-tour');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.disclaimer, 'Custom package disclaimer.');

  // A package with no override leaves disclaimer null so the client falls
  // back to the site-wide setting.
  const noOverride = await admin.post('/packages', basePkg({
    slug: 'no-disclaimer-tour',
    title: 'No Disclaimer Tour',
    duration_days: 3,
    duration_nights: 2,
    published: true,
  }));
  assert.equal(noOverride.body.data.disclaimer, null);

  const pub = await anon.get('/packages/no-disclaimer-tour');
  assert.equal(pub.body.data.disclaimer, null);
  // Site-wide value is still reachable through public settings.
  const settings = await anon.get('/settings');
  assert.equal(settings.body.data.pricing_disclaimer, PRICING_DISCLAIMER);
});

// ---------------------------------------------------------------------------
// Public bootstrap projection
// ---------------------------------------------------------------------------

test('packages-catalog: bootstrap carries pricing_disclaimer and the new package fields', async () => {
  const res = await anon.get('/public/bootstrap');
  assert.equal(res.status, 200);

  const { settings, packages } = res.body.data;
  assert.equal(settings.pricing_disclaimer, PRICING_DISCLAIMER);

  const full = packages.find((p) => p.slug === fullPkgSlug);
  assert.ok(full, 'published package should appear in the bootstrap catalogue');
  assert.equal(full.price_max, 2600);
  assert.equal(full.duration_nights, 7);
  assert.equal(full.pricing_status, 'supplier_verified');
  assert.deepEqual(full.destinations_list, ['Rome', 'Florence']);
  assert.equal(full.currency, 'USD');
  assert.equal(full.archived, undefined, 'bootstrap projection must not expose the archived flag');

  // Drafts never appear in the bootstrap catalogue. (The bootstrap projection
  // does not carry a `published` column, so check by slug: the junk-bearer
  // draft from earlier must be absent.)
  assert.ok(
    packages.every((p) => p.slug !== 'hidden-draft-catalog'),
    'draft packages must not appear in the bootstrap catalogue'
  );
});

// ---------------------------------------------------------------------------
// Seed catalog: the six required USD packages
// ---------------------------------------------------------------------------

test('packages-catalog: seedSampleContent inserts the six required USD packages (slug-if-missing)', async () => {
  const { seedSampleContent } = require('../src/db/seed');
  seedSampleContent();

  const required = [
    ['italy-highlights-rome-florence-7d', 'SL_TO_IT', 7, 6, 1250, 1850, ['Rome', 'Florence']],
    ['italy-grand-tour-9d', 'SL_TO_IT', 9, 8, 1800, 2700, ['Rome', 'Florence', 'Venice']],
    ['italian-romance-coast-8d', 'SL_TO_IT', 8, 7, 1650, 2600, ['Rome', 'Amalfi Coast', 'Positano']],
    ['sri-lanka-discovery-7d', 'IT_TO_SL', 7, 6, 650, 1050, ['Negombo', 'Colombo', 'Sigiriya', 'Dambulla', 'Kandy']],
    ['sri-lanka-highlands-tea-train-8d', 'IT_TO_SL', 8, 7, 750, 1250, ['Kandy', 'Nuwara Eliya', 'Ella']],
    ['sri-lanka-island-escape-10d', 'IT_TO_SL', 10, 9, 1100, 1850, ['Sigiriya', 'Kandy', 'Ella', 'Galle', 'Unawatuna']],
  ];

  for (const [slug, direction, days, nights, min, max, cities] of required) {
    const res = await anon.get(`/packages/${slug}`);
    assert.equal(res.status, 200, `missing seeded package ${slug}: ${res.status}`);
    const p = res.body.data;
    assert.equal(p.direction, direction);
    assert.equal(p.duration_days, days);
    assert.equal(p.duration_nights, nights);
    assert.equal(p.price_from, min);
    assert.equal(p.price_max, max);
    assert.equal(p.currency, 'USD');
    assert.equal(p.pricing_status, 'indicative');
    assert.deepEqual(p.destinations_list, cities);
    assert.equal(p.archived, false);
    assert.ok(Array.isArray(p.itinerary) && p.itinerary.length >= 4, `${slug} needs a full itinerary`);
    assert.ok(Array.isArray(p.includes) && p.includes.length > 0, `${slug} needs includes`);
    assert.ok(Array.isArray(p.excludes) && p.excludes.length > 0, `${slug} needs excludes`);
    // Sample packages leave the disclaimer blank so the site-wide setting applies.
    assert.equal(p.disclaimer, null);
  }
});

test('packages-catalog: seeding again is a no-op for existing slugs', async () => {
  const before = (await admin.get('/packages?all=1')).body.meta.total;
  const { seedSampleContent } = require('../src/db/seed');
  seedSampleContent();
  const after = (await admin.get('/packages?all=1')).body.meta.total;
  assert.equal(after, before, 're-running seedSampleContent must not duplicate packages');
});
