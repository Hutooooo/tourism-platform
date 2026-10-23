# Deployment Guide

Sri Lanka ↔ Italy tourism platform — production deployment reference.

The app is a single Node process in production: Express serves the API under `/api` **and** the built React SPA from `client/dist`. Same-origin means cookies, CORS and SEO need no extra wiring.

---

## Requirements

| | |
|---|---|
| Node.js | 18.17+ (24.x recommended) |
| Disk | Writable directory for SQLite DB + uploaded images |
| TLS | Terminate HTTPS in front of the process (reverse proxy or platform) |

No external database, Redis or object store is required.

---

## Build

From the repo root:

```bash
npm run setup          # install server + client dependencies
npm run build          # vite build → client/dist
```

`client/dist` is what Express serves. Rebuild after every client change.

---

## Environment variables

Copy `.env.example` to `.env` (or set them in your host's environment) **before** first start. `config.js` reads the repo-root `.env`, then `server/.env` as an override.

### Required in production

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables strict secret checks, CSP, `COOKIE_SECURE` default |
| `JWT_SECRET` | *(64 random hex chars)* | Must not contain `change-me` |
| `REFRESH_JWT_SECRET` | *(different 64 random hex)* | Must not contain `change-me` |
| `ADMIN_PASSWORD` | *(strong password)* | Used only when the admin row is first created |
| `PUBLIC_API_URL` | `https://example.com` | Absolute origin, no trailing slash; used for OG/media URLs |
| `CLIENT_ORIGINS` | `https://example.com` | Comma-separated; must match the browser Origin exactly |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Optional

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `4000` | Many hosts inject this for you |
| `HOST` | `0.0.0.0` | Bind address; leave default behind a proxy |
| `DATABASE_FILE` | `./data/app.db` | Absolute path recommended on hosts with a data volume |
| `UPLOAD_DIR` | `./uploads` | Absolute path recommended; must persist across deploys |
| `MAX_UPLOAD_BYTES` | `5242880` | 5 MB |
| `JWT_TTL` | `15m` | Access-token lifetime |
| `REFRESH_JWT_TTL` | `30d` | Refresh-cookie lifetime |
| `COOKIE_SECURE` | `true` when `NODE_ENV=production` | Set `true` only when the public origin is HTTPS |
| `ADMIN_EMAIL` | `admin@localhost.local` | Change before first seed if you don't want the default |
| `ADMIN_NAME` | `Administrator` | |

### Client (build-time only)

| Variable | When |
|---|---|
| `VITE_API_URL` | Only if the API is on a **different** origin than the SPA. Leave unset for same-origin production (the default). Set before `npm run build`. |

---

## Persistent storage

Two paths must survive redeploys:

| What | Default path | Env var |
|---|---|---|
| SQLite database (+ WAL/SHM) | `server/data/app.db` | `DATABASE_FILE` |
| Uploaded images | `server/uploads/` | `UPLOAD_DIR` |

**How the path is resolved.** Relative values are resolved against the
`server/` directory — the location of `config.js` — *not* the repository root
and *not* the process working directory. `DATABASE_FILE=./data/app.db` therefore
means `server/data/app.db` even when the process is started from the repo root,
which is what most hosts do. Both directories are created automatically at boot.
An absolute path is used verbatim.

Because resolution is independent of the working directory, the same relative
values behave identically on your machine and on a host. When you attach a data
volume, switch to **absolute** paths on that volume:

```bash
DATABASE_FILE=/data/app.db
UPLOAD_DIR=/data/uploads
```

Change both together. If only one moves, the other keeps writing to the
ephemeral filesystem and those files silently disappear on the next redeploy.

`.gitignore` already excludes `server/data/`, `server/uploads/`, `*.db*` and
every `.env` variant — never commit them.


---

## First deploy

```bash
# 1. Install and build
npm run setup
npm run build

# 2. Seed (idempotent — safe to re-run)
npm run seed

# 3. Start
npm start
```

`npm run seed` is **safe on an existing database**:

- Existing admin accounts are left untouched.
- Settings already present are preserved; only missing defaults are written.
- Sample destinations/packages are inserted **only** when the tables are empty.

Do **not** set `ADMIN_PASSWORD` on every restart — it only applies when the admin row does not exist yet. After first sign-in, change the password from the dashboard (Settings → or `PATCH /api/auth/password`).

---

## Reverse proxy / TLS

Express trusts `X-Forwarded-For` (`trust proxy = 1`). Terminate TLS at the proxy and forward to the app:

```nginx
# nginx example
location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

With HTTPS in front:

```bash
NODE_ENV=production
COOKIE_SECURE=true
PUBLIC_API_URL=https://example.com
CLIENT_ORIGINS=https://example.com
```

Client routes (`/admin`, `/packages/...`, etc.) need no proxy special-casing — Express falls back to `index.html` for any non-`/api` path.

---

## Health check

```
GET /api/health
→ { "success": true, "data": { "status": "ok", "service": "tourism-api" } }
```

---

## What not to commit

Already covered by `.gitignore`:

- `.env` / `.env.local` (secrets)
- `server/data/` and `server/uploads/` (runtime state)
- `*.db`, `*.db-wal`, `*.db-shm`
- `node_modules/`, `client/dist/`

Commit: source, `package.json` / `package-lock.json`, `.env.example`, `README.md`, this file.

---

## Post-deploy checklist

1. `GET /api/health` returns 200.
2. Open the site over HTTPS; fonts and styles load (CSP allows Google Fonts).
3. Submit the public contact form; the inquiry appears under Admin → Inquiries.
4. Sign in at `/admin`; refresh the page and the session survives (refresh cookie).
5. Upload an image in Admin → Media; it renders on a destination/package.
6. Confirm `CLIENT_ORIGINS` matches the public origin exactly (scheme + host, no trailing slash) or the browser will block credentialed requests.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Boot throws `JWT_SECRET must be set…` | Placeholder secret left in production env |
| Login works but session dies on refresh | `REFRESH_JWT_SECRET` rotated, or cookie blocked (`COOKIE_SECURE` without HTTPS) |
| Admin UI cannot reach the API | `CLIENT_ORIGINS` does not match the browser origin |
| Images 404 after redeploy | `UPLOAD_DIR` not on a persistent volume |
| `/admin` 404s from the proxy | Proxy is not forwarding unknown paths to Express |

---

## Render (free tier)

A `render.yaml` Blueprint is included at the repo root. Render reads it automatically if you connect the repo as a Blueprint, or you can paste the same values into **New → Web Service**.

| | |
|---|---|
| Runtime | Node |
| Build command | `npm run setup && npm run build` |
| Start command | `npm run seed && npm start` |
| Output / served from | `client/dist` (Express serves it; no separate static service) |
| Health check path | `/api/health` |

### Free-tier limitations (important)

1. **Ephemeral disk.** SQLite (`server/data/app.db`) and uploads (`server/uploads/`) live on the instance filesystem, which is **wiped on every deploy, restart and sleep**. Your admin account, settings, destinations, packages, bookings and inquiries will reset. This is a Render free-plan constraint, not an app bug.
2. **Sample content comes back.** Because the database starts empty each cold start, `npm run seed` re-inserts the sample destinations and packages every time. Anything you delete in the dashboard reappears on the next restart. Use free only for demos.
3. **The admin password is reset each cold start too.** The admin row is rebuilt from `ADMIN_PASSWORD`, so changing the password in the dashboard does not survive a restart. On free, `ADMIN_PASSWORD` *is* the login — choose a strong value and keep your Render account secure.
4. **Cold starts.** Free instances sleep after ~15 min of no traffic; the first request after idle can take 30–60 s.
5. **No custom domain** on free; you get `https://<service-name>.onrender.com`.

**Do not put real customer bookings or inquiries on the free plan.** They will be deleted without warning.

### To keep data on Render

Upgrade the service to **Starter** ($7/mo) and attach a **Disk**:

```yaml
disk:
  name: tourism-data
  mountPath: /data
  sizeGB: 1
```

Then set:

```bash
DATABASE_FILE=/data/app.db
UPLOAD_DIR=/data/uploads
```

Both must be changed. The disk mount alone does nothing — with the relative defaults, SQLite and uploads keep writing to the container filesystem and still vanish on redeploy.

Your existing SQLite file is not deleted or replaced — the same engine and schema continue, just at a path on the disk.

### Environment variables on Render

Set these in the dashboard (or let `render.yaml` generate the secrets):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | long random hex (generate, don't invent) |
| `REFRESH_JWT_SECRET` | **different** long random hex |
| `ADMIN_EMAIL` | your admin email |
| `ADMIN_PASSWORD` | strong password (first boot only) |
| `PUBLIC_API_URL` | `https://<service-name>.onrender.com` |
| `CLIENT_ORIGINS` | `https://<service-name>.onrender.com` (same value, no trailing slash) |

Leave `VITE_API_URL` unset — the SPA calls same-origin `/api`.

`COOKIE_SECURE` defaults to `true` when `NODE_ENV=production`, which is correct for Render's HTTPS.

### Reading the generated admin password

`render.yaml` sets `generateValue: true` for `ADMIN_PASSWORD`, so Render creates it and stores it server-side. It is **never** written to build or runtime logs.

To read it without exposing it:

1. Render dashboard → your service → **Environment** tab.
2. Find `ADMIN_PASSWORD` and reveal the value.
3. Sign in at `/admin`, then change it (dashboard, or `PATCH /api/auth/password`).

Do not paste it into chat, screenshots or the repo. On a plan with a persistent disk the change sticks; on free it is re-seeded from this variable on every cold start (see above).

Anyone with access to your Render account can reveal it — that account is the trust boundary, so use a strong password there and enable 2FA.

### First deploy sequence

1. Push the repo to GitHub.
2. Render → **New → Blueprint** → select the repo (uses `render.yaml`).
3. Wait for the first build; open `https://<service-name>.onrender.com`.
4. Read `ADMIN_PASSWORD` from the **Environment** tab and sign in at `/admin`.
5. Change the admin password immediately (dashboard or `PATCH /api/auth/password`).
6. Replace sample destinations/packages with real content.

The start command runs `npm run seed` before `npm start`. Seed is idempotent: it will not overwrite an existing admin, existing settings, or existing destinations/packages. It does create the admin row from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when no such account exists yet, which on the free plan happens after every restart.

---

## Railway (Dockerfile)

`railway.json` builds with `builder: DOCKERFILE`. Railway builds **from the
connected GitHub repo**, not from your working copy — local edits do nothing
until they are committed and pushed.

| | |
|---|---|
| Builder | `Dockerfile` (`node:22-bookworm-slim`, python3/make/g++ for better-sqlite3) |
| Build | `npm install --prefix server`, `npm install --prefix client --include=dev`, then `npm run build` → `client/dist` |
| Start | `npm start` → runs `npm run seed`, then boots Express |
| Served from | Express serves `client/dist` and `/api` from one process |
| Health check | `GET /api/health` |

### Why seeding happens inside `npm start`

`server/data/` is gitignored, so **the repository contains no database**. A
fresh container therefore boots with an empty schema. `npm start` at the repo
root runs `npm run seed` first, which is idempotent:

- creates the admin row only if that email does not exist;
- writes only settings that are missing (including the site-wide pricing
  disclaimer, added with the editable package catalog);
- inserts sample **destinations** only when that table is empty;
- inserts sample **packages** slug-if-missing: a package is added only when a
  row with its slug does not exist yet, so an existing database gains any
  sample package it lacks (e.g. the six USD catalog tours) without touching
  admin edits to packages that are already there;
- never reads, writes or deletes bookings or inquiries.

So a fresh container gets a populated catalogue, and a container that already
has content (or a volume with real data) is left completely untouched.

### Schema upgrades on an existing database

The packages table gained columns for the editable catalog (price range,
nights, city list, pricing status/basis, add-ons, SEO, per-package disclaimer,
`archived`, etc.). There is no migration framework: `schema.sql` only runs
`CREATE TABLE IF NOT EXISTS`, so an already-deployed database would never gain
the new columns on its own. At boot, after the schema is applied, the server
compares `PRAGMA table_info(packages)` against the expected columns and issues
`ALTER TABLE packages ADD COLUMN …` for each one that is missing (existing
rows pick up the column defaults). This only ever **adds** columns — it never
drops, renames or rewrites rows, so bookings, inquiries, users, settings and
media are untouched. No manual migration step is required; redeploying is
enough.

### Environment variables

Set these in the Railway service **Variables** tab:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` (already set in the Dockerfile) |
| `JWT_SECRET` | long random hex — **required**, boot throws without it |
| `REFRESH_JWT_SECRET` | a **different** long random hex |
| `ADMIN_EMAIL` | your admin email |
| `ADMIN_PASSWORD` | strong password (used only when the admin row is first created) |
| `PUBLIC_API_URL` | `https://ceylonitalia.up.railway.app` (optional but recommended) |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`PUBLIC_API_URL` is optional: if unset, `/api/public/bootstrap` and the SEO
route derive the origin from the request `Host` header, so they never advertise
`localhost`. Setting it pins the origin if you later attach a custom domain.

> **Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` before the next deploy.** The deployed
> database has no user rows yet, so the next start creates the admin from these
> values. Left unset, it falls back to `admin@localhost.local` / `ChangeMe123!`.

### Data persistence

Without a **Volume**, everything lives on the container filesystem and is
wiped on every deploy, restart and re-deploy. Seeding repopulates the sample
catalogue each time, but **customer bookings and inquiries would be lost**.

To keep data, attach a Railway Volume and point both paths at it:

```bash
DATABASE_FILE=/data/app.db
UPLOAD_DIR=/data/uploads
```

Relative paths (the default) resolve against `server/`, i.e. `server/data/app.db`
inside the container. Change **both** variables together — moving only one splits
your data across persistent and ephemeral storage.

### Deploy steps

```bash
cd "D:/claud ai shit"
git add -A
git status                      # confirm .env, server/data and uploads are absent
git commit -m "Seed database on start and derive public origin from Host"
git push origin main
```

Railway picks up the push, rebuilds the image and restarts. Then verify:

```bash
curl -s https://ceylonitalia.up.railway.app/api/health
curl -s https://ceylonitalia.up.railway.app/api/public/bootstrap | head -c 400
```

Expect `"status":"ok"`, and `stats.destinations` / `stats.packages` above zero
with `"baseUrl":"https://ceylonitalia.up.railway.app"`.


