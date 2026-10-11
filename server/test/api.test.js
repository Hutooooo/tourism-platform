'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { startApp, createClient } = require('./helpers');

const ADMIN_EMAIL = 'admin@test.local';
const ADMIN_PASSWORD = 'TestPass123!';

/** Boot once for the whole file; every suite shares the temp database. */
let ctx;
let anon; // unauthenticated client
let admin; // authenticated admin client

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

// ---------------------------------------------------------------------------
// Router 9/9 — public
// ---------------------------------------------------------------------------

test('public: health endpoint responds', async () => {
  const res = await anon.get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'ok');
});

test('public: bootstrap returns settings, contact links and catalogue', async () => {
  const res = await anon.get('/public/bootstrap');
  assert.equal(res.status, 200);

  const { settings, contact, destinations, packages, stats } = res.body.data;

  // The three supplied contact facts must be present verbatim.
  assert.equal(settings.contact_email, 'nuwanmalinda1978@gmail.com');
  assert.equal(settings.contact_phone, '+39 389 102 2909');

  assert.equal(contact.email.href, 'mailto:nuwanmalinda1978@gmail.com');
  assert.equal(contact.phone.href, 'tel:+393891022909');
  assert.equal(contact.whatsapp.href, 'https://wa.me/393891022909');

  assert.ok(Array.isArray(destinations));
  assert.ok(Array.isArray(packages));
  assert.ok(stats.destinations >= 0);
  assert.equal(stats.countries, 2);
});

test('public: no fabricated business identity leaks into settings', async () => {
  const res = await anon.get('/settings');
  const s = res.body.data;
  // Brief forbids inventing these; they must not be silently invented.
  for (const key of ['address', 'registration_number', 'company_history', 'social_links']) {
    assert.equal(s[key], undefined, `${key} should not exist`);
  }
  assert.ok(s.brand_name, 'brand_name should be present as a configurable placeholder');
});

// ---------------------------------------------------------------------------
// Router 1/9 — auth
// ---------------------------------------------------------------------------

test('auth: wrong password is rejected', async () => {
  const res = await anon.post('/auth/login', { email: ADMIN_EMAIL, password: 'nope' });
  assert.equal(res.status, 401);
});

test('auth: malformed email is rejected', async () => {
  const res = await anon.post('/auth/login', { email: 'not-an-email', password: 'x' });
  assert.equal(res.status, 400);
});

test('auth: session restore works from the refresh cookie alone', async () => {
  const res = await anon.get('/auth/session');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.user, null);

  const signedIn = await admin.get('/auth/session');
  assert.equal(signedIn.body.data.user.email, ADMIN_EMAIL);
  assert.ok(signedIn.body.data.accessToken, 'session should mint a fresh access token');
});

test('auth: /me requires a bearer token', async () => {
  const res = await anon.get('/auth/me');
  assert.equal(res.status, 401);

  const token = (await admin.get('/auth/session')).body.data.accessToken;
  const okRes = await admin.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(okRes.status, 200);
});

// ---------------------------------------------------------------------------
// Router 2/9 — destinations
// ---------------------------------------------------------------------------

let destinationId;

test('destinations: admin can create one', async () => {
  const res = await admin.post('/destinations', {
    name: 'Temple of the Tooth',
    country: 'Sri Lanka',
    region: 'Central Province',
    summary: 'A sacred Buddhist site in Kandy.',
    description: 'The Temple of the Tooth is a Buddhist temple in the city of Kandy.',
    highlights: ['Kandy Lake', 'Evening puja'],
    featured: true,
    published: true,
  });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.slug, 'temple-of-the-tooth');
  assert.deepEqual(res.body.data.highlights, ['Kandy Lake', 'Evening puja']);
  assert.equal(res.body.data.featured, true);
  destinationId = res.body.data.id;
});

test('destinations: anonymous callers cannot create', async () => {
  const res = await anon.post('/destinations', { name: 'Nope', country: 'Italy' });
  assert.equal(res.status, 401);
});

