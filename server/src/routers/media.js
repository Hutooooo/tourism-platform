'use strict';

/**
 * Router 7/9 — media
 * Image upload for the dashboard. Files land in UPLOAD_DIR, are tracked in
 * the `media` table, and are served back through GET /api/media/:filename.
 *
 * Uploads are accepted as multipart/form-data (`file`) or as JSON carrying
 * a base64 data URL (`image`), so the admin UI can paste either way.
 */

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const config = require('../config');
const { db, tx } = require('../db');
const { ok, asyncHandler, notFound, badRequest } = require('../utils/http');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
  ['image/svg+xml', '.svg'],
]);

/** Magic-byte sniffing so a renamed executable cannot slip through. */
function looksLikeImage(buf) {
  if (!buf || buf.length < 12) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return true;
  // RIFF....WEBP
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return true;
  // ftyp....avif / avis
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true;
  // SVG — text, check for a tag
  const head = buf.slice(0, 512).toString('utf8').toLowerCase();
  if (head.includes('<svg') || (head.includes('<?xml') && head.includes('<svg'))) return true;
  return false;
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxBytes, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(badRequest(`Unsupported file type: ${file.mimetype}.`));
    }
    cb(null, true);
  },
});

/**
 * Persist a validated buffer. Returns the row that was inserted.
 * Name is random — never trusts client-supplied filenames.
 */
function saveBuffer(buffer, mime, alt) {
  if (buffer.length > config.upload.maxBytes) {
    throw badRequest(`File exceeds the ${Math.floor(config.upload.maxBytes / (1024 * 1024))}MB limit.`);
  }
  if (!looksLikeImage(buffer)) {
    throw badRequest('File content is not a recognised image.');
  }

  const ext = ALLOWED.get(mime) || '.bin';
  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const fullPath = path.join(config.upload.dir, filename);

  fs.writeFileSync(fullPath, buffer);

  const info = db
    .prepare('INSERT INTO media (filename, path, mime, size, alt) VALUES (?, ?, ?, ?, ?)')
    .run(filename, filename, mime, buffer.length, alt || null);

  return db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Convert a stored row into an API-facing record.
 *
 * `url` is root-relative (`/api/media/...`) rather than absolute: the SPA is
 * served same-origin in production and proxied by Vite in development, so a
 * relative path keeps working if PUBLIC_API_URL changes or the host name
 * varies between environments. The client's `mediaUrl()` resolves it.
 */
function mapMedia(row) {
  if (!row) return null;
  return {
    id: row.id,
    filename: row.filename,
    url: `/api/media/${row.filename}`,
    mime: row.mime,
    size: row.size,
    alt: row.alt || '',
    created_at: row.created_at,
  };
}

// POST /api/media — multipart field name: `file`.
router.post(
  '/',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file was uploaded.');
    const row = saveBuffer(req.file.buffer, req.file.mimetype, req.body && req.body.alt);
    return res.status(201).json({ success: true, data: mapMedia(row) });
  })
);

// POST /api/media/base64 — JSON { image: "data:image/png;base64,..." , alt? }
router.post(
  '/base64',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const raw = body.image;
    if (typeof raw !== 'string' || !raw.startsWith('data:')) {
      throw badRequest('Expected `image` to be a data URL.');
    }

    const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(raw);
    if (!match) throw badRequest('Malformed data URL.');

    const mime = match[1];
    if (!ALLOWED.has(mime)) throw badRequest(`Unsupported file type: ${mime}.`);

    let buffer;
    try {
      buffer = Buffer.from(match[2], 'base64');
    } catch {
      throw badRequest('Could not decode the image data.');
    }
    if (!buffer.length) throw badRequest('The image data was empty.');

    const row = saveBuffer(buffer, mime, typeof body.alt === 'string' ? body.alt.slice(0, 300) : null);
    return res.status(201).json({ success: true, data: mapMedia(row) });
  })
);

// GET /api/media — library listing for the dashboard.
router.get(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 60, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const total = db.prepare('SELECT COUNT(*) AS n FROM media').get().n;
    const rows = db
      .prepare('SELECT * FROM media ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
      .all(limit, offset);
    return ok(res, rows.map(mapMedia), { total, limit, offset, hasMore: offset + rows.length < total });
  })
);

// GET /api/media/:filename — public read. Serves the bytes with caching.
router.get(
  '/:filename',
  asyncHandler(async (req, res) => {
    // Reject path traversal outright before touching the filesystem.
    const filename = path.basename(req.params.filename);
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) throw notFound('Not found.');

    const row = db.prepare('SELECT * FROM media WHERE filename = ?').get(filename);
    const fullPath = path.join(config.upload.dir, filename);

    // Fall back to the filesystem even if the row was pruned, so existing
    // image URLs on the live site keep resolving.
    if (!row && !fs.existsSync(fullPath)) throw notFound('Not found.');

    const ext = path.extname(filename).toLowerCase();
    const mime =
      (row && row.mime) ||
      ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml' }[ext] ||
        'application/octet-stream');

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    if (mime === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");

    const stat = fs.statSync(fullPath);
    res.setHeader('Content-Length', stat.size);
    return fs.createReadStream(fullPath).pipe(res);
  })
);

// DELETE /api/media/:id
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Media not found.');

    tx(() => db.prepare('DELETE FROM media WHERE id = ?').run(row.id));
    try {
      fs.unlinkSync(path.join(config.upload.dir, path.basename(row.filename)));
    } catch {
      // File may already be gone — the DB row is the source of truth.
    }
    return ok(res, { deleted: true, id: row.id });
  })
);

module.exports = router;
