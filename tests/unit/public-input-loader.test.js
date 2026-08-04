import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  loadPreviewInput,
  loadProductionInput
} from '../../scripts/publication/public-input-loader.js';
import { SCHEMA_LAYOUT } from '../../scripts/validation/data-layout.js';
import {
  createPublicRepositoryCopy,
  readJson,
  repoRoot,
  writeJson
} from '../helpers/public-generation.js';

test('loads the published preview fixture through existing management validation', async () => {
  const loaded = await loadPreviewInput(repoRoot);
  assert.deepEqual(loaded.results, []);
  assert.equal(loaded.manifest.fixture_id, 'minimum-published-navigation');
  assert.equal(loaded.manifest.artifact_type, 'fictional-preview');
  assert.equal(loaded.manifest.as_of, '2026-08-02');
  assert.equal(loaded.input.core.sections.length, 5);
  assert.equal(loaded.input.core.cards.length, 1);
  assert.equal(loaded.input.core.cardSourceLinks.length, 1);
  assert.equal(loaded.input.core.regions.length, 2);
  assert.equal(loaded.input.core.organizations.length, 1);
  assert.equal(loaded.input.core.sources.length, 1);
  assert.equal(loaded.input.core.evidence.length, 3);
});

test('keeps the management Schema layout at 27 and separates the public contract', async () => {
  assert.equal(SCHEMA_LAYOUT.length, 27);
  assert.equal(
    SCHEMA_LAYOUT.some(({ schemaPath }) => schemaPath.startsWith('contracts/')),
    false
  );
  const schema = JSON.parse(
    await readFile(path.join(repoRoot, 'contracts/public/navigation.schema.json'), 'utf8')
  );
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(
    SCHEMA_LAYOUT.some(({ schemaPath }) => schemaPath === schema.$id),
    false
  );
});

test('loads the published production data without validation findings', async () => {
  const loaded = await loadProductionInput(repoRoot);
  assert.deepEqual(loaded.results, []);
  assert.equal(loaded.input.site.core.site_publication_status, 'published');
  assert.equal(
    loaded.input.site.locales.ja.contact_url,
    'https://portfolio.na0aaooq.com/contact.html'
  );
  assert.equal(
    loaded.input.site.locales.en.contact_url,
    'https://portfolio.na0aaooq.com/en/contact.html'
  );
});

test('fixture contains only fictional URL and naming markers', async () => {
  const source = await readFile(
    path.join(repoRoot, 'tests/fixtures/public-generation/preview/input.json'),
    'utf8'
  );
  assert.match(source, /example\.invalid/);
  assert.doesNotMatch(source, /https:\/\/(?!example\.invalid)/);
  assert.doesNotMatch(source, /熊本県庁|熊本市役所|電話番号|メールアドレス/);
});

test('reports existing E002 before generation for a management Schema violation', async (t) => {
  const root = await createPublicRepositoryCopy(t);
  const file = 'tests/fixtures/public-generation/preview/input.json';
  const input = await readJson(root, file);
  delete input.core.cards.items[0].id;
  await writeJson(root, file, input);
  const loaded = await loadPreviewInput(root);
  assert.ok(loaded.results.some(({ code }) => code === 'E002'));
  assert.equal(loaded.input, undefined);
});

test('reports existing E015 before generation when confirmed evidence is missing', async (t) => {
  const root = await createPublicRepositoryCopy(t);
  const file = 'tests/fixtures/public-generation/preview/input.json';
  const input = await readJson(root, file);
  input.core.evidence.items = input.core.evidence.items.filter(
    ({ id }) => id !== 'evidence-example-source-official-page'
  );
  for (const locale of ['ja', 'en']) {
    input.locales[locale].evidence.items = input.locales[locale].evidence.items.filter(
      ({ id }) => id !== 'evidence-example-source-official-page'
    );
  }
  await writeJson(root, file, input);
  const loaded = await loadPreviewInput(root);
  assert.ok(loaded.results.some(({ code }) => code === 'E015'));
  assert.equal(loaded.input, undefined);
});
