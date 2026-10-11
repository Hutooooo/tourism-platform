'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validate, emailRule, phoneRule, slugRule } = require('../src/utils/validate');

/**
 * validate() throws HttpError with a generic message and per-field text in
 * `details`. Match against both so the assertion sees the real reason.
 */
function assertValidationThrows(fn, re) {
  assert.throws(fn, (err) => {
    const text = `${err.message} ${JSON.stringify(err.details || {})}`;
    return re.test(text);
  });
}

test('required fields are enforced', () => {
  assertValidationThrows(
    () => validate({}, { name: { type: 'string', label: 'Name', required: true } }),
    /Name is required/
  );
});

test('optional fields accept undefined, null and empty string', () => {
  const out = validate(
    { note: null, other: '', missing: undefined },
    {
      note: { type: 'string', label: 'Note', optional: true },
      other: { type: 'string', label: 'Other', optional: true },
      missing: { type: 'integer', label: 'Missing', optional: true },
    }
  );
  assert.equal(out.note, null);
});

test('numeric strings are coerced so min/max still apply', () => {
  // Before coercion, "5" bypassed min/max entirely because typeof was string.
  assertValidationThrows(() => validate({ n: '0' }, { n: { type: 'number', label: 'N', min: 1 } }), /at least 1/);
  assertValidationThrows(() => validate({ n: '99' }, { n: { type: 'integer', label: 'N', max: 50 } }), /at most 50/);

  const ok = validate({ n: '12' }, { n: { type: 'integer', label: 'N', min: 1, max: 50 } });
  assert.equal(ok.n, 12);
  assert.equal(typeof ok.n, 'number');
});

test('decimal prices are accepted as numbers', () => {
  const out = validate({ price_from: '1299.50' }, { price_from: { type: 'number', label: 'Price', min: 0, optional: true } });
  assert.equal(out.price_from, 1299.5);
});

test('non-numeric strings are rejected for number rules', () => {
  assertValidationThrows(() => validate({ n: 'abc' }, { n: { type: 'number', label: 'N' } }), /Expected a valid number/);
});

test('boolean-ish values are coerced to real booleans', () => {
  const a = validate({ f: '1' }, { f: { type: 'boolean', label: 'F' } });
  assert.equal(a.f, true);
  const b = validate({ f: 0 }, { f: { type: 'boolean', label: 'F' } });
  assert.equal(b.f, false);
});

test('enum membership is enforced', () => {
  assertValidationThrows(
    () => validate({ country: 'Atlantis' }, { country: { type: 'string', label: 'Country', enum: ['Sri Lanka', 'Italy'], required: true } }),
    /must be one of/
  );
});

test('the input object is never mutated in place', () => {
  const input = { n: '5' };
  validate(input, { n: { type: 'integer', label: 'N' } });
  assert.equal(input.n, '5', 'caller payload should be untouched');
});

test('email, phone and slug rules behave as documented', () => {
  assertValidationThrows(() => validate({ email: 'nope' }, { email: { ...emailRule(), required: true } }), /valid email/);
  assert.doesNotThrow(() => validate({ email: 'a@b.co' }, { email: { ...emailRule(), required: true } }));

  assert.doesNotThrow(() => validate({ phone: '' }, { phone: phoneRule() }));
  assert.doesNotThrow(() => validate({ phone: '+39 389 102 2909' }, { phone: phoneRule() }));
  assertValidationThrows(() => validate({ phone: 'abc' }, { phone: phoneRule() }), /valid phone/);

  assert.doesNotThrow(() => validate({ slug: 'sigiriya-and-cultural-triangle' }, { slug: { ...slugRule('Slug'), optional: true } }));
  assertValidationThrows(() => validate({ slug: 'Bad Slug!' }, { slug: { ...slugRule('Slug'), optional: true } }), /lowercase/);
});
