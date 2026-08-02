import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CORE_DATA_LAYOUT,
  DATA_LAYOUT,
  EMPTY_DATA_LAYOUT,
  LOCALE_DATA_LAYOUT,
  SCHEMA_LAYOUT,
  SITE_DATA_LAYOUT,
  SUPPORTED_LOCALES
} from '../../scripts/validation/data-layout.js';
import { compileSchema } from '../../scripts/validation/schema-validator.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

test('defines the required data and Schema inventory once', () => {
  assert.equal(CORE_DATA_LAYOUT.length, 14);
  assert.deepEqual(SUPPORTED_LOCALES, ['ja', 'en']);
  assert.equal(LOCALE_DATA_LAYOUT.filter(({ locale }) => locale === 'ja').length, 13);
  assert.equal(LOCALE_DATA_LAYOUT.filter(({ locale }) => locale === 'en').length, 13);
  assert.equal(DATA_LAYOUT.length, 40);
  assert.equal(SCHEMA_LAYOUT.filter(({ scope }) => scope === 'core').length, 14);
  assert.equal(SCHEMA_LAYOUT.filter(({ scope }) => scope === 'locale').length, 13);
  assert.equal(SCHEMA_LAYOUT.length, 27);
  assert.equal(SITE_DATA_LAYOUT.length, 3);
  assert.equal(EMPTY_DATA_LAYOUT.length, 37);
});

test('maps every data file to one required Schema', () => {
  const schemaPaths = new Set(SCHEMA_LAYOUT.map(({ schemaPath }) => schemaPath));
  assert.equal(new Set(DATA_LAYOUT.map(({ dataPath }) => dataPath)).size, 40);
  assert.ok(DATA_LAYOUT.every(({ schemaPath }) => schemaPaths.has(schemaPath)));
  assert.equal(new Set(DATA_LAYOUT.map(({ schemaPath }) => schemaPath)).size, 27);
});

test('all 27 Schema identifiers are unique and compile in Ajv strict mode', async () => {
  const identifiers = [];
  for (const { scope, managementUnit, schemaPath } of SCHEMA_LAYOUT) {
    const schema = JSON.parse(await readFile(path.join(repoRoot, schemaPath), 'utf8'));
    identifiers.push(schema.$id);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.$id, `urn:madoguchi-mimamori:schema:${scope}:${managementUnit}:1.0.0`);
    assert.equal(typeof schema.title, 'string');
    assert.equal(typeof schema.description, 'string');
    assert.equal(schema.type, 'object');
    assert.equal(typeof schema.properties, 'object');
    assert.ok(Array.isArray(schema.required));
    assert.equal(schema.additionalProperties, false);
    assert.doesNotThrow(() => compileSchema(schema, { schemaFile: schemaPath }));
  }
  assert.equal(new Set(identifiers).size, 27);
});

test('three site files are objects and the other 37 data files have empty items', async () => {
  for (const { dataPath } of SITE_DATA_LAYOUT) {
    const value = JSON.parse(await readFile(path.join(repoRoot, dataPath), 'utf8'));
    assert.equal(Array.isArray(value), false, dataPath);
    assert.equal(Object.hasOwn(value, 'items'), false, dataPath);
  }
  for (const { dataPath } of EMPTY_DATA_LAYOUT) {
    const value = JSON.parse(await readFile(path.join(repoRoot, dataPath), 'utf8'));
    assert.deepEqual(value.items, [], dataPath);
  }
  for (const { schemaPath } of SCHEMA_LAYOUT.filter(({ isSite }) => !isSite)) {
    const schema = JSON.parse(await readFile(path.join(repoRoot, schemaPath), 'utf8'));
    assert.equal(schema.properties.items.maxItems, 0, schemaPath);
  }
});

test('locale check-history files and Schema are not part of the layout', () => {
  assert.equal(
    DATA_LAYOUT.some(
      ({ dataPath }) => dataPath.endsWith('/check-history.json') && dataPath.includes('/locales/')
    ),
    false
  );
  assert.equal(
    SCHEMA_LAYOUT.some(
      ({ schemaPath }) => schemaPath === 'schemas/locales/check-history.schema.json'
    ),
    false
  );
});
