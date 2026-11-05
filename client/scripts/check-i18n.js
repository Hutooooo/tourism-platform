#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const locales = ['en', 'si', 'it'];
const ns = ['translation']; // only namespace used

function loadTranslations() {
  const dict = {};
  for (const lang of locales) {
    const filePath = path.join('client', 'src', 'locales', `${lang}`, 'translation.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    dict[lang] = JSON.parse(raw);
  }
  return dict;
}

const dicts = loadTranslations();

function collectKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.add(fullKey);
    if (typeof value === 'object' && value !== null) {
      keys.add(...collectKeys(value, key));
    }
  }
  return keys;
}

const allKeys = new Set();
dicts.en && walk(dicts.en);
dicts.si && walk(dicts.si);
dicts.it && walk(dicts.it);

function walk(obj, path = '') {
  for (const [k, v] of Object.entries(obj)) {
    const key = path ? `${path}.${k}` : k;
    allKeys.add(key);
    if (typeof v === 'object' && v !== null) {
      walk(v, key);
    }
  }
}

const missing = {};
const duplicate = new Map();

for (const key of allKeys) {
  const present = {};
  for (const lang of locales) {
    if (dicts[lang] && dicts[lang][key]) {
      present[lang] = true;
    }
    if (Object.keys(present).length === 0) {
      missing[key] = 'missing';
    } else {
      const keyStr = JSON.stringify(present);
      if (duplicate.has(keyStr)) {
        duplicate.set(key, 'duplicate');
      } else {
        duplicate.set(key, 'unique');
      }
    }
  }
}

// Output results
console.log('=== Translation key audit ===');
console.log(`Total keys discovered: ${allKeys.size}`);
console.log('Missing keys:');
for (const key in missing) {
  console.log(`- ${key} (missing in ${missing[key]})`);
}
console.log('Duplicates:');
for (const [key, status] of duplicate.entries()) {
  console.log(`- ${key}: ${status}`);
}