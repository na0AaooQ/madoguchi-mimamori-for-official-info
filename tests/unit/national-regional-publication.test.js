import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadPublicSchemas,
  validatePublicArtifact
} from '../../scripts/publication/public-artifact-validator.js';
import {
  buildPublicArtifacts,
  serializePublicArtifact
} from '../../scripts/publication/public-navigation-builder.js';
import { repoRoot, createPreviewInput } from '../helpers/public-generation.js';

test('builds thin national and self-contained regional artifacts', async () => {
  const input = await createPreviewInput();
  const built = buildPublicArtifacts(input, {
    artifactType: 'fictional-preview',
    asOf: '2026-08-02'
  });

  assert.deepEqual(built.results, []);
  assert.deepEqual(
    built.national.ja.regions.map(({ region_slug }) => region_slug),
    ['example', 'second-example']
  );
  assert.deepEqual(Object.keys(built.regions.ja), ['example', 'second-example']);
  assert.equal(Object.hasOwn(built.national.ja, 'sections'), false);
  assert.equal(Object.hasOwn(built.national.ja, 'cards'), false);
  assert.equal(Object.hasOwn(built.national.ja.regions[0], 'display_order'), false);

  const example = built.regions.ja.example;
  assert.equal(example.region.region_id, 'region-example-prefecture');
  assert.equal(example.region.region_slug, 'example');
  assert.equal(example.region.path, '/ja/regions/example/');
  assert.equal(Object.hasOwn(example.region, 'navigation_label'), false);
  assert.deepEqual(
    example.sections.flatMap(({ cards }) => cards.map(({ id }) => id)),
    ['card-example-disaster-information']
  );
  assert.deepEqual(built.regions.ja['second-example'].sections, []);
});

test('regional extraction uses an explicit subtree and never auto-publishes country scope', async () => {
  for (const scopeId of ['region-example-country', 'region-example-nationwide']) {
    const input = await createPreviewInput();
    if (scopeId.endsWith('nationwide')) {
      input.core.regions.push({
        ...input.core.regions[0],
        id: scopeId,
        region_type: 'nationwide'
      });
      for (const locale of ['ja', 'en']) {
        input.locales[locale].regions.push({
          ...input.locales[locale].regions[0],
          id: scopeId
        });
      }
    }
    input.core.cards[0].region_ids = [scopeId];
    const built = buildPublicArtifacts(input, {
      artifactType: 'fictional-preview',
      asOf: '2026-08-02'
    });

    assert.deepEqual(built.results, []);
    assert.deepEqual(built.regions.ja.example.sections, []);
    assert.deepEqual(built.regions.en.example.sections, []);
  }
});

test('national and regional artifacts are byte-deterministic when source arrays are reordered', async () => {
  const input = await createPreviewInput();
  const original = buildPublicArtifacts(input, {
    artifactType: 'fictional-preview',
    asOf: '2026-08-02'
  });
  for (const unit of Object.keys(input.core)) input.core[unit].reverse();
  for (const locale of ['ja', 'en']) {
    for (const unit of Object.keys(input.locales[locale])) input.locales[locale][unit].reverse();
  }
  const reordered = buildPublicArtifacts(input, {
    artifactType: 'fictional-preview',
    asOf: '2026-08-02'
  });

  assert.equal(
    serializePublicArtifact(reordered.national.ja),
    serializePublicArtifact(original.national.ja)
  );
  assert.equal(
    serializePublicArtifact(reordered.regions.ja.example),
    serializePublicArtifact(original.regions.ja.example)
  );
});

test('national and regional artifacts satisfy separate public contracts', async () => {
  const input = await createPreviewInput();
  const built = buildPublicArtifacts(input, {
    artifactType: 'fictional-preview',
    asOf: '2026-08-02'
  });
  const schemas = await loadPublicSchemas(repoRoot);

  assert.deepEqual(
    validatePublicArtifact(built.national.ja, {
      validateSchema: schemas.legacy.validate,
      validateNationalSchema: schemas.national.validate,
      validateRegionalSchema: schemas.regional.validate,
      file: 'dist/public-data/preview/ja/navigation.json',
      expectedMode: 'preview',
      expectedLocale: 'ja'
    }),
    []
  );
  assert.deepEqual(
    validatePublicArtifact(built.regions.ja.example, {
      validateSchema: schemas.legacy.validate,
      validateNationalSchema: schemas.national.validate,
      validateRegionalSchema: schemas.regional.validate,
      file: 'dist/public-data/preview/ja/regions/example/navigation.json',
      expectedMode: 'preview',
      expectedLocale: 'ja'
    }),
    []
  );

  const invalid = structuredClone(built.regions.ja.example);
  invalid.navigation_label = '禁止';
  assert.ok(
    validatePublicArtifact(invalid, {
      validateSchema: schemas.legacy.validate,
      validateNationalSchema: schemas.national.validate,
      validateRegionalSchema: schemas.regional.validate,
      file: 'dist/public-data/preview/ja/regions/example/navigation.json',
      expectedMode: 'preview',
      expectedLocale: 'ja'
    }).some(({ code }) => code === 'PUB-E004')
  );
});
