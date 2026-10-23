'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const db = new Database(config.db.file);

// Durability + concurrency settings appropriate for a single-node deployment.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

const schemaPath = path.join(__dirname, 'schema.sql');
db.exec(fs.readFileSync(schemaPath, 'utf8'));

/**
 * Additive column migration. schema.sql uses CREATE TABLE IF NOT EXISTS, so
 * tables created by older builds never gain new columns on re-boot. This
 * ensures the columns the current code expects exist, using only
 * ALTER TABLE ADD COLUMN (never DROP/RENAME) so existing rows — including
 * bookings, inquiries and settings — are untouched.
 */
const PACKAGE_COLUMN_DEFS = [
  ['duration_nights', 'INTEGER'],
  ['destinations_list', "TEXT NOT NULL DEFAULT '[]'"],
  ['price_max', 'REAL'],
  ['pricing_status', "TEXT NOT NULL DEFAULT 'indicative'"],
  ['pricing_basis', "TEXT NOT NULL DEFAULT 'per_person'"],
  ['occupancy_note', 'TEXT'],
  ['accommodation', 'TEXT'],
  ['accommodation_category', 'TEXT'],
  ['add_ons', "TEXT NOT NULL DEFAULT '[]'"],
  ['group_size_min', 'INTEGER'],
  ['group_size_max', 'INTEGER'],
  ['seasonal_notes', 'TEXT'],
  ['lead_time', 'TEXT'],
  ['cancellation_policy', 'TEXT'],
  ['seo_title', 'TEXT'],
  ['seo_description', 'TEXT'],
  ['disclaimer', 'TEXT'],
  ['archived', 'INTEGER NOT NULL DEFAULT 0'],
];

function ensureColumns(table, defs) {
  const have = new Set(db.pragma(`table_info(${table})`).map((c) => c.name));
  for (const [name, ddl] of defs) {
    if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
  }
}
ensureColumns('packages', PACKAGE_COLUMN_DEFS);
// Safe to index archived only once the column is guaranteed to exist.
db.exec('CREATE INDEX IF NOT EXISTS idx_pkg_arch ON packages(archived, published)');

/**
 * Run a function inside a transaction. Nested calls reuse the outer
 * transaction (better-sqlite3 handles this via SAVEPOINT), so services can
 * compose safely.
 */
function tx(fn) {
  if (db.inTransaction) return fn(db);
  return db.transaction(fn)(db);
}

/** Insert or update a settings row, storing the value as JSON. */
function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, JSON.stringify(value));
}

/** Read a settings row, parsing JSON. Returns `fallback` when absent. */
function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const out = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

module.exports = { db, tx, setSetting, getSetting, getAllSettings };
