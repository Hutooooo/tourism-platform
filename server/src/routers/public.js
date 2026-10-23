'use strict';

/**
 * Router 9/9 — public site bootstrap
 * Everything the marketing site needs on first paint, in one request:
 * settings, navigation, featured content and SEO defaults. Keeps the
 * client's initial waterfall to a single round trip.
 */

const express = require('express');

const config = require('../config');
const { db, getAllSettings } = require('../db');
const { ok, asyncHandler } = require('../utils/http');
const { DEFAULT_SETTINGS } = require('../settings/defaults');

const router = express.Router();

function parseJson(v, fallback) {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

/**
 * Absolute origin of this deployment, for canonical/OG URLs and the
 * `api.baseUrl` field of the bootstrap payload.
 *
 * PUBLIC_API_URL wins when the host sets it. Otherwise derive it from the
 * request rather than defaulting to localhost: the app does not know its own
 * public hostname at boot, and advertising `http://localhost:8080` to a
 * browser or crawler is never correct. `app.set('trust proxy', 1)` makes
 * req.protocol follow X-Forwarded-Proto, so this is right behind Railway's
 * TLS-terminating proxy.
 */
function publicOrigin(req) {
  if (config.publicApiUrl) return config.publicApiUrl;
  const host = req.get('host');
  if (!host) return '';
  return `${req.protocol}://${host}`;
}

/**
 * Normalise a phone/WhatsApp number into the forms the UI needs:
 * a display string, a tel: target and a wa.me target.
 */
function contactLinks(phone, whatsapp) {
  const toDigits = (s) => String(s || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');

  const phoneDigits = toDigits(phone);
  const whatsappDigits = toDigits(whatsapp || phone);

  return {
    phone: {
      display: phone || '',
      href: phone ? `tel:${phoneDigits}` : '',
    },
    whatsapp: {
      display: whatsapp || phone || '',
      // wa.me expects digits only, with a leading + stripped.
      href: whatsappDigits ? `https://wa.me/${whatsappDigits.replace(/^\+/, '')}` : '',
    },
    email: {
      display: '',
      href: '',
    },
  };
}

// GET /api/public/bootstrap — one-shot payload for the client.
router.get(
  '/bootstrap',
  asyncHandler(async (req, res) => {
    const settings = { ...DEFAULT_SETTINGS, ...getAllSettings() };

    const email = String(settings.contact_email || '');
    const links = contactLinks(settings.contact_phone, settings.contact_whatsapp);
    links.email = { display: email, href: email ? `mailto:${email}` : '' };

    const destinations = db
      .prepare(
        `SELECT id, slug, name, country, region, summary, image_url, featured, highlights
         FROM destinations WHERE published = 1
         ORDER BY featured DESC, sort_order ASC, name ASC LIMIT 30`
      )
      .all()
      .map((d) => ({ ...d, featured: !!d.featured, highlights: parseJson(d.highlights, []) }));

    const packages = db
      .prepare(
        `SELECT id, slug, title, direction, summary, duration_days, duration_nights,
                destinations_list, price_from, price_max, currency, pricing_status,
                image_url, featured, destination_id
         FROM packages WHERE published = 1 AND archived = 0
         ORDER BY featured DESC, sort_order ASC, title ASC LIMIT 30`
      )
      .all()
      .map((p) => ({
        ...p,
        featured: !!p.featured,
        destinations_list: parseJson(p.destinations_list, []),
      }));

    const destinationsByCountry = {
      'Sri Lanka': destinations.filter((d) => d.country === 'Sri Lanka'),
      Italy: destinations.filter((d) => d.country === 'Italy'),
    };

    return ok(res, {
      settings: {
        brand_name: settings.brand_name,
        tagline: settings.tagline,
        contact_email: settings.contact_email,
        contact_phone: settings.contact_phone,
        contact_whatsapp: settings.contact_whatsapp,
        directions: settings.directions,
        hero_title: settings.hero_title,
        hero_subtitle: settings.hero_subtitle,
        about_title: settings.about_title,
        about_body: settings.about_body,
        seo: settings.seo,
        currency: settings.currency,
        booking_enabled: settings.booking_enabled !== false,
        inquiry_enabled: settings.inquiry_enabled !== false,
        pricing_disclaimer: settings.pricing_disclaimer,
        footer_note: settings.footer_note,
      },
      contact: links,
      destinations,
      destinationsByCountry,
      packages,
      stats: {
        destinations: destinations.length,
        packages: packages.length,
        countries: 2,
      },
      api: { baseUrl: publicOrigin(req) },
      serverTime: new Date().toISOString(),
    });
  })
);

// GET /api/public/health — liveness probe for deploy checks.
router.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    return ok(res, { status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
  } catch (err) {
    return res.status(503).json({ success: false, error: { message: 'Database unavailable.' } });
  }
});

// GET /api/public/seo — per-path metadata for client-side route changes.
router.get(
  '/seo',
  asyncHandler(async (req, res) => {
    const settings = { ...DEFAULT_SETTINGS, ...getAllSettings() };
    const suffix = (settings.seo && settings.seo.title_suffix) || settings.brand_name || '';
    const baseDescription = (settings.seo && settings.seo.description) || '';
    const keywords = (settings.seo && settings.seo.keywords) || [];
    const path = String(req.query.path || '/');

    let title = `${settings.brand_name}`;
    let description = baseDescription;

    // Match the first meaningful segment to a known entity for richer meta.
    const segments = path.split('/').filter(Boolean);
    if (segments[0] === 'destinations' && segments[1]) {
      const row = db.prepare('SELECT name, summary FROM destinations WHERE slug = ?').get(segments[1]);
      if (row) {
        title = `${row.name} — ${settings.brand_name}`;
        description = row.summary || baseDescription;
      }
    } else if (segments[0] === 'packages' && segments[1]) {
      const row = db
        .prepare('SELECT title, summary, seo_title, seo_description FROM packages WHERE slug = ?')
        .get(segments[1]);
      if (row) {
        title = `${row.seo_title || row.title} — ${settings.brand_name}`;
        description = row.seo_description || row.summary || baseDescription;
      }
    } else if (segments.length === 0) {
      title = settings.brand_name;
      description = settings.hero_subtitle || baseDescription;
    } else if (segments[0] === 'contact') {
      title = `Contact — ${settings.brand_name}`;
      description = `Get in touch with ${settings.brand_name}. Email, phone and WhatsApp.`;
    } else if (segments[0] === 'about') {
      title = `About — ${settings.brand_name}`;
      description = settings.about_body ? settings.about_body.slice(0, 300) : baseDescription;
    } else if (segments[0]) {
      const label = segments[segments.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      title = `${label} — ${settings.brand_name}`;
    }

    const fullTitle = suffix && !title.includes(suffix) ? `${title} — ${suffix}` : title;

    return ok(res, {
      title: fullTitle.slice(0, 300),
      description: String(description || '').slice(0, 320),
      keywords,
      canonical: `${publicOrigin(req)}${path}`,
      og: {
        title: fullTitle.slice(0, 300),
        description: String(description || '').slice(0, 320),
        type: 'website',
        siteName: settings.brand_name,
      },
    });
  })
);

module.exports = router;
