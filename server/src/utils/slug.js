'use strict';

// U+0300-U+036F: combining diacritical marks produced by NFKD decomposition.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Build a URL-safe slug. Handles common Latin diacritics (Italian place
 * names like "Citta" or "Forli") and degrades to ASCII transliteration.
 */
function slugify(input, fallback = 'item') {
  const base = String(input || '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim()
    // Apostrophes (Italian "dell'Est") collapse away rather than to a dash.
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');

  return base || fallback;
}

/** Ensure `slug` is unique among `taken` by appending -2, -3, ... */
function uniqueSlug(slug, taken) {
  const set = taken instanceof Set ? taken : new Set(taken || []);
  if (!set.has(slug)) return slug;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${slug}-${i}`;
    if (!set.has(candidate)) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

module.exports = { slugify, uniqueSlug };
