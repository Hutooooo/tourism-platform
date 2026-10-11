-- Schema for the Sri Lanka <-> Italy tourism platform.
-- Idempotent: every statement is guarded so re-running is safe.

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT    NOT NULL UNIQUE,
  password_hash  TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  role           TEXT    NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','staff')),
  active         INTEGER NOT NULL DEFAULT 1,
  last_login_at  TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Key/value business settings. Values are JSON-encoded so they round-trip
-- as strings, numbers, booleans or objects.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS destinations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  country     TEXT    NOT NULL CHECK (country IN ('Sri Lanka','Italy')),
  region      TEXT,
  summary     TEXT,
  description TEXT,
  image_url   TEXT,
  gallery     TEXT NOT NULL DEFAULT '[]',
  highlights  TEXT NOT NULL DEFAULT '[]',
  featured    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dest_country ON destinations(country, published);
CREATE INDEX IF NOT EXISTS idx_dest_sort    ON destinations(sort_order, id);

CREATE TABLE IF NOT EXISTS packages (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT    NOT NULL UNIQUE,
  title          TEXT    NOT NULL,
  direction      TEXT    NOT NULL DEFAULT 'BOTH'
                   CHECK (direction IN ('SL_TO_IT','IT_TO_SL','BOTH')),
  destination_id INTEGER REFERENCES destinations(id) ON DELETE SET NULL,
  summary        TEXT,
  description    TEXT,
  duration_days  INTEGER,
  price_from     REAL,
  currency       TEXT    NOT NULL DEFAULT 'EUR',
  itinerary      TEXT NOT NULL DEFAULT '[]',
  includes       TEXT NOT NULL DEFAULT '[]',
  excludes       TEXT NOT NULL DEFAULT '[]',
  image_url      TEXT,
  gallery        TEXT NOT NULL DEFAULT '[]',
  featured       INTEGER NOT NULL DEFAULT 0,
  published      INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pkg_dir  ON packages(direction, published);
CREATE INDEX IF NOT EXISTS idx_pkg_dest ON packages(destination_id);
CREATE INDEX IF NOT EXISTS idx_pkg_sort ON packages(sort_order, id);

CREATE TABLE IF NOT EXISTS inquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  subject    TEXT,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'general'
               CHECK (type IN ('general','custom-tour','partnership','other')),
  status     TEXT NOT NULL DEFAULT 'new'
               CHECK (status IN ('new','read','replied','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inq_status ON inquiries(status, created_at DESC);

CREATE TABLE IF NOT EXISTS bookings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id          INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  package_title       TEXT NOT NULL,
  direction           TEXT NOT NULL DEFAULT 'BOTH'
                        CHECK (direction IN ('SL_TO_IT','IT_TO_SL','BOTH')),
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  travel_date         TEXT,
  travellers          INTEGER NOT NULL DEFAULT 1,
  adults              INTEGER NOT NULL DEFAULT 1,
  children            INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','declined','completed')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_book_status ON bookings(status, created_at DESC);

CREATE TABLE IF NOT EXISTS media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  filename   TEXT NOT NULL,
  path       TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  alt        TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);
