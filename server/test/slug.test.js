'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { slugify, uniqueSlug } = require('../src/utils/slug');

test('slugify produces URL-safe slugs', () => {
  assert.equal(slugify('Sigiriya & Cultural Triangle'), 'sigiriya-cultural-triangle');
  assert.equal(slugify('  Galle Fort  '), 'galle-fort');
  assert.equal(slugify('Colombo'), 'colombo');
});

test('slugify strips Italian diacritics rather than dropping the letters', () => {
  // "Città del Vaticano" → the combining grave accent must be removed.
  assert.equal(slugify('Città del Vaticano'), 'citta-del-vaticano');
  assert.equal(slugify('Amalfi — Costiera'), 'amalfi-costiera');
  assert.equal(slugify("L'Aquila"), 'laquila');
});

test('slugify falls back when nothing usable remains', () => {
  assert.equal(slugify('!!!'), 'item');
  assert.equal(slugify(''), 'item');
  assert.equal(slugify(null), 'item');
  assert.equal(slugify('ΩΩΩ', 'fallback'), 'fallback');
});

test('slugify caps length and never ends with a hyphen', () => {
  const long = slugify(`${'word '.repeat(60)}end`);
  assert.ok(long.length <= 120);
  assert.ok(!long.endsWith('-'));
});

test('uniqueSlug avoids collisions', () => {
  assert.equal(uniqueSlug('rome', []), 'rome');
  assert.equal(uniqueSlug('rome', ['rome']), 'rome-2');
  assert.equal(uniqueSlug('rome', ['rome', 'rome-2']), 'rome-3');
});

test('uniqueSlug skips past an already-used numeric suffix', () => {
  assert.equal(uniqueSlug('venice', ['venice', 'venice-2', 'venice-3']), 'venice-4');
});
