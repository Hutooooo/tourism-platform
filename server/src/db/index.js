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
