import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { validateWithSchema } from '../../scripts/validation/schema-validator.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const schema = JSON.parse(
  await readFile(path.join(repoRoot, 'schemas/locales/site.schema.json'), 'utf8')
);

function site(contactUrl) {
  return {
    schema_version: '1.0.0',
    data_updated_on: '2026-08-04',
    locale: 'ja',
    site_id: 'madoguchi-mimamori',
    site_name: '名前',
    subtitle: '副題',
    short_description: '説明',
    purpose: '目的',
    free_use_notice: '無料',
    external_site_notice: '外部',
    disclaimer_summary: '免責',
    ...(contactUrl === undefined ? {} : { contact_url: contactUrl }),
    locale_status: 'published',
    content_revision: 3,
    content_reviewed_on: '2026-08-04'
  };
}

function validate(value) {
  return validateWithSchema(schema, value, {
    schemaFile: 'schemas/locales/site.schema.json',
    file: 'site.json'
  });
}

test('accepts an HTTPS Locale contact URL and permits omission', () => {
  assert.deepEqual(validate(site('https://portfolio.na0aaooq.com/contact.html')), []);
  assert.deepEqual(validate(site(undefined)), []);
});

test('rejects non-HTTPS Locale contact URL schemes', () => {
  for (const value of [
    'http://portfolio.na0aaooq.com/contact.html',
    'mailto:contact@example.com',
    'ftp://example.com/contact'
  ]) {
    assert.ok(validate(site(value)).some(({ field }) => field === 'contact_url'));
  }
});
