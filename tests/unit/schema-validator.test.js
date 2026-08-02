import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SchemaCompilationError,
  validateWithSchema
} from '../../scripts/validation/schema-validator.js';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['id', 'status', 'published_on', 'count'],
  properties: {
    id: { type: 'string' },
    status: { enum: ['draft', 'published'] },
    published_on: { type: 'string', format: 'date' },
    count: { type: 'integer' }
  },
  additionalProperties: false
};

const valid = {
  id: 'test-1',
  status: 'published',
  published_on: '2026-08-02',
  count: 1
};

function validate(data) {
  return validateWithSchema(schema, data, { schemaFile: 'schema.json', file: 'data.json' });
}

test('accepts valid data', () => {
  assert.deepEqual(validate(valid), []);
});

test('detects a missing required property', () => {
  const missing = {
    status: valid.status,
    published_on: valid.published_on,
    count: valid.count
  };
  assert.ok(validate(missing).some(({ field }) => field === 'id'));
});

test('detects an invalid type', () => {
  assert.ok(validate({ ...valid, count: '1' }).some(({ message }) => message.includes('integer')));
});

test('detects an invalid enum', () => {
  assert.ok(
    validate({ ...valid, status: 'unknown' }).some(({ message }) => message.includes('enum'))
  );
});

test('detects an additional property', () => {
  assert.ok(
    validate({ ...valid, extra: true }).some(({ message }) => message.includes('additional'))
  );
});

test('detects an invalid date format', () => {
  assert.ok(
    validate({ ...valid, published_on: '2026-99-99' }).some(({ message }) =>
      message.includes('format')
    )
  );
});

test('collects multiple schema errors', () => {
  const results = validate({ id: 1, status: 'unknown', published_on: 'invalid', count: 'one' });
  assert.ok(results.length >= 4);
});

test('distinguishes a schema compilation error', () => {
  assert.throws(
    () => validateWithSchema({ type: 'not-a-type' }, {}, { schemaFile: 'broken.json' }),
    SchemaCompilationError
  );
});
