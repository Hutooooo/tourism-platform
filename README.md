# Sri Lanka ↔ Italy Tourism

A production-oriented tourism platform for a business offering tourism services
between **Sri Lanka and Italy in both directions**. Visitors browse destinations
and packages and submit booking requests or inquiries; administrators manage
content, contact details and customer correspondence from a private dashboard.

> **Business identity.** No official company name, office address, registration
> number or social accounts have been supplied. None are invented anywhere in
> this codebase. The brand name is a **configurable placeholder** stored in
> settings (`brand_name`) and editable from **Dashboard → Settings**. The only
> hard-coded business facts are the three contact details supplied by the owner
> (see below).

---

## Supplied contact details

These are the only contact facts the owner has provided. They are stored in
persistent settings and rendered identically everywhere (Contact page, footer,
dashboard reply actions).

| Channel | Value | Link format |
| --- | --- | --- |
| Email | `nuwanmalinda1978@gmail.com` | `mailto:nuwanmalinda1978@gmail.com` |
| Telephone | `+39 389 102 2909` | `tel:+393891022909` |
| WhatsApp | `+39 389 102 2909` | `https://wa.me/393891022909` |

Administrators can change these at any time from the dashboard; the public site
re-renders with the new values on the next load.

---

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js ≥ 18.17 |
| API | Express 4 |
| Database | SQLite via `better-sqlite3` (WAL, foreign keys on) |
| Auth | JWT access token (Bearer) + refresh token as an httpOnly cookie |
| Passwords | bcrypt, 12 rounds |
| Frontend | React 18 + Vite 5 + React Router 6 |
| Styling | Hand-written CSS design system (`client/src/styles/global.css`) |
| Tests | Node's built-in `node:test` runner |

---

## Project layout

```
.
├── package.json            root scripts (setup / dev / seed / build / start / test)
├── scripts/dev.js          runs API + Vite together
├── .env / .env.example     configuration
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.js        HTTP listener + graceful shutdown
│   │   ├── app.js          middleware + the nine routers + SPA fallback
│   │   ├── config.js       env parsing, path resolution, secret checks
│   │   ├── db/
│   │   │   ├── schema.sql  idempotent DDL
│   │   │   ├── index.js    connection, pragmas, settings helpers
│   │   │   ├── seed.js     admin + settings + sample content
│   │   │   └── sampleData.js
│   │   ├── routers/        ← the nine routers (see below)
│   │   ├── middleware/     auth, error handling, security
│   │   ├── settings/       DEFAULT_SETTINGS (only supplied facts)
│   │   └── utils/          http envelope, validation, slugs, tokens
│   ├── test/
│   │   ├── helpers.js      temp-database harness + fetch/cookie client
│   │   └── api.test.js     end-to-end coverage of all nine routers
│   ├── data/               SQLite files (gitignored)
│   └── uploads/            uploaded media (gitignored)
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── public/
    └── src/
        ├── main.jsx
        ├── App.jsx         route table
        ├── api/client.js   fetch wrapper + silent token refresh
        ├── context/        SettingsContext, AuthContext
        ├── hooks/          useReveal, useSeo
        ├── components/     Header, Footer, cards, forms, ImagePicker
        ├── pages/          public pages
        ├── pages/admin/    dashboard pages
        └── styles/         design system
```

---

## The nine routers

Every API endpoint lives under `/api` and is owned by exactly one router. This
is the architecture the application is built on — there is no second backend
and no duplicated route tree.

| # | Router | Mount | Responsibility |
| --- | --- | --- | --- |
| 1 | `auth` | `/api/auth` | Login, logout, token refresh, session restore, password change |
| 2 | `destinations` | `/api/destinations` | Catalogue reads (public) + CRUD (admin) |
| 3 | `packages` | `/api/packages` | Tour packages, direction filtering, itinerary, CRUD (admin) |
| 4 | `bookings` | `/api/bookings` | Public booking requests, admin listing/status/delete |
| 5 | `inquiries` | `/api/inquiries` | Public contact-form messages, admin inbox |
| 6 | `settings` | `/api/settings` | Persistent business settings (public subset / full admin record) |
| 7 | `media` | `/api/media` | Image upload, storage, serving, deletion |
| 8 | `analytics` | `/api/analytics` | Dashboard overview, funnel, timeline, recent activity |
| 9 | `public` | `/api/public` | Bootstrap payload, health, per-path SEO metadata |

### Response envelope

Success:

