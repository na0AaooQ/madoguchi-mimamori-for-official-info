import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSemanticData } from '../../scripts/validation/semantic-validator.js';

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
