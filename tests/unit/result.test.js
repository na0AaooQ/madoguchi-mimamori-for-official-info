import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createResult,
  exitCodeForResults,
  hasErrors,
  sortResults,
  summarizeResults
} from '../../scripts/validation/result.js';

test('creates a validation result', () => {
  const result = createResult({
    severity: 'warning',
    code: 'W001',
    file: 'test.json',
    message: '確認が必要です。',
    item_id: 'test-1'
  });
  assert.equal(result.severity, 'warning');
  assert.equal(result.item_id, 'test-1');
});

test('rejects an invalid severity', () => {
  assert.throws(
    () => createResult({ severity: 'fatal', code: 'E999', file: 'x', message: 'x' }),
    /severity/
  );
});

test('summarizes Error, Warning, and Info', () => {
  const results = ['error', 'warning', 'info', 'error'].map((severity, index) =>
    createResult({ severity, code: `T${index}`, file: 'test', message: 'test' })
  );
  assert.deepEqual(summarizeResults(results), { error: 2, warning: 1, info: 1, total: 4 });
});

test('detects whether Error exists', () => {
  const warning = createResult({ severity: 'warning', code: 'W001', file: 'x', message: 'x' });
  const error = createResult({ severity: 'error', code: 'E001', file: 'x', message: 'x' });
  assert.equal(hasErrors([warning]), false);
  assert.equal(hasErrors([warning, error]), true);
});

test('sorts results deterministically without mutating input', () => {
  const input = [
    createResult({ severity: 'info', code: 'I001', file: 'b', message: 'b' }),
    createResult({ severity: 'error', code: 'E002', file: 'b', message: 'b' }),
    createResult({ severity: 'error', code: 'E001', file: 'a', message: 'a' })
  ];
  const sorted = sortResults(input);
  assert.deepEqual(
    sorted.map(({ code }) => code),
    ['E001', 'E002', 'I001']
  );
  assert.equal(input[0].code, 'I001');
});

test('returns exit code 0 without Error and 1 with Error', () => {
  const info = createResult({ severity: 'info', code: 'I001', file: 'x', message: 'x' });
  const error = createResult({ severity: 'error', code: 'E001', file: 'x', message: 'x' });
  assert.equal(exitCodeForResults([info]), 0);
  assert.equal(exitCodeForResults([info, error]), 1);
});
