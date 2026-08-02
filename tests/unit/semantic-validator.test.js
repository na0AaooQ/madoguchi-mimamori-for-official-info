import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateSemanticData,
  validateSiteData
} from '../../scripts/validation/semantic-validator.js';

function validInput() {
  return {
    core: [{ id: 'test-item-1', display_locales: ['ja', 'en'], related_ids: ['test-ref-1'] }],
    locales: {
      ja: [
        {
          id: 'test-item-1',
          content_revision: 2,
          locale_status: 'published'
        }
      ],
      en: [
        {
          id: 'test-item-1',
          based_on_ja_revision: 2,
          locale_status: 'published'
        }
      ]
    },
    references: [{ id: 'test-ref-1' }]
  };
}

test('accepts complete Japanese and English locales', () => {
  assert.deepEqual(validateSemanticData(validInput()), []);
});

test('detects a missing required English locale', () => {
  const input = validInput();
  input.locales.en = [];
  assert.ok(validateSemanticData(input).some(({ code }) => code === 'E003'));
});

test('accepts matching revision numbers', () => {
  assert.equal(
    validateSemanticData(validInput()).some(({ code }) => code === 'E004'),
    false
  );
});

test('detects mismatched revision numbers', () => {
  const input = validInput();
  input.locales.en[0].based_on_ja_revision = 1;
  assert.ok(validateSemanticData(input).some(({ code }) => code === 'E004'));
});

test('accepts an existing ID reference', () => {
  assert.equal(
    validateSemanticData(validInput()).some(({ code }) => code === 'E005'),
    false
  );
});

test('detects a missing ID reference', () => {
  const input = validInput();
  input.core[0].related_ids = ['test-missing'];
  assert.ok(validateSemanticData(input).some(({ code }) => code === 'E005'));
});

test('collects multiple semantic errors', () => {
  const input = validInput();
  input.locales.en = [];
  input.core[0].related_ids = ['test-missing'];
  assert.deepEqual(
    validateSemanticData(input)
      .filter(({ severity }) => severity === 'error')
      .map(({ code }) => code),
    ['E003', 'E005']
  );
});

test('classifies Warning and Info without hiding Error', () => {
  const input = validInput();
  input.locales.en[0].locale_status = 'under-review';
  input.locales.ja[0].locale_status = 'draft';
  const results = validateSemanticData(input);
  assert.ok(results.some(({ code, severity }) => code === 'W001' && severity === 'warning'));
  assert.ok(results.some(({ code, severity }) => code === 'I001' && severity === 'info'));
});

test('does not mutate the input', () => {
  const input = validInput();
  const before = structuredClone(input);
  validateSemanticData(input);
  assert.deepEqual(input, before);
});

function validSiteInput() {
  return {
    core: {
      site_id: 'madoguchi-mimamori',
      default_locale: 'ja',
      supported_locales: ['ja', 'en']
    },
    ja: {
      locale: 'ja',
      site_id: 'madoguchi-mimamori',
      locale_status: 'published',
      content_revision: 1
    },
    en: {
      locale: 'en',
      site_id: 'madoguchi-mimamori',
      locale_status: 'published',
      content_revision: 1,
      based_on_ja_revision: 1
    }
  };
}

test('accepts consistent site data', () => {
  assert.deepEqual(validateSiteData(validSiteInput()), []);
});

test('requires an English based_on_ja_revision', () => {
  const input = validSiteInput();
  delete input.en.based_on_ja_revision;
  assert.ok(validateSiteData(input).some(({ code }) => code === 'E003'));
});

test('detects a site revision mismatch', () => {
  const input = validSiteInput();
  input.en.based_on_ja_revision = 2;
  assert.ok(validateSiteData(input).some(({ code }) => code === 'E004'));
});

test('rejects based_on_ja_revision in the Japanese site', () => {
  const input = validSiteInput();
  input.ja.based_on_ja_revision = 1;
  assert.ok(validateSiteData(input).some(({ code }) => code === 'E010'));
});

test('detects site identifier and locale setting inconsistencies', () => {
  const input = validSiteInput();
  input.en.site_id = 'different-site';
  input.core.default_locale = 'en';
  input.core.supported_locales = ['ja', 'ja'];
  input.ja.locale = 'en';
  const fields = validateSiteData(input).map(({ field }) => field);
  assert.ok(fields.includes('site_id'));
  assert.ok(fields.includes('default_locale'));
  assert.ok(fields.includes('supported_locales'));
  assert.ok(fields.includes('locale'));
});

test('site semantic validation does not mutate input', () => {
  const input = validSiteInput();
  const before = structuredClone(input);
  validateSiteData(input);
  assert.deepEqual(input, before);
});

test('site semantic validation leaves invalid site_id types to Schema validation', () => {
  const input = validSiteInput();
  input.ja.site_id = 1;
  assert.doesNotThrow(() => validateSiteData(input));
});