```json
{ "success": true, "data": [ ... ], "meta": { "total": 12 } }
```

Failure:

```json
{ "success": false, "error": { "message": "…", "details": { "email": "…" } } }
```

### Auth model

- `POST /api/auth/login` → returns `{ user, accessToken }` **and** sets an
  httpOnly `rt` cookie (path-scoped to `/api/auth`).
- Clients send `Authorization: Bearer <accessToken>` on admin calls.
- On 401 the SPA calls `POST /api/auth/refresh` once (concurrent calls are
  de-duplicated) to mint a new access token from the cookie.
- `requireAuth` re-reads the user row on **every** request, so deactivating an
  account revokes access immediately without waiting for token expiry.

### Direction model

Packages carry a single `direction`:

- `SL_TO_IT` — Sri Lanka → Italy
- `IT_TO_SL` — Italy → Sri Lanka
- `BOTH` — offered in both directions

A query for one direction also returns `BOTH` packages, so the public filters
never hide a genuinely two-way product.

---

## Getting started

```bash
# 1. Install everything (root, server, client)
npm run setup

# 2. Create .env from the example, then change the secrets
cp .env.example .env

# 3. Seed the admin account, default settings and sample destinations/packages
npm run seed

# 4. Run API (:4000) and Vite (:5173) together
npm run dev
```

Open <http://localhost:5173>. The dashboard is at
<http://localhost:5173/admin/login>.

Default administrator (from `.env`):

```
ADMIN_EMAIL=admin@localhost.local
ADMIN_PASSWORD=ChangeMe123!
```

**Change the password before deploying.** The seed script warns if the default
is still in place.

### Production

```bash
npm run build     # builds client/dist
npm start         # Express serves the API and the built SPA from one origin
```

Set `NODE_ENV=production` and strong `JWT_SECRET` / `REFRESH_JWT_SECRET`
values first — the server refuses to boot in production without them.

---

## Configuration

All configuration is environment-driven (see `.env.example`):

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | API port | `4000` |
| `PUBLIC_API_URL` | Absolute URLs for uploaded media / OG tags | `http://localhost:4000` |
| `CLIENT_ORIGINS` | CORS allowlist, comma separated | `http://localhost:5173,…` |
| `DATABASE_FILE` | SQLite path | `./data/app.db` |
| `UPLOAD_DIR` | Media storage | `./uploads` |
| `MAX_UPLOAD_BYTES` | Upload ceiling | `5242880` (5MB) |
| `JWT_SECRET` | Access-token signing key | dev-only ephemeral |
| `REFRESH_JWT_SECRET` | Refresh-token signing key | dev-only ephemeral |
| `JWT_TTL` / `REFRESH_JWT_TTL` | Token lifetimes | `15m` / `30d` |
| `COOKIE_SECURE` | `Secure` flag on the refresh cookie | `false` in dev |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded administrator | see above |

---

## Tests

```bash
npm test              # from the repo root
# or
cd server && npm test
```

The suite boots the real Express app against a **temporary SQLite database**
and a temporary upload directory, then exercises every router end to end:

- public bootstrap and the supplied contact links
- auth (login, session restore, bearer requirement, rejection paths)
- destination and package CRUD, direction filtering, draft visibility
- booking submission → `BK-#####` reference → admin status transitions
- inquiry submission → auto-mark-read → status changes → counts
- settings round-trip, whitelist rejection, single-key PATCH
- media upload, magic-byte rejection, path-traversal refusal
- analytics endpoints, admin-only
- unknown-route and malformed-JSON error envelopes

---

## Design notes

**Business identity is never invented.** `DEFAULT_SETTINGS` contains the brand
placeholder and the three supplied contact facts — nothing else. There is no
address, registration number, company history, or social link anywhere in the
schema, seed data, or UI.

**Contact methods are real links, not decoration.** The email tile is a
`mailto:`, the phone tile is a `tel:` with punctuation stripped, and the
WhatsApp tile is `https://wa.me/<digits>` — all generated in one place
(`SettingsContext.deriveContact`) so they cannot drift apart.

**Motion is opt-out.** Scroll reveals, route transitions and skeleton shimmer
all sit behind `@media (prefers-reduced-motion: reduce)`.

**SEO is honest about its limits.** The client sets per-route titles and meta
tags via `useSeo`, backed by `GET /api/public/seo?path=`. This is a
client-rendered SPA — full crawler indexing of deep links would need a
prerender step or SSR, which is noted in the source rather than glossed over.