test('destinations: list hides drafts from the public but shows them to admins', async () => {
  await admin.post('/destinations', {
    name: 'Hidden Draft Place',
    country: 'Italy',
    published: false,
  });

  const pub = await anon.get('/destinations');
  assert.equal(pub.status, 200);
  assert.ok(pub.body.data.every((d) => d.published === true), 'public list must not include drafts');

  const priv = await admin.get('/destinations?all=1');
  assert.ok(priv.body.data.some((d) => d.name === 'Hidden Draft Place'));
});

test('destinations: slug lookup and update', async () => {
  const bySlug = await anon.get('/destinations/temple-of-the-tooth');
  assert.equal(bySlug.status, 200);
  assert.equal(bySlug.body.data.id, destinationId);

  const updated = await admin.put(`/destinations/${destinationId}`, {
    name: 'Temple of the Tooth',
    country: 'Sri Lanka',
    region: 'Central Province',
    summary: 'Updated summary.',
    highlights: ['Kandy Lake'],
    featured: false,
    published: true,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.summary, 'Updated summary.');
  assert.equal(updated.body.data.featured, false);
});

test('destinations: invalid country is rejected', async () => {
  const res = await admin.post('/destinations', { name: 'Atlantis', country: 'Atlantis' });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Router 3/9 — packages
// ---------------------------------------------------------------------------

let packageSlug;

test('packages: create with itinerary, then fetch by slug', async () => {
  const res = await admin.post('/packages', {
    title: 'Kandy & Cultural Triangle',
    direction: 'IT_TO_SL',
    destination_id: destinationId,
    summary: 'Temples, tea and ancient cities.',
    duration_days: 7,
    price_from: 1200,
    currency: 'EUR',
    itinerary: [
      { day: 1, title: 'Arrive Colombo', detail: 'Transfer to Kandy.' },
      { day: 2, title: 'Temple of the Tooth', detail: 'Evening puja and lake walk.' },
    ],
    includes: ['Accommodation', 'Guide'],
    excludes: ['International flights'],
    published: true,
  });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  packageSlug = res.body.data.slug;
  assert.equal(res.body.data.itinerary.length, 2);
  assert.equal(res.body.data.destination_name, 'Temple of the Tooth');
});

test('packages: direction filter includes BOTH when one direction is asked for', async () => {
  await admin.post('/packages', {
    title: 'Bidirectional Sample',
    direction: 'BOTH',
    duration_days: 3,
    published: true,
  });

  const slToIt = await anon.get('/packages?direction=SL_TO_IT');
  assert.ok(slToIt.body.data.some((p) => p.direction === 'BOTH'));
  assert.ok(slToIt.body.data.every((p) => p.direction !== 'IT_TO_SL'));
});

test('packages: public list excludes drafts', async () => {
  await admin.post('/packages', { title: 'Secret Package', direction: 'BOTH', published: false });
  const pub = await anon.get('/packages');
  assert.ok(pub.body.data.every((p) => p.published === true));
});

test('packages: detail returns full record', async () => {
  const res = await anon.get(`/packages/${packageSlug}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.includes[0], 'Accommodation');
  assert.equal(res.body.data.excludes[0], 'International flights');
});

// ---------------------------------------------------------------------------
// Router 4/9 — bookings
// ---------------------------------------------------------------------------

test('bookings: public submission returns a BK- reference', async () => {
  const res = await anon.post('/bookings', {
    name: 'Giulia Rossi',
    email: 'giulia@example.com',
    phone: '+39 320 000 0000',
    travel_date: '2027-03-14',
    adults: 2,
    children: 1,
    package_slug: packageSlug,
    notes: 'We would like a vegetarian-friendly itinerary.',
  });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.match(res.body.data.reference, /^BK-\d{5}$/);
  assert.equal(res.body.data.status, 'pending');
});

test('bookings: invalid email is rejected', async () => {
  const res = await anon.post('/bookings', { name: 'No Email', email: 'bad' });
  assert.equal(res.status, 400);
});

test('bookings: unknown package slug is rejected', async () => {
  const res = await anon.post('/bookings', {
    name: 'Someone',
    email: 'someone@example.com',
    package_slug: 'does-not-exist',
  });
  assert.equal(res.status, 400);
});

test('bookings: admin list, counts and status transitions', async () => {
  const list = await admin.get('/bookings');
  assert.equal(list.status, 200);
  assert.ok(list.body.data.length >= 1);
  const target = list.body.data.find((b) => b.email === 'giulia@example.com');
  assert.ok(target, 'submitted booking should appear in the admin list');

  const counts = await admin.get('/bookings/counts');
  assert.ok(counts.body.data.pending >= 1);

  const patched = await admin.patch(`/bookings/${target.id}/status`, { status: 'confirmed' });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.status, 'confirmed');

  const filtered = await admin.get('/bookings?status=confirmed');
  assert.ok(filtered.body.data.some((b) => b.id === target.id));
});

test('bookings: anonymous admin listing is refused', async () => {
  const res = await anon.get('/bookings');
  assert.equal(res.status, 401);
});

test('bookings: unknown status value is rejected', async () => {
  const list = await admin.get('/bookings');
  const target = list.body.data[0];
  const res = await admin.patch(`/bookings/${target.id}/status`, { status: 'wat' });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Router 5/9 — inquiries
// ---------------------------------------------------------------------------

let inquiryId;

test('inquiries: public submission is stored', async () => {
  const res = await anon.post('/inquiries', {
    name: 'Marco Bianchi',
    email: 'marco@example.com',
    phone: '+39 333 111 2222',
    type: 'custom-tour',
    subject: 'Honeymoon in Sri Lanka',
    message: 'We are getting married in June and would like a two-week itinerary.',
  });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  inquiryId = res.body.data.id;
  assert.equal(res.body.data.status, 'new');
});

test('inquiries: opening a message marks it read', async () => {
  const opened = await admin.get(`/inquiries/${inquiryId}`);
  assert.equal(opened.status, 200);
  assert.equal(opened.body.data.status, 'read');
  assert.equal(opened.body.data.message.includes('two-week itinerary'), true);
});

test('inquiries: status can be moved to replied and archived', async () => {
  const replied = await admin.patch(`/inquiries/${inquiryId}/status`, { status: 'replied' });
  assert.equal(replied.body.data.status, 'replied');

  const archived = await admin.patch(`/inquiries/${inquiryId}/status`, { status: 'archived' });
  assert.equal(archived.body.data.status, 'archived');
});

test('inquiries: counts reflect the mailbox', async () => {
  const counts = await admin.get('/inquiries/counts');
  assert.equal(counts.status, 200);
  assert.ok(counts.body.data.archived >= 1);
  assert.ok(counts.body.data.total >= 1);
});

// ---------------------------------------------------------------------------
// Router 6/9 — settings
// ---------------------------------------------------------------------------

test('settings: public endpoint only exposes the public subset', async () => {
  const res = await anon.get('/settings');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.brand_name);
  assert.ok(res.body.data.contact_email);
});

test('settings: admin bulk update persists and is visible publicly', async () => {
  const res = await admin.put('/settings', {
    brand_name: 'Test Brand Name',
    contact_email: 'nuwanmalinda1978@gmail.com',
    contact_phone: '+39 389 102 2909',
    contact_whatsapp: '+39 389 102 2909',
    directions: ['SL_TO_IT', 'IT_TO_SL'],
    currency: 'EUR',
    booking_enabled: true,
    inquiry_enabled: true,
    footer_note: 'Updated footer note.',
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const pub = await anon.get('/settings');
  assert.equal(pub.body.data.brand_name, 'Test Brand Name');
  assert.equal(pub.body.data.footer_note, 'Updated footer note.');

  // Contact details the brief fixed must round-trip unchanged.
  assert.equal(pub.body.data.contact_email, 'nuwanmalinda1978@gmail.com');
  assert.equal(pub.body.data.contact_whatsapp, '+39 389 102 2909');
});

test('settings: PATCH a single key', async () => {
  const res = await admin.patch('/settings/inquiry_enabled', { value: false });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.inquiry_enabled, false);

  const restored = await admin.patch('/settings/inquiry_enabled', { value: true });
  assert.equal(restored.body.data.inquiry_enabled, true);
});

test('settings: unknown keys are rejected', async () => {
  const res = await admin.put('/settings', { evil_key: 'nope' });
  assert.equal(res.status, 400);
});

test('settings: invalid email is rejected', async () => {
  const res = await admin.put('/settings', { contact_email: 'not-an-email' });
  assert.equal(res.status, 400);
});

test('settings: empty directions list is rejected', async () => {
  const res = await admin.put('/settings', { directions: [] });
  assert.equal(res.status, 400);
});

test('settings: anonymous write is refused', async () => {
  const res = await anon.put('/settings', { brand_name: 'Hijacked' });
  assert.equal(res.status, 401);
});

// ---------------------------------------------------------------------------
// Router 7/9 — media
// ---------------------------------------------------------------------------

/** 1x1 transparent PNG. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test('media: base64 upload is stored and served back', async () => {
  const res = await admin.post('/media/base64', {
    image: `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
    alt: 'Test pixel',
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.url, `/api/media/${res.body.data.filename}`);

  const bytes = await anon.get(res.body.data.url, { raw: true });
  assert.equal(bytes.status, 200);
  assert.equal(bytes.headers.get('content-type'), 'image/png');
});

test('media: non-image content is refused', async () => {
  const fake = Buffer.from('this is definitely not an image');
  const res = await admin.post('/media/base64', {
    image: `data:image/png;base64,${fake.toString('base64')}`,
  });
  assert.equal(res.status, 400);
});

test('media: path traversal in the filename is refused', async () => {
  const res = await anon.get('/media/..%2f..%2fpackage.json', { raw: true });
  assert.ok(res.status === 400 || res.status === 404, `unexpected ${res.status}`);
});

test('media: library listing requires auth', async () => {
  const pub = await anon.get('/media');
  assert.equal(pub.status, 401);

  const priv = await admin.get('/media');
  assert.equal(priv.status, 200);
  assert.ok(Array.isArray(priv.body.data));
});

// ---------------------------------------------------------------------------
// Router 8/9 — analytics
// ---------------------------------------------------------------------------

test('analytics: overview, funnel, timeline and recent are admin-only', async () => {
  const anonRes = await anon.get('/analytics/overview');
  assert.equal(anonRes.status, 401);

  const overview = await admin.get('/analytics/overview');
  assert.equal(overview.status, 200);
  assert.ok(overview.body.data.bookings >= 1);
  assert.ok(overview.body.data.inquiries >= 1);
  assert.ok(overview.body.data.destinationsPublished >= 1);

  const funnel = await admin.get('/analytics/funnel');
  assert.equal(funnel.status, 200);
  assert.ok(funnel.body.data.bookings.total >= 1);
  assert.ok(funnel.body.data.inquiries.total >= 1);
  assert.ok(typeof funnel.body.data.conversion.confirmedRate === 'number');

  const timeline = await admin.get('/analytics/timeline?days=14');
  assert.equal(timeline.status, 200);
  assert.equal(timeline.body.data.days, 14);
  assert.equal(timeline.body.data.series.length, 14, 'timeline should have one entry per day');
  assert.ok(timeline.body.data.series.every((p) => typeof p.bookings === 'number' && typeof p.inquiries === 'number'));

  const recent = await admin.get('/analytics/recent');
  assert.equal(recent.status, 200);
  assert.ok(Array.isArray(recent.body.data.bookings));
  assert.ok(Array.isArray(recent.body.data.inquiries));
});

// ---------------------------------------------------------------------------
// Cross-cutting behaviour
// ---------------------------------------------------------------------------

test('unknown API paths return the standard error envelope', async () => {
  const res = await anon.get('/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.message);
});

test('malformed JSON body does not crash the server', async () => {
  const res = await anon.request('POST', '/inquiries', {
    body: '{"name": ',
    headers: { 'Content-Type': 'application/json' },
  });
  assert.ok(res.status >= 400);
  assert.equal(res.body.success, false);
});

test('booking_enabled=false blocks new booking submissions', async () => {
  await admin.patch('/settings/booking_enabled', { value: false });
  const res = await anon.post('/bookings', {
    name: 'Blocked Person',
    email: 'blocked@example.com',
  });
  assert.equal(res.status, 400);
  await admin.patch('/settings/booking_enabled', { value: true });
});
