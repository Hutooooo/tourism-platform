'use strict';

const { badRequest } = require('./http');

/**
 * Minimal declarative validator. Each rule is [predicate, message].
 * `requireFields` enforces presence; `optional` skips checks on undefined.
 */
function validate(value, rules) {
  const errors = {};
  const src = value && typeof value === 'object' ? { ...value } : {};

  for (const [field, rule] of Object.entries(rules)) {
    const raw = src[field];
    const optional = rule.optional === true;
    const isMissing = raw === undefined || raw === null || raw === '';

    if (isMissing) {
      if (rule.required || (!optional && rule.type)) {
        errors[field] = rule.requiredMessage || `${rule.label || field} is required.`;
      }
      continue;
    }

    if (rule.type) {
      const t = typeof raw;
      const okByType =
        (rule.type === 'string' && t === 'string') ||
        (rule.type === 'number' && (t === 'number' || (t === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))))) ||
        (rule.type === 'integer' && Number.isInteger(Number(raw))) ||
        (rule.type === 'boolean' && (t === 'boolean' || raw === 0 || raw === 1 || raw === '0' || raw === '1')) ||
        (rule.type === 'array' && Array.isArray(raw)) ||
        (rule.type === 'object' && t === 'object' && !Array.isArray(raw));

      if (!okByType) {
        errors[field] = `Expected a valid ${rule.type} for ${rule.label || field}.`;
        continue;
      }

      // Coerce numeric strings so the min/max checks below always run and
      // downstream code never has to re-parse. Same for boolean-ish flags.
      if (rule.type === 'number' || rule.type === 'integer') src[field] = Number(raw);
      if (rule.type === 'boolean') src[field] = raw === true || raw === 1 || raw === '1';
    }

    if (rule.enum && !rule.enum.includes(raw)) {
      errors[field] = `${rule.label || field} must be one of: ${rule.enum.join(', ')}.`;
      continue;
    }

    if (t_isString(raw)) {
      if (rule.minLength !== undefined && raw.trim().length < rule.minLength) {
        errors[field] = `${rule.label || field} must be at least ${rule.minLength} characters.`;
        continue;
      }
      if (rule.maxLength !== undefined && raw.length > rule.maxLength) {
        errors[field] = `${rule.label || field} must be at most ${rule.maxLength} characters.`;
        continue;
      }
      if (rule.pattern && !rule.pattern.test(raw)) {
        errors[field] = rule.patternMessage || `${rule.label || field} is not in a valid format.`;
        continue;
      }
    }

    // Read the coerced value so min/max apply to numeric strings too.
    const num = src[field];
    if (typeof num === 'number' && Number.isFinite(num)) {
      if (rule.min !== undefined && num < rule.min) {
        errors[field] = `${rule.label || field} must be at least ${rule.min}.`;
        continue;
      }
      if (rule.max !== undefined && num > rule.max) {
        errors[field] = `${rule.label || field} must be at most ${rule.max}.`;
        continue;
      }
    }

    if (typeof rule.custom === 'function') {
      const problem = rule.custom(raw, src);
      if (problem) {
        errors[field] = problem;
        continue;
      }
    }
  }

  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors);
  return src;
}

function t_isString(v) {
  return typeof v === 'string';
}

/** Common email shape — intentionally conservative, not RFC-exhaustive. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Accepts E.164-ish and loose local formats users actually type. */
const PHONE_RE = /^\+?[0-9][0-9\s().-]{5,24}$/;

const emailRule = (label = 'Email') => ({
  type: 'string',
  label,
  maxLength: 254,
  pattern: EMAIL_RE,
  patternMessage: `${label} must be a valid email address.`,
});

const phoneRule = (label = 'Phone') => ({
  type: 'string',
  label,
  maxLength: 32,
  pattern: PHONE_RE,
  patternMessage: `${label} must be a valid phone number.`,
  optional: true,
});

const slugRule = (label = 'Slug') => ({
  type: 'string',
  label,
  minLength: 2,
  maxLength: 120,
  pattern: SLUG_RE,
  patternMessage: `${label} may only contain lowercase letters, numbers and hyphens.`,
});

module.exports = { validate, emailRule, phoneRule, slugRule, EMAIL_RE, SLUG_RE, PHONE_RE };
